import { useCallback, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { PtyManager } from "@/lib/ptyManager";
import { DOUBLE_ESC_INTERVAL_MS, ESC_KEY } from "@/lib/constants";
import { loadSettings } from "@/lib/settings";
import { isPinStatePayload } from "@/lib/guards";

export interface UseTerminalInputOptions {
  terminal: Terminal | null;
  ptyManager: PtyManager | null;
  isPtyReady: boolean;
}

/**
 * Hook for handling terminal input
 * Manages double-ESC detection for hiding window and writing input to PTY
 */
export function useTerminalInput({
  terminal,
  ptyManager,
  isPtyReady,
}: UseTerminalInputOptions) {
  const lastEscTimeRef = useRef<number>(0);
  const pinnedRef = useRef<boolean>(false);
  const cachedInvokeRef = useRef<typeof import("@tauri-apps/api/core").invoke | null>(null);
  const inputBufferRef = useRef<string[]>([]);

  // Preload invoke function
  useEffect(() => {
    if ("__TAURI__" in window) {
      import("@/lib/tauri").then(({ getInvoke }) => {
        getInvoke().then((invoke) => {
          cachedInvokeRef.current = invoke;
        });
      });
    }
  }, []);

  // Load pin state and listen for changes
  useEffect(() => {
    const settings = loadSettings();
    pinnedRef.current = settings.pinned ?? false;

    let unlistenFn: (() => void) | null = null;
    let isMounted = true;

    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        if (!isMounted) return;

        unlistenFn = await listen("pin-state-updated", (event) => {
          if (isPinStatePayload(event.payload)) {
            pinnedRef.current = event.payload.pinned;
          }
        });
      } catch (error) {
        console.error("[useTerminalInput] Failed to setup pin state listener:", error);
      }
    })();

    return () => {
      isMounted = false;
      unlistenFn?.();
    };
  }, []);

  // Handle terminal data with double-ESC detection
  const handleData = useCallback(
    (data: string) => {
      // Double-ESC detection
      if (data === ESC_KEY) {
        const now = Date.now();
        const timeSinceLastEsc = now - lastEscTimeRef.current;
        lastEscTimeRef.current = now;

        if (timeSinceLastEsc < DOUBLE_ESC_INTERVAL_MS) {
          if (!pinnedRef.current) {
            const invoke = cachedInvokeRef.current;
            if (invoke) {
              invoke("hide_window").catch((error) => {
                console.error("[useTerminalInput] Failed to hide window:", error);
              });
            }
          }
          lastEscTimeRef.current = 0;
          return;
        }
      }

      // If PTY not ready, buffer the input
      if (!isPtyReady) {
        inputBufferRef.current.push(data);
        return;
      }

      // Write to PTY
      if (!ptyManager) {
        console.warn("[useTerminalInput] PTY manager not available, dropping input:", data);
        return;
      }

      const sessionId = ptyManager.getSessionId();
      if (!sessionId) {
        console.warn("[useTerminalInput] No session ID, dropping input:", data);
        return;
      }

      ptyManager.write(data).catch((error) => {
        console.error("[useTerminalInput] Failed to write to PTY:", error);
      });
    },
    [ptyManager, isPtyReady]
  );

  // Flush buffered input when PTY becomes ready
  useEffect(() => {
    if (isPtyReady && inputBufferRef.current.length > 0) {
      const bufferedData = inputBufferRef.current.join("");
      inputBufferRef.current = [];
      handleData(bufferedData);
    }
  }, [isPtyReady, handleData]);

  // Register terminal data handler
  useEffect(() => {
    if (!terminal) return;

    const disposable = terminal.onData(handleData);

    return () => {
      disposable.dispose();
    };
  }, [terminal, handleData]);

  return { handleData };
}
