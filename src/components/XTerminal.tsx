"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

// Timing constants
/** Delay before restarting PTY session after process exit (ms) */
const PTY_RESTART_DELAY_MS = 1000;
/** Delay before focusing terminal after window focus - allows window to fully render (ms) */
const WINDOW_FOCUS_DELAY_MS = 50;

interface PtyOutput {
  session_id: string;
  data: string;
}

interface PtyExit {
  session_id: string;
  exit_code: number | null;
}

export default function XTerminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  const initTerminal = useCallback(async () => {
    if (!terminalRef.current || initializedRef.current) return;
    initializedRef.current = true;

    // Import Tauri APIs dynamically
    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");

    // Create terminal instance with One Dark Pro Vivid theme
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 13,
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: {
        // One Dark Pro Vivid theme with transparency
        background: "rgba(40, 44, 52, 0.92)",
        foreground: "#abb2bf",
        cursor: "#528bff",
        cursorAccent: "#282c34",
        selectionBackground: "rgba(62, 68, 81, 0.5)",
        selectionForeground: "#ffffff",
        // Vivid colors
        black: "#282c34",
        red: "#ef596f",         // Vivid red
        green: "#89ca78",       // Vivid green
        yellow: "#e5c07b",      // Yellow
        blue: "#52adf2",        // Vivid blue
        magenta: "#d55fde",     // Vivid magenta/purple
        cyan: "#2bbac5",        // Vivid cyan
        white: "#abb2bf",       // Default text
        brightBlack: "#5c6370", // Comments/dimmed
        brightRed: "#ef596f",
        brightGreen: "#89ca78",
        brightYellow: "#e5c07b",
        brightBlue: "#52adf2",
        brightMagenta: "#d55fde",
        brightCyan: "#2bbac5",
        brightWhite: "#ffffff",
      },
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Get terminal dimensions
    const cols = terminal.cols;
    const rows = terminal.rows;

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
          createSession(cols, rows);
        }, PTY_RESTART_DELAY_MS);
      }
    });
    unlistenExitRef.current = unlistenExit;

    // Create PTY session
    const createSession = async (c: number, r: number) => {
      try {
        const sessionId = await invoke<string>("create_pty_session", {
          cols: c,
          rows: r,
        });
        sessionIdRef.current = sessionId;
      } catch (error) {
        terminal.write(`\x1b[31mFailed to create PTY session: ${error}\x1b[0m\r\n`);
      }
    };

    await createSession(cols, rows);

    // Handle user input
    terminal.onData(async (data) => {
      if (sessionIdRef.current) {
        try {
          await invoke("write_to_pty", {
            sessionId: sessionIdRef.current,
            data,
          });
        } catch (error) {
          console.error("Failed to write to PTY:", error);
        }
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = xtermRef.current!;
        if (sessionIdRef.current) {
          invoke("resize_pty", {
            sessionId: sessionIdRef.current,
            cols,
            rows,
          }).catch(console.error);
        }
      }
    };

    terminal.onResize(({ cols, rows }) => {
      if (sessionIdRef.current) {
        invoke("resize_pty", {
          sessionId: sessionIdRef.current,
          cols,
          rows,
        }).catch(console.error);
      }
    });

    // Setup resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    // Focus terminal
    terminal.focus();

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
      if (unlistenOutputRef.current) unlistenOutputRef.current();
      if (unlistenExitRef.current) unlistenExitRef.current();
      if (sessionIdRef.current) {
        invoke("close_pty_session", { sessionId: sessionIdRef.current }).catch(
          console.error
        );
        sessionIdRef.current = null;
      }
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    initTerminal().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [initTerminal]);

  // Handle window focus to focus terminal
  useEffect(() => {
    const handleFocus = () => {
      xtermRef.current?.focus();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Listen for Tauri window focus event to auto-focus terminal
  useEffect(() => {
    let unlistenFocus: (() => void) | undefined;

    const setupWindowListener = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const currentWindow = getCurrentWindow();

        unlistenFocus = await currentWindow.onFocusChanged(({ payload: focused }) => {
          if (focused && xtermRef.current) {
            // Small delay to ensure window is fully ready before focusing
            setTimeout(() => {
              xtermRef.current?.focus();
            }, WINDOW_FOCUS_DELAY_MS);
          }
        });
      } catch (error) {
        console.error("Failed to setup window focus listener:", error);
      }
    };

    setupWindowListener();

    return () => {
      if (unlistenFocus) unlistenFocus();
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      className="xterminal-container"
      onClick={() => xtermRef.current?.focus()}
    />
  );
}
