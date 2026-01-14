import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { getTerminalTheme } from "@/lib/terminal/theme";
import { setupTerminalAddons } from "@/lib/terminalAddons";
import { loadSettings } from "@/lib/settings";

export interface UseTerminalInstanceOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  paneId?: string;
  opacity?: number;
  fontSize?: number;
  onData?: (data: string) => void;
}

export interface TerminalInstance {
  terminal: Terminal;
  fitAddon: ReturnType<typeof setupTerminalAddons>["fitAddon"];
  searchAddon: ReturnType<typeof setupTerminalAddons>["searchAddon"];
  webglAddon: ReturnType<typeof setupTerminalAddons>["webglAddon"];
}

// Global cache for terminal instances by paneId
const terminalCache = new Map<string, TerminalInstance>();

/**
 * Cache monitoring configuration
 * Typical usage: max panes = tabs * splits (e.g., 10 tabs * 4 splits = 40 panes)
 */
const CACHE_SIZE_WARNING_THRESHOLD = 50;
const CACHE_SIZE_ERROR_THRESHOLD = 100;

/**
 * Log cache statistics for debugging and monitoring
 */
function logCacheStats(operation: "add" | "reuse" | "dispose", paneId: string): void {
  const size = terminalCache.size;
  const prefix = `[TerminalCache] ${operation}`;

  if (size >= CACHE_SIZE_ERROR_THRESHOLD) {
    console.error(`${prefix} paneId=${paneId} | CRITICAL: cache size=${size} (threshold=${CACHE_SIZE_ERROR_THRESHOLD})`);
  } else if (size >= CACHE_SIZE_WARNING_THRESHOLD) {
    console.warn(`${prefix} paneId=${paneId} | WARNING: cache size=${size} (threshold=${CACHE_SIZE_WARNING_THRESHOLD})`);
  } else {
    console.debug(`${prefix} paneId=${paneId} | cache size=${size}`);
  }
}

/**
 * Get current cache statistics for debugging
 */
export function getTerminalCacheStats(): { size: number; paneIds: string[] } {
  return {
    size: terminalCache.size,
    paneIds: Array.from(terminalCache.keys()),
  };
}

/**
 * Hook for creating and managing a Terminal instance
 * Handles terminal lifecycle, theming, and font size updates
 *
 * If paneId is provided, terminals are cached and reused across remounts
 * to preserve scrollback buffer and cursor state during pane splits
 */
export function useTerminalInstance({
  containerRef,
  paneId,
  opacity: propOpacity,
  fontSize: propFontSize,
  onData,
}: UseTerminalInstanceOptions) {
  const [instance, setInstance] = useState<TerminalInstance | null>(null);
  const initializedRef = useRef(false);

  // Capture initial values to avoid re-initialization on prop changes
  const initialOpacityRef = useRef(propOpacity);
  const initialFontSizeRef = useRef(propFontSize);

  // Initialize terminal once
  const initTerminal = useCallback(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    // Check if we have a cached terminal for this pane
    if (paneId && terminalCache.has(paneId)) {
      const cachedInstance = terminalCache.get(paneId)!;
      logCacheStats("reuse", paneId);

      const element = cachedInstance.terminal.element;

      // Reattach DOM element to new container
      if (element && element.parentElement !== containerRef.current) {
        containerRef.current.appendChild(element);
      }

      // Save current scroll position before any operations
      const savedScrollY = cachedInstance.terminal.buffer.active.viewportY;

      // Reinitialize WebGL if needed
      if (cachedInstance.webglAddon) {
        try {
          cachedInstance.webglAddon.dispose();
          const { webglAddon: newWebglAddon } = setupTerminalAddons(cachedInstance.terminal);
          cachedInstance.webglAddon = newWebglAddon;
        } catch (error) {
          console.warn("[useTerminalInstance] WebGL reinitialization failed, using canvas", error);
          cachedInstance.webglAddon = undefined;
        }
      }

      // Refresh and fit
      cachedInstance.terminal.refresh(0, cachedInstance.terminal.rows - 1);
      cachedInstance.fitAddon.fit();

      // Restore scroll position after refresh/fit
      // Use requestAnimationFrame to ensure operations are complete
      requestAnimationFrame(() => {
        cachedInstance.terminal.scrollToLine(savedScrollY);
      });

      setInstance(cachedInstance);
      return () => {
        // Don't dispose cached terminals on unmount
      };
    }

    const settings = loadSettings();
    const initialOpacity = initialOpacityRef.current ?? settings.opacity ?? 0.95;
    const initialFontSize = initialFontSizeRef.current ?? settings.fontSize ?? 13;

    // Create terminal with options
    const theme = getTerminalTheme(initialOpacity);

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: initialFontSize,
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.2,
      letterSpacing: 0,
      theme,
      allowTransparency: true,
      scrollback: 1000,
      scrollOnUserInput: false,
      scrollOnEraseInDisplay: false,
      fastScrollSensitivity: 10,
      smoothScrollDuration: 125,
    });

    // Setup addons
    const { fitAddon, searchAddon, webglAddon } = setupTerminalAddons(terminal);

    // Open terminal in container
    terminal.open(containerRef.current);
    fitAddon.fit();
    terminal.focus();

    // Register data handler if provided
    if (onData) {
      terminal.onData(onData);
    }

    const newInstance = { terminal, fitAddon, searchAddon, webglAddon };

    // Cache the terminal if paneId is provided
    if (paneId) {
      terminalCache.set(paneId, newInstance);
      logCacheStats("add", paneId);
    }

    setInstance(newInstance);

    return () => {
      // Only dispose if not cached or being explicitly removed
      if (!paneId) {
        webglAddon?.dispose();
        terminal.dispose();
      }
      setInstance(null);
      initializedRef.current = false;
    };
  }, [containerRef, paneId, onData]);

  // Initialize on mount
  useEffect(() => {
    const cleanup = initTerminal();
    return cleanup;
  }, [initTerminal]);

  // Update opacity when prop changes
  useEffect(() => {
    if (instance && propOpacity !== undefined) {
      // eslint-disable-next-line react-hooks/immutability
      instance.terminal.options.theme = getTerminalTheme(propOpacity);
      instance.terminal.refresh(0, instance.terminal.rows - 1);
    }
  }, [instance, propOpacity]);

  // Update font size when prop changes
  useEffect(() => {
    if (instance && propFontSize !== undefined) {
      // eslint-disable-next-line react-hooks/immutability
      instance.terminal.options.fontSize = propFontSize;
      instance.fitAddon.fit();
    }
  }, [instance, propFontSize]);

  return instance;
}

/**
 * Dispose a cached terminal instance when pane is permanently removed
 * This should be called from TerminalView when tracking pane removals
 */
export function disposeCachedTerminal(paneId: string): void {
  const instance = terminalCache.get(paneId);
  if (instance) {
    instance.webglAddon?.dispose();
    instance.terminal.dispose();
    terminalCache.delete(paneId);
    logCacheStats("dispose", paneId);
  }
}
