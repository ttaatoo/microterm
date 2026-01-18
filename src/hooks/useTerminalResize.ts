import { PtyManager } from "@/lib/ptyManager";
import { checkTauriAvailable, listen } from "@/lib/tauri/preload";
import type { setupTerminalAddons } from "@/lib/terminalAddons";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";

export interface UseTerminalResizeOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  terminal: Terminal | null;
  fitAddon: ReturnType<typeof setupTerminalAddons>["fitAddon"] | null;
  ptyManager: PtyManager | null;
  isVisible?: boolean;
  /**
   * Terminal instance with disableLayout flag.
   * When disableLayout is true, resize operations are skipped.
   */
  terminalInstance?: { disableLayout: boolean } | null;
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
  terminalInstance = null,
}: UseTerminalResizeOptions) {
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [windowVisible, setWindowVisible] = useState(() => !checkTauriAvailable());
  const lastMeasuredSizeRef = useRef<{ width: number; height: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Listen for native window visibility changes (Tauri only)
  useEffect(() => {
    if (!checkTauriAvailable()) return;

    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        unlisten = await listen<boolean>("window-visibility", (event) => {
          setWindowVisible(event.payload);
        });
      } catch (error) {
        console.error("Failed to listen for window visibility:", error);
      }
    };

    setupListener();

    return () => {
      unlisten?.();
    };
  }, []);

  const scheduleFit = (reason: string) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;

      // Skip resize if layout is disabled (e.g., during split pane operations)
      // This prevents scroll position jumps by avoiding fit operations when the DOM is being manipulated
      if (terminalInstance?.disableLayout) {
        return;
      }

      if (!windowVisible || !terminal || !fitAddon || !ptyManager || !containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      if (width <= 0 || height <= 0) {
        scheduleFit(`${reason}:zero-size`);
        return;
      }

      const last = lastMeasuredSizeRef.current;
      if (!last || last.width !== width || last.height !== height) {
        lastMeasuredSizeRef.current = { width, height };
        scheduleFit(`${reason}:stabilizing`);
        return;
      }

      fitAddon.fit();
      const { cols, rows } = terminal;
      ptyManager.resize(cols, rows);
    });
  };

  // Setup ResizeObserver
  useEffect(() => {
    if (!containerRef.current || !terminal || !fitAddon) return;

    const handleResize = () => {
      if (!windowVisible || !terminal || !fitAddon || !ptyManager) return;
      lastMeasuredSizeRef.current = null;
      scheduleFit("resize-observer");
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
  }, [containerRef, terminal, fitAddon, ptyManager, windowVisible]);

  // Re-fit when becoming visible
  useEffect(() => {
    if (!isVisible || !windowVisible || !terminal || !fitAddon || !ptyManager) return;
    lastMeasuredSizeRef.current = null;
    scheduleFit("visible-change");
  }, [isVisible, windowVisible, terminal, fitAddon, ptyManager]);
}
