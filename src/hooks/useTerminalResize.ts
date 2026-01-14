import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { PtyManager } from "@/lib/ptyManager";
import type { setupTerminalAddons } from "@/lib/terminalAddons";

export interface UseTerminalResizeOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  terminal: Terminal | null;
  fitAddon: ReturnType<typeof setupTerminalAddons>["fitAddon"] | null;
  ptyManager: PtyManager | null;
  isVisible?: boolean;
}

/**
 * Hook for handling terminal resizing
 * Manages ResizeObserver and fits terminal when container or visibility changes
 */
export function useTerminalResize({
  containerRef,
  terminal,
  fitAddon,
  ptyManager,
  isVisible = true,
}: UseTerminalResizeOptions) {
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Setup ResizeObserver
  useEffect(() => {
    if (!containerRef.current || !terminal || !fitAddon) return;

    const handleResize = () => {
      if (!fitAddon || !terminal || !ptyManager) return;
      fitAddon.fit();
      const { cols, rows } = terminal;
      ptyManager.resize(cols, rows);
    };

    // Also listen to terminal's own resize event
    const disposeResizeListener = terminal.onResize(({ cols, rows }) => {
      if (ptyManager) {
        ptyManager.resize(cols, rows);
      }
    });

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    resizeObserverRef.current = resizeObserver;

    return () => {
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
      disposeResizeListener.dispose();
    };
  }, [containerRef, terminal, fitAddon, ptyManager]);

  // Re-fit when becoming visible
  useEffect(() => {
    if (!isVisible || !terminal || !fitAddon || !containerRef.current) return;

    const fitTerminal = async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));

      if (!fitAddon || !terminal || !containerRef.current) return;

      fitAddon.fit();

      if (ptyManager && ptyManager.getSessionId()) {
        const { cols, rows } = terminal;
        await ptyManager.resize(cols, rows);
      }
    };

    fitTerminal();
  }, [isVisible, terminal, fitAddon, ptyManager, containerRef]);
}
