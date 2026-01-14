/**
 * React hook wrapper for PTY Session
 *
 * Provides a React-friendly interface to PtySession class.
 */

import { useCallback, useRef, useEffect } from "react";
import type { Terminal } from "@xterm/xterm";
import { PtySession, type PtySessionOptions } from "./session";

interface UsePtySessionOptions {
  terminal: Terminal | null;
  existingSessionId?: string | null;
  onSessionCreated?: (sessionId: string) => void;
  enableBuffering?: boolean;
  bufferFlushInterval?: number;
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
  enableBuffering,
  bufferFlushInterval,
}: UsePtySessionOptions): UsePtySessionReturn {
  const ptySessionRef = useRef<PtySession | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Initialize PtySession instance
  useEffect(() => {
    if (!terminal) return;

    const options: PtySessionOptions = {
      terminal,
      onSessionCreated: (id) => {
        sessionIdRef.current = id;
        onSessionCreated?.(id);
      },
      enableBuffering,
      bufferFlushInterval,
    };

    ptySessionRef.current = new PtySession(options);

    return () => {
      ptySessionRef.current?.dispose();
      ptySessionRef.current = null;
    };
  }, [terminal, onSessionCreated, enableBuffering, bufferFlushInterval]);

  const createSession = useCallback(async (cols: number, rows: number): Promise<void> => {
    if (!ptySessionRef.current) return;
    await ptySessionRef.current.create(cols, rows);
    sessionIdRef.current = ptySessionRef.current.getSessionId();
  }, []);

  const reuseSession = useCallback(
    async (existingSessionId: string, cols: number, rows: number): Promise<void> => {
      if (!ptySessionRef.current) return;
      await ptySessionRef.current.reuse(existingSessionId, cols, rows);
      sessionIdRef.current = ptySessionRef.current.getSessionId();
    },
    []
  );

  const writeToSession = useCallback(async (data: string): Promise<void> => {
    if (!ptySessionRef.current) return;
    await ptySessionRef.current.write(data);
  }, []);

  const resizeSession = useCallback(async (cols: number, rows: number): Promise<void> => {
    if (!ptySessionRef.current) return;
    await ptySessionRef.current.resize(cols, rows);
  }, []);

  const closeSession = useCallback(async (): Promise<void> => {
    if (!ptySessionRef.current) return;
    await ptySessionRef.current.close();
    sessionIdRef.current = null;
  }, []);

  const setupListeners = useCallback(async (): Promise<() => void> => {
    if (!ptySessionRef.current) return () => {};
    return ptySessionRef.current.setupListeners();
  }, []);

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
