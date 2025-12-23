"use client";

import { loadSettings } from "@/lib/settings";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useRef } from "react";

// Timing constants
/** Delay before restarting PTY session after process exit (ms) */
const PTY_RESTART_DELAY_MS = 1000;
/** Delay before focusing terminal after window focus - allows window to fully render (ms) */
const WINDOW_FOCUS_DELAY_MS = 50;
/** Maximum retry attempts for PTY session creation */
const MAX_PTY_RETRIES = 3;
/** Delay between PTY retry attempts (ms) */
const PTY_RETRY_DELAY_MS = 500;
/** Delay before focusing terminal after window becomes visible (ms) */
const WINDOW_VISIBLE_FOCUS_DELAY_MS = 100;
/** Maximum interval between double-ESC presses to trigger hide window (ms) */
const DOUBLE_ESC_INTERVAL_MS = 300;

// Key codes
const ESC_KEY = "\x1b";

/** Interval for polling current working directory (ms) */
const CWD_POLL_INTERVAL_MS = 1000;

/**
 * Extract directory name from full path
 * Returns the last component of the path (directory name)
 */
function extractDirName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "/";
}

// Base theme colors (One Dark Pro)
// https://github.com/Binaryify/OneDark-Pro
const BASE_THEME = {
  foreground: "#abb2bf",
  cursor: "#528bff",
  cursorAccent: "#282c34",
  selectionBackground: "#abb2bf30",
  selectionForeground: "#ffffff",
  black: "#3f4451",
  red: "#e05561",
  green: "#8cc265",
  yellow: "#d18f52",
  blue: "#4aa5f0",
  magenta: "#c162de",
  cyan: "#42b3c2",
  white: "#d7dae0",
  brightBlack: "#4f5666",
  brightRed: "#ff616e",
  brightGreen: "#a5e075",
  brightYellow: "#f0a45d",
  brightBlue: "#4dc4ff",
  brightMagenta: "#de73ff",
  brightCyan: "#4cd1e0",
  brightWhite: "#e6e6e6",
};

interface PtyOutput {
  session_id: string;
  data: string;
}

interface PtyExit {
  session_id: string;
  exit_code: number | null;
}

interface XTerminalProps {
  opacity?: number;
  fontSize?: number;
  tabId?: string;
  isVisible?: boolean;
  onSessionCreated?: (sessionId: string) => void;
  onTitleChange?: (title: string) => void;
}

export default function XTerminal({
  opacity: propOpacity,
  fontSize: propFontSize,
  tabId: _tabId,
  isVisible = true,
  onSessionCreated,
  onTitleChange,
}: XTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initializedRef = useRef(false);
  const lastEscTimeRef = useRef<number>(0);

  // Update terminal background when opacity changes
  useEffect(() => {
    if (xtermRef.current && propOpacity !== undefined) {
      xtermRef.current.options.theme = {
        ...BASE_THEME,
        background: `rgba(0, 0, 0, ${propOpacity})`,
      };
    }
  }, [propOpacity]);

  // Update terminal font size when prop changes
  useEffect(() => {
    if (xtermRef.current && propFontSize !== undefined) {
      xtermRef.current.options.fontSize = propFontSize;
      // Refit terminal to adjust for new font size
      fitAddonRef.current?.fit();
    }
  }, [propFontSize]);

  const initTerminal = useCallback(async () => {
    if (!terminalRef.current || initializedRef.current) return;
    initializedRef.current = true;

    // Import Tauri APIs dynamically
    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");

    // Load saved settings for initial opacity and font size
    const settings = loadSettings();
    const initialOpacity = propOpacity ?? settings.opacity;
    const initialFontSize = propFontSize ?? settings.fontSize ?? 13;

    // Create terminal instance with One Dark Pro Vivid theme
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: initialFontSize,
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: {
        ...BASE_THEME,
        background: `rgba(0, 0, 0, ${initialOpacity})`,
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

    // Create PTY session with retry logic
    const createSession = async (c: number, r: number, retryCount = 0): Promise<void> => {
      try {
        const sessionId = await invoke<string>("create_pty_session", {
          cols: c,
          rows: r,
        });
        sessionIdRef.current = sessionId;
        onSessionCreated?.(sessionId);
      } catch (error) {
        console.error("[PTY] Failed to create session:", error);
        terminal.write(`\x1b[31mFailed to create PTY session: ${error}\x1b[0m\r\n`);

        // Retry logic
        if (retryCount < MAX_PTY_RETRIES) {
          const nextRetry = retryCount + 1;
          terminal.write(`\x1b[33mRetrying... (${nextRetry}/${MAX_PTY_RETRIES})\x1b[0m\r\n`);
          await new Promise((resolve) => setTimeout(resolve, PTY_RETRY_DELAY_MS * nextRetry));
          return createSession(c, r, nextRetry);
        } else {
          terminal.write(
            `\x1b[31mFailed to create terminal after ${MAX_PTY_RETRIES} attempts.\x1b[0m\r\n`
          );
          terminal.write(`\x1b[33mPlease restart the application.\x1b[0m\r\n`);
        }
      }
    };

    await createSession(cols, rows);

    // Handle user input
    terminal.onData(async (data) => {
      // Double-ESC to hide window, single ESC passes through to PTY
      if (data === ESC_KEY) {
        const now = Date.now();
        const timeSinceLastEsc = now - lastEscTimeRef.current;
        lastEscTimeRef.current = now;

        if (timeSinceLastEsc < DOUBLE_ESC_INTERVAL_MS) {
          // Double ESC detected - hide window
          try {
            await invoke("hide_window");
          } catch (error) {
            console.error("[Window] Failed to hide window:", error);
          }
          // Reset to prevent triple-ESC from triggering again
          lastEscTimeRef.current = 0;
          return;
        }
        // Single ESC - fall through to send to PTY
      }

      if (sessionIdRef.current) {
        try {
          await invoke("write_to_pty", {
            sessionId: sessionIdRef.current,
            data,
          });
        } catch (error) {
          console.error("[PTY] Write failed:", error);
          terminal.write("\r\n\x1b[31m[Connection lost. Attempting to reconnect...]\x1b[0m\r\n");

          // Trigger reconnection
          const currentSession = sessionIdRef.current;
          sessionIdRef.current = null;

          // Try to close the old session gracefully
          if (currentSession) {
            try {
              await invoke("close_pty_session", { sessionId: currentSession });
            } catch {
              // Ignore close errors during reconnection
            }
          }

          // Create new session
          await createSession(terminal.cols, terminal.rows);
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
          }).catch((error) => {
            console.error("[PTY] Resize failed:", error);
          });
        }
      }
    };

    terminal.onResize(({ cols, rows }) => {
      if (sessionIdRef.current) {
        invoke("resize_pty", {
          sessionId: sessionIdRef.current,
          cols,
          rows,
        }).catch((error) => {
          console.error("[PTY] Resize failed:", error);
        });
      }
    });

    // Setup resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);
    resizeObserverRef.current = resizeObserver;

    // Focus terminal
    terminal.focus();

    // Cleanup function
    return () => {
      // Disconnect resize observer
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      // Clean up event listeners
      if (unlistenOutputRef.current) {
        unlistenOutputRef.current();
        unlistenOutputRef.current = null;
      }
      if (unlistenExitRef.current) {
        unlistenExitRef.current();
        unlistenExitRef.current = null;
      }
      // Close PTY session
      if (sessionIdRef.current) {
        invoke("close_pty_session", { sessionId: sessionIdRef.current }).catch(console.error);
        sessionIdRef.current = null;
      }
      // Dispose terminal
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Listen for toggle-window event to auto-focus terminal when shown via global shortcut
  useEffect(() => {
    let unlistenToggle: (() => void) | undefined;

    const setupToggleListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        unlistenToggle = await listen("toggle-window", () => {
          // Delay to ensure window is visible before focusing
          setTimeout(() => {
            xtermRef.current?.focus();
          }, WINDOW_VISIBLE_FOCUS_DELAY_MS);
        });
      } catch (error) {
        console.error("Failed to setup toggle-window listener:", error);
      }
    };

    setupToggleListener();

    return () => {
      if (unlistenToggle) unlistenToggle();
    };
  }, []);

  // Focus terminal and re-fit when becoming visible
  useEffect(() => {
    if (isVisible && xtermRef.current && fitAddonRef.current) {
      // Use requestAnimationFrame to ensure layout is complete before fitting
      // This prevents rendering issues when switching between tabs
      const fitTerminal = async () => {
        // Wait for next frame to ensure display:block has taken effect
        await new Promise((resolve) => requestAnimationFrame(resolve));
        // Wait another frame for layout to stabilize
        await new Promise((resolve) => requestAnimationFrame(resolve));

        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();

          // Also resize PTY to match new dimensions
          if (sessionIdRef.current) {
            const { cols, rows } = xtermRef.current;
            try {
              const { invoke } = await import("@tauri-apps/api/core");
              await invoke("resize_pty", {
                sessionId: sessionIdRef.current,
                cols,
                rows,
              });
            } catch (error) {
              console.error("[PTY] Resize on visibility change failed:", error);
            }
          }

          xtermRef.current.focus();
        }
      };

      fitTerminal();
    }
  }, [isVisible]);

  // Poll for current working directory changes
  useEffect(() => {
    if (!isVisible) return;

    let lastCwd = "";

    const pollCwd = async () => {
      if (!sessionIdRef.current) return;

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const cwd = await invoke<string | null>("get_pty_cwd", {
          sessionId: sessionIdRef.current,
        });

        if (cwd && cwd !== lastCwd) {
          lastCwd = cwd;
          const dirName = extractDirName(cwd);
          onTitleChange?.(dirName);
        }
      } catch {
        // Session may have been closed, ignore errors
      }
    };

    // Poll immediately and then on interval
    pollCwd();
    const intervalId = setInterval(pollCwd, CWD_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isVisible, onTitleChange]);

  return (
    <div
      ref={terminalRef}
      className={`xterminal-container ${isVisible ? "terminal-visible" : "terminal-hidden"}`}
      onClick={() => xtermRef.current?.focus()}
    />
  );
}
