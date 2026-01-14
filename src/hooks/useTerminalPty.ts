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

  /**
   * Mount counter to force PTY initialization on every component mount.
   *
   * Critical for cached terminal reuse: When a terminal is cached (useTerminalInstance
   * with paneId), the same Terminal instance may be reused across component unmount/remount
   * cycles (e.g., during pane splits). Without this counter, React would see the same
   * terminal reference and skip re-running the PTY initialization effect, leaving the
   * component without a working PTY connection.
   *
   * By including mountKey in the effect dependencies, we ensure PTY setup runs on:
   * 1. Initial mount (mountKey = 1)
   * 2. Terminal change (new terminal instance)
   * 3. Component remount with cached terminal (mountKey increments, same terminal)
   *
   * This allows seamless PTY reconnection when panes are split/reorganized while
   * preserving terminal scrollback and cursor state.
   */
  const [mountKey, setMountKey] = useState(0);

  // Increment mount key on each mount to force PTY initialization
  useEffect(() => {
    setMountKey((prev) => prev + 1);
  }, []);

  // Keep refs up to date
  useEffect(() => {
    existingSessionIdRef.current = existingSessionId;
  }, [existingSessionId]);

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
        // Don't close the PTY session on unmount - it may be reused by a remounted component
        // The session will be closed explicitly when the pane is removed from the tree
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
  }, [terminal, mountKey]);

  return {
    sessionId,
    isReady,
    ptyManager,
  };
}
