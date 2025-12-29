import { useState, useEffect, useCallback } from "react";
import type { XTerminalHandle } from "@/components/XTerminal";
import type { SearchOptions } from "@/components/SearchBar";

interface UseTerminalSearchOptions {
  getActiveTerminal: () => XTerminalHandle | null;
  disabled?: boolean;
}

export function useTerminalSearch({ getActiveTerminal, disabled = false }: UseTerminalSearchOptions) {
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearch = useCallback((query: string, options: SearchOptions) => {
    const terminal = getActiveTerminal();
    if (terminal) {
      terminal.search(query, {
        caseSensitive: options.caseSensitive,
        wholeWord: options.wholeWord,
        regex: options.regex,
      });
    }
  }, [getActiveTerminal]);

  const handleSearchNext = useCallback(() => {
    const terminal = getActiveTerminal();
    terminal?.searchNext();
  }, [getActiveTerminal]);

  const handleSearchPrevious = useCallback(() => {
    const terminal = getActiveTerminal();
    terminal?.searchPrevious();
  }, [getActiveTerminal]);

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false);
    const terminal = getActiveTerminal();
    if (terminal) {
      terminal.clearSearch();
      terminal.focus();
    }
  }, [getActiveTerminal]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  // Close search when disabled
  useEffect(() => {
    if (disabled && searchOpen) {
      setSearchOpen(false);
      const terminal = getActiveTerminal();
      terminal?.clearSearch();
    }
  }, [disabled, searchOpen, getActiveTerminal]);

  // Listen for Cmd+F to open search and Escape to close
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape" && searchOpen) {
        e.preventDefault();
        e.stopPropagation();
        handleSearchClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [disabled, searchOpen, handleSearchClose]);

  return {
    searchOpen,
    openSearch,
    handleSearch,
    handleSearchNext,
    handleSearchPrevious,
    handleSearchClose,
  };
}
