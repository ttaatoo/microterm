import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { getTerminalTheme } from "@/lib/terminal/theme";
import { setupTerminalAddons } from "@/lib/terminalAddons";
import { loadSettings } from "@/lib/settings";

export interface UseTerminalInstanceOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
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

/**
 * Hook for creating and managing a Terminal instance
 * Handles terminal lifecycle, theming, and font size updates
 */
export function useTerminalInstance({
  containerRef,
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

    const settings = loadSettings();
    const initialOpacity = initialOpacityRef.current ?? settings.opacity ?? 0.95;
    const initialFontSize = initialFontSizeRef.current ?? settings.fontSize ?? 13;

    // Create terminal with options
    const theme = getTerminalTheme(initialOpacity);
    console.log("[Terminal] Initializing with theme:", theme);
    console.log("[Terminal] Opacity:", initialOpacity, "Font size:", initialFontSize);

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

    setInstance({ terminal, fitAddon, searchAddon, webglAddon });

    return () => {
      // Cleanup
      webglAddon?.dispose();
      terminal.dispose();
      setInstance(null);
      initializedRef.current = false;
    };
  }, [containerRef, onData]);

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
