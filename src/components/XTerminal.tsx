import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useTerminalInstance } from "@/hooks/useTerminalInstance";
import { useTerminalPty } from "@/hooks/useTerminalPty";
import { useTerminalResize } from "@/hooks/useTerminalResize";
import { useTerminalInput } from "@/hooks/useTerminalInput";
import { useTerminalKeyboard } from "@/hooks/useTerminalKeyboard";
import { useTerminalFocus } from "@/hooks/useTerminalFocus";
import { useCwdPolling } from "@/hooks/useCwdPolling";
import { useXTermSearch, type XTermSearchOptions } from "@/hooks/useXTermSearch";
import "@xterm/xterm/css/xterm.css";
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
    paneId: _paneId,
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
