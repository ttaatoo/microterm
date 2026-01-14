/**
 * PTY session management utilities
 * Non-hook version for use in component initialization
 */

import { MAX_PTY_RETRIES, PTY_RESTART_DELAY_MS, PTY_RETRY_DELAY_MS } from "@/lib/constants";
import { ensureValidDimensions } from "@/lib/ptyUtils";
import type { Terminal } from "@xterm/xterm";

interface PtyOutput {
  session_id: string;
  data: string;
}

interface PtyExit {
  session_id: string;
  exit_code: number | null;
}

// Type guards for runtime validation of IPC payloads
function isPtyOutput(payload: unknown): payload is PtyOutput {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "session_id" in payload &&
    "data" in payload &&
    typeof (payload as PtyOutput).session_id === "string" &&
    typeof (payload as PtyOutput).data === "string"
  );
}

function isPtyExit(payload: unknown): payload is PtyExit {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "session_id" in payload &&
    "exit_code" in payload &&
    typeof (payload as PtyExit).session_id === "string" &&
    ((payload as PtyExit).exit_code === null || typeof (payload as PtyExit).exit_code === "number")
  );
}

export interface PtyManagerOptions {
  terminal: Terminal;
  onSessionCreated?: (sessionId: string) => void;
}

// Data buffering constants (matches VSCode's approach)
const DATA_BUFFER_THROTTLE_MS = 5;

export class PtyManager {
  private terminal: Terminal;
  private sessionId: string | null = null;
  private unlistenOutput: (() => void) | null = null;
  private unlistenExit: (() => void) | null = null;
  private onSessionCreated?: (sessionId: string) => void;
  private isReconnecting = false;
  private isDestroyed = false; // Prevent write-after-dispose race condition

  // Data buffering for smoother rendering
  private dataBuffer: string[] = [];
  private bufferTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Cached invoke function to avoid repeated imports
  private cachedInvoke: typeof import("@tauri-apps/api/core").invoke | null = null;
  private preloadPromise: Promise<void> | null = null;

  constructor({ terminal, onSessionCreated }: PtyManagerOptions) {
    this.terminal = terminal;
    this.onSessionCreated = onSessionCreated;
    // Start preload immediately but store promise for await later
    this.preloadPromise = this.preloadInvoke();
  }

  // Preload invoke function to avoid delay on first write
  private async preloadInvoke(): Promise<void> {
    try {
      const { getInvoke } = await import("@/lib/tauri");
      this.cachedInvoke = await getInvoke();
    } catch (error) {
      console.warn("[PTY] Failed to preload invoke:", error);
    }
  }

  // Ensure preload is complete before first use
  async ensureReady(): Promise<void> {
    if (this.preloadPromise) {
      await this.preloadPromise;
      this.preloadPromise = null;
    }

    // Verify cache was actually loaded (preload might have failed silently)
    if (!this.cachedInvoke) {
      console.warn("[PTY] Preload didn't cache invoke, loading now...");
      try {
        const { getInvoke } = await import("@/lib/tauri");
        this.cachedInvoke = await getInvoke();
      } catch (error) {
        console.error("[PTY] Failed to load invoke in ensureReady:", error);
        throw error; // Don't start accepting input if this fails
      }
    }
  }

  /**
   * Buffer PTY output data and flush after a short delay.
   * This provides smoother rendering by batching rapid updates.
   */
  private bufferData(data: string): void {
    this.dataBuffer.push(data);

    // If no flush scheduled, schedule one
    if (this.bufferTimeoutId === null) {
      this.bufferTimeoutId = setTimeout(() => {
        this.flushBuffer();
      }, DATA_BUFFER_THROTTLE_MS);
    }
  }

  private flushBuffer(): void {
    // Clear timeout first to prevent concurrent flush attempts
    if (this.bufferTimeoutId !== null) {
      clearTimeout(this.bufferTimeoutId);
      this.bufferTimeoutId = null;
    }

    // Don't write if terminal is destroyed
    if (this.isDestroyed) {
      this.dataBuffer.length = 0;
      return;
    }

    if (this.dataBuffer.length > 0) {
      const combinedData = this.dataBuffer.join("");
      // Clear buffer using length = 0 to maintain reference
      this.dataBuffer.length = 0;
      try {
        this.terminal.write(combinedData);
      } catch (error) {
        console.error("[PTY] Failed to write buffered data to terminal:", error);
      }
    }
  }

  async createSession(cols: number, rows: number, retryCount = 0): Promise<void> {
    const { cols: validCols, rows: validRows } = ensureValidDimensions(cols, rows);

    try {
      // Use cached invoke if available, otherwise load it
      let invoke = this.cachedInvoke;
      if (!invoke) {
        const { getInvoke } = await import("@/lib/tauri");
        invoke = await getInvoke();
        this.cachedInvoke = invoke;
      }
      const sessionId = await invoke<string>("create_pty_session", {
        cols: validCols,
        rows: validRows,
      });
      this.sessionId = sessionId;
      this.onSessionCreated?.(sessionId);
    } catch (error) {
      console.error("[PTY] Failed to create session:", error);
      this.terminal.write(`\x1b[31mFailed to create PTY session: ${error}\x1b[0m\r\n`);

      if (retryCount < MAX_PTY_RETRIES) {
        const nextRetry = retryCount + 1;
        this.terminal.write(`\x1b[33mRetrying... (${nextRetry}/${MAX_PTY_RETRIES})\x1b[0m\r\n`);
        await new Promise((resolve) => setTimeout(resolve, PTY_RETRY_DELAY_MS * nextRetry));
        return this.createSession(cols, rows, nextRetry);
      } else {
        this.terminal.write(
          `\x1b[31mFailed to create terminal after ${MAX_PTY_RETRIES} attempts.\x1b[0m\r\n`
        );
        this.terminal.write(`\x1b[33mPlease restart the application.\x1b[0m\r\n`);
      }
    }
  }

  async reuseSession(existingSessionId: string, cols: number, rows: number): Promise<void> {
    this.sessionId = existingSessionId;
    const { cols: validCols, rows: validRows } = ensureValidDimensions(cols, rows);

    try {
      // Use cached invoke if available, otherwise load it
      let invoke = this.cachedInvoke;
      if (!invoke) {
        const { getInvoke } = await import("@/lib/tauri");
        invoke = await getInvoke();
        this.cachedInvoke = invoke;
      }
      await invoke("resize_pty", {
        sessionId: existingSessionId,
        cols: validCols,
        rows: validRows,
      });
    } catch (error) {
      console.warn("[PTY] Failed to resize existing session, creating new one:", error);
      await this.createSession(cols, rows);
    }
  }

  async write(data: string): Promise<void> {
    // Skip writes if no session or already reconnecting
    if (!this.sessionId || this.isReconnecting) return;

    try {
      // Use cached invoke if available, otherwise load it
      let invoke = this.cachedInvoke;
      if (!invoke) {
        const { getInvoke } = await import("@/lib/tauri");
        invoke = await getInvoke();
        this.cachedInvoke = invoke;
      }
      await invoke("write_to_pty", {
        sessionId: this.sessionId,
        data,
      });
    } catch (error) {
      console.error("[PTY] Write failed:", error);

      // Prevent concurrent reconnection attempts
      if (this.isReconnecting) return;
      this.isReconnecting = true;

      this.terminal.write("\r\n\x1b[31m[Connection lost. Attempting to reconnect...]\x1b[0m\r\n");

      const currentSession = this.sessionId;
      this.sessionId = null;

      if (currentSession) {
        try {
          let invoke = this.cachedInvoke;
          if (!invoke) {
            const { getInvoke } = await import("@/lib/tauri");
            invoke = await getInvoke();
            this.cachedInvoke = invoke;
          }
          await invoke("close_pty_session", { sessionId: currentSession });
        } catch {
          // Ignore close errors during reconnection
        }
      }

      try {
        await this.createSession(this.terminal.cols, this.terminal.rows);
      } catch (reconnectError) {
        console.error("[PTY] Reconnection failed:", reconnectError);
        this.terminal.write(
          "\r\n\x1b[31m[Reconnection failed. Please restart the terminal.]\x1b[0m\r\n"
        );
      } finally {
        this.isReconnecting = false;
      }
    }
  }

  async resize(cols: number, rows: number): Promise<void> {
    if (!this.sessionId) return;

    const { cols: validCols, rows: validRows } = ensureValidDimensions(cols, rows);

    try {
      // Use cached invoke if available, otherwise load it
      let invoke = this.cachedInvoke;
      if (!invoke) {
        const { getInvoke } = await import("@/lib/tauri");
        invoke = await getInvoke();
        this.cachedInvoke = invoke;
      }
      await invoke("resize_pty", {
        sessionId: this.sessionId,
        cols: validCols,
        rows: validRows,
      });
    } catch (error) {
      console.error("[PTY] Resize failed:", error);
    }
  }

  async setupListeners(): Promise<() => void> {
    // Use cached listen from tauri.ts if available
    const { getListen } = await import("@/lib/tauri");
    const listen = await getListen();

    const unlistenOutput = await listen("pty-output", (event) => {
      if (!isPtyOutput(event.payload)) {
        console.error("[PTY] Invalid pty-output payload:", event.payload);
        return;
      }
      if (event.payload.session_id === this.sessionId) {
        // Use buffered write for smoother rendering with cursor-heavy tools
        this.bufferData(event.payload.data);
      }
    });
    this.unlistenOutput = unlistenOutput;

    const unlistenExit = await listen("pty-exit", (event) => {
      if (!isPtyExit(event.payload)) {
        console.error("[PTY] Invalid pty-exit payload:", event.payload);
        return;
      }
      if (event.payload.session_id === this.sessionId) {
        // Check if terminal is destroyed before writing
        if (!this.isDestroyed) {
          this.terminal.write("\r\n\x1b[33m[Process exited]\x1b[0m\r\n");
        }
        this.sessionId = null;
        // Only restart if not destroyed
        if (!this.isDestroyed) {
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.createSession(this.terminal.cols, this.terminal.rows);
            }
          }, PTY_RESTART_DELAY_MS);
        }
      }
    });
    this.unlistenExit = unlistenExit;

    return () => {
      unlistenOutput();
      unlistenExit();
    };
  }

  async close(): Promise<void> {
    // Mark as destroyed to prevent any further writes
    this.isDestroyed = true;

    // Flush any remaining buffered data before cleanup
    // Wrap in try-catch to handle terminal already disposed
    try {
      this.flushBuffer();
    } catch (error) {
      console.error("[PTY] Failed to flush buffer during close:", error);
    }

    // Unregister listeners
    this.unlistenOutput?.();
    this.unlistenOutput = null;
    this.unlistenExit?.();
    this.unlistenExit = null;

    if (this.sessionId) {
      try {
        let invoke = this.cachedInvoke;
        if (!invoke) {
          const { getInvoke } = await import("@/lib/tauri");
          invoke = await getInvoke();
          this.cachedInvoke = invoke;
        }
        await invoke("close_pty_session", { sessionId: this.sessionId });
      } catch (error) {
        console.error("[PTY] Close failed:", error);
      }
      this.sessionId = null;
    }
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}
