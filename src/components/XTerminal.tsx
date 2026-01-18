import { useCwdPolling } from "@/hooks/useCwdPolling";
import { useTerminalFocus } from "@/hooks/useTerminalFocus";
import { useTerminalInput } from "@/hooks/useTerminalInput";
import { useTerminalInstance } from "@/hooks/useTerminalInstance";
import { useTerminalKeyboard } from "@/hooks/useTerminalKeyboard";
import { useTerminalPty } from "@/hooks/useTerminalPty";
import { useTerminalResize } from "@/hooks/useTerminalResize";
import { useXTermSearch, type XTermSearchOptions } from "@/hooks/useXTermSearch";
import "@xterm/xterm/css/xterm.css";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as styles from "./XTerminal.css";

export type { XTermSearchOptions as SearchOptions };

interface XTerminalProps {
  opacity?: number;
  fontSize?: number;
  tabId?: string;
  paneId?: string;
  existingSessionId?: string | null;
  isVisible?: boolean;
  isActivePane?: boolean;
  onSessionCreated?: (sessionId: string) => void;
  onTitleChange?: (title: string) => void;
  onClick?: () => void;
}

export interface XTerminalHandle {
  search: (query: string, options?: XTermSearchOptions) => boolean;
  searchNext: () => boolean;
  searchPrevious: () => boolean;
  clearSearch: () => void;
  focus: () => void;
  /**
   * Get the underlying terminal instance.
   * Used by split pane operations to control layout behavior.
   */
  getTerminalInstance: () => { disableLayout: boolean } | null;
  /**
   * Set the disableLayout flag on the terminal instance.
   * Used to prevent scroll position jumps during split operations.
   */
  setDisableLayout: (disabled: boolean) => void;
}

/**
 * XTerminal - A React component wrapping xterm.js with PTY integration
 *
 * This component is now refactored to be testable and follow best practices:
 * - Each concern is extracted into a custom hook
 * - Dependencies can be mocked for testing
 * - Component focuses on composition and rendering
 * - Side effects are isolated and explicit
 */
const XTerminalInner = forwardRef<XTerminalHandle, XTerminalProps>(function XTerminal(
  {
    opacity,
    fontSize,
    tabId: _tabId,
    paneId,
    existingSessionId,
    isVisible = true,
    isActivePane = true,
    onSessionCreated,
    onTitleChange,
    onClick,
  },
  ref
) {
  // DOM ref
  const containerRef = useRef<HTMLDivElement>(null);

  // Terminal instance management
  const terminalInstance = useTerminalInstance({
    containerRef,
    paneId,
    opacity,
    fontSize,
  });

  // PTY session management
  const { sessionId, isReady: isPtyReady, ptyManager } = useTerminalPty({
    terminal: terminalInstance?.terminal ?? null,
    existingSessionId,
    onSessionCreated,
  });

  // Terminal input handling (with double-ESC detection)
  useTerminalInput({
    terminal: terminalInstance?.terminal ?? null,
    ptyManager,
    isPtyReady,
  });

  // Keyboard shortcuts (word movement)
  useTerminalKeyboard({
    terminal: terminalInstance?.terminal ?? null,
    ptyManager,
  });

  // Terminal resizing
  useTerminalResize({
    containerRef,
    terminal: terminalInstance?.terminal ?? null,
    fitAddon: terminalInstance?.fitAddon ?? null,
    ptyManager,
    isVisible,
    terminalInstance,  // Pass instance for disableLayout check
  });

  // Search functionality
  const { searchAddonRef, search, searchNext, searchPrevious, clearSearch } = useXTermSearch();

  // Connect search addon to terminal
  useEffect(() => {
    if (terminalInstance?.searchAddon && !searchAddonRef.current) {
      searchAddonRef.current = terminalInstance.searchAddon;
    }
  }, [terminalInstance?.searchAddon, searchAddonRef]);

  // Terminal focus management
  useTerminalFocus({
    terminal: terminalInstance?.terminal ?? null,
    isVisible,
  });

  // CWD polling for title updates
  useCwdPolling({
    sessionId,
    isVisible,
    onTitleChange,
  });

  // Focus terminal when pane becomes active
  useEffect(() => {
    if (isActivePane && terminalInstance?.terminal && isVisible) {
      let cancelled = false;
      let timeoutId: number | undefined;

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (cancelled) return;

        const terminal = terminalInstance.terminal;
        if (!terminal) return;

        // Save scroll position before operations
        const savedScrollY = terminal.buffer.active.viewportY;

        // Force blur then focus to reset focus state properly
        // This ensures applications receive proper focus events
        terminal.blur();

        // Small delay to ensure blur is processed
        timeoutId = window.setTimeout(() => {
          if (cancelled) return;

          terminal.focus();

          // Trigger a refresh to wake up applications (like Claude CLI)
          // that may have hidden their cursor on blur
          terminal.refresh(0, terminal.rows - 1);

          // Restore scroll position after refresh
          terminal.scrollToLine(savedScrollY);
        }, 10);
      });

      return () => {
        cancelled = true;
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      };
    }
  }, [isActivePane, terminalInstance, isVisible]);

  // Expose imperative handle
  useImperativeHandle(
    ref,
    () => ({
      search,
      searchNext,
      searchPrevious,
      clearSearch,
      focus: () => {
        terminalInstance?.terminal.focus();
      },
      getTerminalInstance: () => {
        return terminalInstance;
      },
      setDisableLayout: (disabled: boolean) => {
        if (terminalInstance) {
          terminalInstance.disableLayout = disabled;
        }
      },
    }),
    [search, searchNext, searchPrevious, clearSearch, terminalInstance]
  );

  // Handle container click
  const handleContainerClick = useCallback(() => {
    onClick?.();
    terminalInstance?.terminal.focus();
  }, [onClick, terminalInstance]);

  // Compute CSS classes
  const visibilityClass = isVisible ? styles.terminalVisible : styles.terminalHidden;
  const paneClass = isActivePane ? styles.paneActive : styles.paneInactive;

  // Use container background to prevent transparent flash during terminal init
  // Memoize to prevent unnecessary DOM updates
  const containerStyle = useMemo(() => {
    const containerOpacity = opacity ?? 0.95;
    return {
      background: `rgba(0, 0, 0, ${containerOpacity})`,
    };
  }, [opacity]);

  return (
    <div
      ref={containerRef}
      className={`${styles.xterminalContainer} ${visibilityClass} ${paneClass}`}
      style={containerStyle}
      onClick={handleContainerClick}
    />
  );
});

const XTerminal = memo(XTerminalInner);

export default XTerminal;
