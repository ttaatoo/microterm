import { useCallback, useRef } from "react";
import type { SearchAddon } from "@xterm/addon-search";

export interface XTermSearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

export interface UseXTermSearchReturn {
  searchAddonRef: React.MutableRefObject<SearchAddon | null>;
  search: (query: string, options?: XTermSearchOptions) => boolean;
  searchNext: () => boolean;
  searchPrevious: () => boolean;
  clearSearch: () => void;
}

/**
 * Hook for xterm.js search addon functionality
 * Provides search, searchNext, searchPrevious, and clearSearch operations
 */
export function useXTermSearch(): UseXTermSearchReturn {
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const currentSearchQueryRef = useRef<string>("");
  const currentSearchOptionsRef = useRef<XTermSearchOptions>({});

  const search = useCallback((query: string, options?: XTermSearchOptions): boolean => {
    if (!searchAddonRef.current) {
      return false;
    }
    if (!query) {
      searchAddonRef.current.clearDecorations();
      currentSearchQueryRef.current = "";
      return false;
    }

    currentSearchQueryRef.current = query;
    currentSearchOptionsRef.current = options ?? {};

    return searchAddonRef.current.findNext(query, {
      caseSensitive: options?.caseSensitive,
      wholeWord: options?.wholeWord,
      regex: options?.regex,
      incremental: true,
    });
  }, []);

  const searchNext = useCallback((): boolean => {
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
  }, []);

  const searchPrevious = useCallback((): boolean => {
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
  }, []);

  const clearSearch = useCallback((): void => {
    searchAddonRef.current?.clearDecorations();
    currentSearchQueryRef.current = "";
  }, []);

  return {
    searchAddonRef,
    search,
    searchNext,
    searchPrevious,
    clearSearch,
  };
}
