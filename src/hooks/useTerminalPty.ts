import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { PtyManager } from "@/lib/ptyManager";

export interface UseTerminalPtyOptions {
  terminal: Terminal | null;
  existingSessionId?: string | null;
  onSessionCreated?: (sessionId: string) => void;
}

/**
 * Hook for managing PTY session lifecycle
 * Handles session creation, reuse, and cleanup
 */
export function useTerminalPty({
  terminal,
  existingSessionId,
  onSessionCreated,
}: UseTerminalPtyOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [ptyManager, setPtyManager] = useState<PtyManager | null>(null);
  const ptyManagerRef = useRef<PtyManager | null>(null);
  const existingSessionIdRef = useRef(existingSessionId);
  const onSessionCreatedRef = useRef(onSessionCreated);

  // Keep callback ref up to date
  useEffect(() => {
    onSessionCreatedRef.current = onSessionCreated;
  }, [onSessionCreated]);

  useEffect(() => {
    if (!terminal) return;

    let isMounted = true;

    const initPty = async () => {
      // Create PTY manager
      const manager = new PtyManager({
        terminal,
        onSessionCreated: (sid) => {
          if (!isMounted) return;
          setSessionId(sid);
          onSessionCreatedRef.current?.(sid);
        },
      });

      ptyManagerRef.current = manager;
      setPtyManager(manager);

      // Ensure PTY is ready
      await manager.ensureReady();

      // Setup listeners
      const cleanupListeners = await manager.setupListeners();

      if (!isMounted) {
        cleanupListeners();
        await manager.close();
        return;
      }

      // Create or reuse session
      const cols = terminal.cols;
      const rows = terminal.rows;

      if (existingSessionIdRef.current) {
        await manager.reuseSession(existingSessionIdRef.current, cols, rows);
      } else {
        await manager.createSession(cols, rows);
      }

      if (isMounted) {
        setIsReady(true);
      }

      // Return cleanup function
      return () => {
        cleanupListeners();
        manager.close().catch((error) => {
          console.error("[useTerminalPty] Failed to close PTY:", error);
        });
      };
    };

    const cleanupPromise = initPty();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => cleanup?.());
      ptyManagerRef.current = null;
      setPtyManager(null);
      setIsReady(false);
    };
  }, [terminal]);

  return {
    sessionId,
    isReady,
    ptyManager,
  };
}
