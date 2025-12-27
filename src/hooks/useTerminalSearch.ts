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

  // Listen for Cmd+F to open search
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled]);

  return {
    searchOpen,
    openSearch,
    handleSearch,
    handleSearchNext,
    handleSearchPrevious,
    handleSearchClose,
  };
}
