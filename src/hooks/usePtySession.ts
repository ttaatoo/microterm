import { useCallback, useRef } from "react";
import type { Terminal } from "@xterm/xterm";
import {
  MAX_PTY_RETRIES,
  PTY_RESTART_DELAY_MS,
  PTY_RETRY_DELAY_MS,
} from "@/lib/constants";
import { ensureValidDimensions } from "@/lib/ptyUtils";

interface PtyOutput {
  session_id: string;
  data: string;
}

interface PtyExit {
  session_id: string;
  exit_code: number | null;
}

interface UsePtySessionOptions {
  terminal: Terminal | null;
  existingSessionId?: string | null;
  onSessionCreated?: (sessionId: string) => void;
}

interface UsePtySessionReturn {
  sessionIdRef: React.MutableRefObject<string | null>;
  createSession: (cols: number, rows: number) => Promise<void>;
  reuseSession: (existingSessionId: string, cols: number, rows: number) => Promise<void>;
  writeToSession: (data: string) => Promise<void>;
  resizeSession: (cols: number, rows: number) => Promise<void>;
  closeSession: () => Promise<void>;
  setupListeners: () => Promise<() => void>;
}

/**
 * Hook for managing PTY (pseudo-terminal) sessions
 * Handles creation, I/O, resize, and cleanup of terminal sessions
 */
export function usePtySession({
  terminal,
  existingSessionId: _existingSessionId,
  onSessionCreated,
}: UsePtySessionOptions): UsePtySessionReturn {
  const sessionIdRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);

  const createSession = useCallback(
    async (cols: number, rows: number, retryCount = 0): Promise<void> => {
      if (!terminal) return;

      const { cols: validCols, rows: validRows } = ensureValidDimensions(cols, rows);

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const sessionId = await invoke<string>("create_pty_session", {
          cols: validCols,
          rows: validRows,
        });
        sessionIdRef.current = sessionId;
        onSessionCreated?.(sessionId);
      } catch (error) {
        console.error("[PTY] Failed to create session:", error);
        terminal.write(`\x1b[31mFailed to create PTY session: ${error}\x1b[0m\r\n`);

        if (retryCount < MAX_PTY_RETRIES) {
          const nextRetry = retryCount + 1;
          terminal.write(`\x1b[33mRetrying... (${nextRetry}/${MAX_PTY_RETRIES})\x1b[0m\r\n`);
          await new Promise((resolve) => setTimeout(resolve, PTY_RETRY_DELAY_MS * nextRetry));
          return createSession(cols, rows, nextRetry);
        } else {
          terminal.write(
            `\x1b[31mFailed to create terminal after ${MAX_PTY_RETRIES} attempts.\x1b[0m\r\n`
          );
          terminal.write(`\x1b[33mPlease restart the application.\x1b[0m\r\n`);
        }
      }
    },
    [terminal, onSessionCreated]
  );

  const reuseSession = useCallback(
    async (existingSessionId: string, cols: number, rows: number): Promise<void> => {
      if (!terminal) return;

      sessionIdRef.current = existingSessionId;
      const { cols: validCols, rows: validRows } = ensureValidDimensions(cols, rows);

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("resize_pty", {
          sessionId: existingSessionId,
          cols: validCols,
          rows: validRows,
        });
      } catch (error) {
        console.warn("[PTY] Failed to resize existing session, creating new one:", error);
        await createSession(cols, rows);
      }
    },
    [terminal, createSession]
  );

  const writeToSession = useCallback(async (data: string): Promise<void> => {
    if (!sessionIdRef.current || !terminal) return;

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("write_to_pty", {
        sessionId: sessionIdRef.current,
        data,
      });
    } catch (error) {
      console.error("[PTY] Write failed:", error);
      terminal.write("\r\n\x1b[31m[Connection lost. Attempting to reconnect...]\x1b[0m\r\n");

      const currentSession = sessionIdRef.current;
      sessionIdRef.current = null;

      if (currentSession) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("close_pty_session", { sessionId: currentSession });
        } catch {
          // Ignore close errors during reconnection
        }
      }

      await createSession(terminal.cols, terminal.rows);
    }
  }, [terminal, createSession]);

  const resizeSession = useCallback(async (cols: number, rows: number): Promise<void> => {
    if (!sessionIdRef.current) return;

    const { cols: validCols, rows: validRows } = ensureValidDimensions(cols, rows);

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("resize_pty", {
        sessionId: sessionIdRef.current,
        cols: validCols,
        rows: validRows,
      });
    } catch (error) {
      console.error("[PTY] Resize failed:", error);
    }
  }, []);

  const closeSession = useCallback(async (): Promise<void> => {
    // Clean up event listeners
    unlistenOutputRef.current?.();
    unlistenOutputRef.current = null;
    unlistenExitRef.current?.();
    unlistenExitRef.current = null;

    // Close PTY session
    if (sessionIdRef.current) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("close_pty_session", { sessionId: sessionIdRef.current });
      } catch (error) {
        console.error("[PTY] Close failed:", error);
      }
      sessionIdRef.current = null;
    }
  }, []);

  const setupListeners = useCallback(async (): Promise<() => void> => {
    if (!terminal) return () => {};

    const { listen } = await import("@tauri-apps/api/event");

    // Listen for PTY output
    const unlistenOutput = await listen<PtyOutput>("pty-output", (event) => {
      if (event.payload.session_id === sessionIdRef.current) {
        terminal.write(event.payload.data);
      }
    });
    unlistenOutputRef.current = unlistenOutput;

    // Listen for PTY exit
    const unlistenExit = await listen<PtyExit>("pty-exit", (event) => {
      if (event.payload.session_id === sessionIdRef.current) {
        terminal.write("\r\n\x1b[33m[Process exited]\x1b[0m\r\n");
        sessionIdRef.current = null;
        // Restart the session after a delay
        setTimeout(() => {
          createSession(terminal.cols, terminal.rows);
        }, PTY_RESTART_DELAY_MS);
      }
    });
    unlistenExitRef.current = unlistenExit;

    return () => {
      unlistenOutput();
      unlistenExit();
    };
  }, [terminal, createSession]);

  return {
    sessionIdRef,
    createSession,
    reuseSession,
    writeToSession,
    resizeSession,
    closeSession,
    setupListeners,
  };
}
