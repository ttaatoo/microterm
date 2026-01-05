import {
  CWD_POLL_INTERVAL_MS,
  DOUBLE_ESC_INTERVAL_MS,
  ESC_KEY,
  MAX_PTY_RETRIES,
  PTY_RESTART_DELAY_MS,
  PTY_RETRY_DELAY_MS,
  WINDOW_FOCUS_DELAY_MS,
  WINDOW_VISIBLE_FOCUS_DELAY_MS,
} from "@/lib/constants";
import { loadSettings } from "@/lib/settings";
import { openUrl } from "@/lib/tauri";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Extract directory name from full path
 * Returns the last component of the path (directory name)
 * Optimized to avoid array allocation
 */
function extractDirName(path: string): string {
  if (!path || path === "/") return "/";
  // Remove trailing slash if present
  const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;
  const lastSlash = cleanPath.lastIndexOf("/");
  return lastSlash === -1 ? cleanPath : cleanPath.slice(lastSlash + 1) || "/";
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

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

export interface XTerminalHandle {
  search: (query: string, options?: SearchOptions) => boolean;
  searchNext: () => boolean;
  searchPrevious: () => boolean;
  clearSearch: () => void;
  focus: () => void;
}

const XTerminal = forwardRef<XTerminalHandle, XTerminalProps>(function XTerminal(
  {
    opacity: propOpacity,
    fontSize: propFontSize,
    tabId: _tabId,
    isVisible = true,
    onSessionCreated,
    onTitleChange,
  },
  ref
) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initializedRef = useRef(false);
  const lastEscTimeRef = useRef<number>(0);
  // Reactive pin state ref - updated via event listener (M5 fix)
  const pinnedRef = useRef<boolean>(false);

  // Store current search query for next/previous navigation
  const currentSearchQueryRef = useRef<string>("");
  const currentSearchOptionsRef = useRef<SearchOptions>({});

  // Expose search methods via ref
  useImperativeHandle(
    ref,
    () => ({
      search: (query: string, options?: SearchOptions) => {
        if (!searchAddonRef.current) {
          return false;
        }
        if (!query) {
          searchAddonRef.current.clearDecorations();
          currentSearchQueryRef.current = "";
          return false;
        }
        // Store for next/previous
        currentSearchQueryRef.current = query;
        currentSearchOptionsRef.current = options ?? {};

        return searchAddonRef.current.findNext(query, {
          caseSensitive: options?.caseSensitive,
          wholeWord: options?.wholeWord,
          regex: options?.regex,
          incremental: true,
        });
      },
      searchNext: () => {
        if (!searchAddonRef.current || !currentSearchQueryRef.current) {
          return false;
        }
        const opts = currentSearchOptionsRef.current;
        return searchAddonRef.current.findNext(currentSearchQueryRef.current, {
          caseSensitive: opts.caseSensitive,
          wholeWord: opts.wholeWord,
          regex: opts.regex,
          incremental: false,
        });
      },
      searchPrevious: () => {
        if (!searchAddonRef.current || !currentSearchQueryRef.current) {
          return false;
        }
        const opts = currentSearchOptionsRef.current;
        return searchAddonRef.current.findPrevious(currentSearchQueryRef.current, {
          caseSensitive: opts.caseSensitive,
          wholeWord: opts.wholeWord,
          regex: opts.regex,
          incremental: false,
        });
      },
      clearSearch: () => {
        searchAddonRef.current?.clearDecorations();
        currentSearchQueryRef.current = "";
      },
      focus: () => {
        xtermRef.current?.focus();
      },
    }),
    []
  );

  // Initialize and listen for pin state changes (M5 fix - reactive pin state)
  useEffect(() => {
    // Initialize from settings
    const settings = loadSettings();
    pinnedRef.current = settings.pinned ?? false;

    // Listen for pin state updates
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlistenFn = await listen<{ pinned: boolean }>("pin-state-updated", (event) => {
          if (typeof event.payload?.pinned === "boolean") {
            pinnedRef.current = event.payload.pinned;
          }
        });
      } catch (error) {
        console.error("[Pin] Failed to setup pin state listener:", error);
      }
    };

    setupListener();

    return () => {
      unlistenFn?.();
    };
  }, []);

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

    // Import Tauri APIs dynamically in parallel for faster startup
    const [{ invoke }, { listen }] = await Promise.all([
      import("@tauri-apps/api/core"),
      import("@tauri-apps/api/event"),
    ]);

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
      scrollback: 5000,
      fastScrollSensitivity: 10,
      smoothScrollDuration: 125,
    });

    const fitAddon = new FitAddon();
    // Configure WebLinksAddon with custom handler for cmd+click
    // The handler receives (event, uri) and is called when a link is clicked
    const webLinksAddon = new WebLinksAddon((event: MouseEvent, uri: string) => {
      // For cmd+click, open in system browser
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        console.log("[WebLinks] Opening URL in system browser:", uri);
        openUrl(uri).catch((error) => {
          console.error("[WebLinks] Failed to open URL:", error);
        });
        return;
      }
      // For regular clicks, let the default behavior happen (WebLinksAddon will open in new tab)
      // We don't need to do anything here, WebLinksAddon handles it
    });
    const searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

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
          // Double ESC detected - check pin status before hiding (M5 fix - use reactive ref)
          if (!pinnedRef.current) {
            // Only hide if not pinned
            try {
              await invoke("hide_window");
            } catch (error) {
              console.error("[Window] Failed to hide window:", error);
            }
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
    // Dependencies intentionally empty: initTerminal should only run once on mount.
    // All mutable state is accessed via refs (sessionIdRef, xtermRef, etc.) which are stable.
    // Re-running this would recreate the terminal and PTY session unnecessarily.
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

  // Memoize click handler to avoid creating new function on each render
  const handleContainerClick = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  return (
    <div
      ref={terminalRef}
      className={`xterminal-container ${isVisible ? "terminal-visible" : "terminal-hidden"}`}
      onClick={handleContainerClick}
    />
  );
});

export default XTerminal;
