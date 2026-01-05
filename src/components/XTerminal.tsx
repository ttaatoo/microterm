import {
  DOUBLE_ESC_INTERVAL_MS,
  ESC_KEY,
  MAX_PTY_RETRIES,
  PTY_RESTART_DELAY_MS,
  PTY_RETRY_DELAY_MS,
} from "@/lib/constants";
import { loadSettings } from "@/lib/settings";
import { openUrl } from "@/lib/tauri";
import { useXTermSearch, type XTermSearchOptions } from "@/hooks/useXTermSearch";
import { useTerminalFocus } from "@/hooks/useTerminalFocus";
import { useCwdPolling } from "@/hooks/useCwdPolling";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as styles from "./XTerminal.css";

// Re-export SearchOptions for external consumers
export type { XTermSearchOptions as SearchOptions };

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

export interface XTerminalHandle {
  search: (query: string, options?: XTermSearchOptions) => boolean;
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
  // DOM and xterm refs
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // PTY session refs
  const sessionIdRef = useRef<string | null>(null);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initializedRef = useRef(false);

  // Double-ESC and pin state
  const lastEscTimeRef = useRef<number>(0);
  const pinnedRef = useRef<boolean>(false);

  // State for hooks that need reactive values
  const [terminalInstance, setTerminalInstance] = useState<Terminal | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Use extracted hooks
  const { searchAddonRef, search, searchNext, searchPrevious, clearSearch } = useXTermSearch();

  useTerminalFocus({ terminal: terminalInstance, isVisible });

  useCwdPolling({
    sessionId,
    isVisible,
    onTitleChange,
  });

  // Expose search methods via ref
  useImperativeHandle(
    ref,
    () => ({
      search,
      searchNext,
      searchPrevious,
      clearSearch,
      focus: () => {
        xtermRef.current?.focus();
      },
    }),
    [search, searchNext, searchPrevious, clearSearch]
  );

  // Initialize and listen for pin state changes
  useEffect(() => {
    const settings = loadSettings();
    pinnedRef.current = settings.pinned ?? false;

    let unlistenFn: (() => void) | null = null;

    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const { isPinStatePayload } = await import("@/lib/guards");
        unlistenFn = await listen("pin-state-updated", (event) => {
          if (isPinStatePayload(event.payload)) {
            pinnedRef.current = event.payload.pinned;
          }
        });
      } catch (error) {
        console.error("[Pin] Failed to setup pin state listener:", error);
      }
    })();

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
      fitAddonRef.current?.fit();
    }
  }, [propFontSize]);

  // Main terminal initialization
  const initTerminal = useCallback(async () => {
    if (!terminalRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const [{ invoke }, { listen }] = await Promise.all([
      import("@tauri-apps/api/core"),
      import("@tauri-apps/api/event"),
    ]);

    const settings = loadSettings();
    const initialOpacity = propOpacity ?? settings.opacity;
    const initialFontSize = propFontSize ?? settings.fontSize ?? 13;

    // Create terminal instance
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

    // Setup addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon((event: MouseEvent, uri: string) => {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        openUrl(uri).catch((error) => {
          console.error("[WebLinks] Failed to open URL:", error);
        });
      }
    });
    const searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Store refs
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    setTerminalInstance(terminal);

    const cols = terminal.cols;
    const rows = terminal.rows;

    // Setup PTY listeners
    const unlistenOutput = await listen<PtyOutput>("pty-output", (event) => {
      if (event.payload.session_id === sessionIdRef.current) {
        terminal.write(event.payload.data);
      }
    });
    unlistenOutputRef.current = unlistenOutput;

    const unlistenExit = await listen<PtyExit>("pty-exit", (event) => {
      if (event.payload.session_id === sessionIdRef.current) {
        terminal.write("\r\n\x1b[33m[Process exited]\x1b[0m\r\n");
        sessionIdRef.current = null;
        setSessionId(null);
        setTimeout(() => {
          createSession(cols, rows);
        }, PTY_RESTART_DELAY_MS);
      }
    });
    unlistenExitRef.current = unlistenExit;

    // Create PTY session with retry logic
    const createSession = async (c: number, r: number, retryCount = 0): Promise<void> => {
      try {
        const newSessionId = await invoke<string>("create_pty_session", { cols: c, rows: r });
        sessionIdRef.current = newSessionId;
        setSessionId(newSessionId);
        onSessionCreated?.(newSessionId);
      } catch (error) {
        console.error("[PTY] Failed to create session:", error);
        terminal.write(`\x1b[31mFailed to create PTY session: ${error}\x1b[0m\r\n`);

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

    // Handle user input with double-ESC detection
    terminal.onData(async (data) => {
      // Inline double-ESC check (can't use hook due to closure)
      if (data === ESC_KEY) {
        const now = Date.now();
        const timeSinceLastEsc = now - lastEscTimeRef.current;
        lastEscTimeRef.current = now;

        if (timeSinceLastEsc < DOUBLE_ESC_INTERVAL_MS) {
          if (!pinnedRef.current) {
            try {
              await invoke("hide_window");
            } catch (error) {
              console.error("[Window] Failed to hide window:", error);
            }
          }
          lastEscTimeRef.current = 0;
          return;
        }
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

          const currentSession = sessionIdRef.current;
          sessionIdRef.current = null;
          setSessionId(null);

          if (currentSession) {
            try {
              await invoke("close_pty_session", { sessionId: currentSession });
            } catch {
              // Ignore close errors during reconnection
            }
          }

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

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);
    resizeObserverRef.current = resizeObserver;

    terminal.focus();

    // Cleanup function
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      unlistenOutputRef.current?.();
      unlistenOutputRef.current = null;
      unlistenExitRef.current?.();
      unlistenExitRef.current = null;
      if (sessionIdRef.current) {
        invoke("close_pty_session", { sessionId: sessionIdRef.current }).catch(console.error);
        sessionIdRef.current = null;
      }
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      setTerminalInstance(null);
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
      cleanup?.();
    };
  }, [initTerminal]);

  // Re-fit terminal when becoming visible
  useEffect(() => {
    if (isVisible && xtermRef.current && fitAddonRef.current && terminalRef.current) {
      const fitTerminal = async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));

        if (!fitAddonRef.current || !xtermRef.current || !terminalRef.current) return;

        fitAddonRef.current.fit();

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
      };

      fitTerminal();
    }
  }, [isVisible]);

  const handleContainerClick = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  return (
    <div
      ref={terminalRef}
      className={`${styles.xterminalContainer} ${isVisible ? styles.terminalVisible : styles.terminalHidden}`}
      onClick={handleContainerClick}
    />
  );
});

export default XTerminal;
