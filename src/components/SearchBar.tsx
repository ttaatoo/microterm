import { useCallback, useEffect, useRef, useState } from "react";
import * as styles from "./SearchBar.css";

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, options: SearchOptions) => void;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export default function SearchBar({
  isOpen,
  onClose,
  onSearch,
  onSearchNext,
  onSearchPrevious,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });

  // Focus input when search bar opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          onSearchPrevious();
        } else {
          onSearchNext();
        }
      }
    },
    [onClose, onSearchNext, onSearchPrevious]
  );

  // Trigger search when query or options change
  useEffect(() => {
    if (isOpen) {
      onSearch(query, options);
    }
  }, [query, options, isOpen, onSearch]);

  const toggleOption = (option: keyof SearchOptions) => {
    setOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className={styles.searchBarOverlay}>
      <div className={styles.searchBar}>
        <div className={styles.searchInputContainer}>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Find"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className={styles.searchOptions}>
          <button
            className={`${styles.searchOptionBtn} ${options.regex ? styles.searchOptionBtnActive : ""}`}
            onClick={() => toggleOption("regex")}
            title="Use Regular Expression"
          >
            .*
          </button>
          <button
            className={`${styles.searchOptionBtn} ${options.caseSensitive ? styles.searchOptionBtnActive : ""}`}
            onClick={() => toggleOption("caseSensitive")}
            title="Match Case"
          >
            Aa
          </button>
          <button
            className={`${styles.searchOptionBtn} ${options.wholeWord ? styles.searchOptionBtnActive : ""}`}
            onClick={() => toggleOption("wholeWord")}
            title="Match Whole Word"
          >
            <span className={styles.wholeWordIcon}>[⎵]</span>
          </button>
        </div>

        <div className={styles.searchNav}>
          <button
            className={styles.searchNavBtn}
            onClick={onSearchNext}
            title="Next Match (Enter)"
            disabled={!query}
          >
            ↓
          </button>
          <button
            className={styles.searchNavBtn}
            onClick={onSearchPrevious}
            title="Previous Match (Shift+Enter)"
            disabled={!query}
          >
            ↑
          </button>
        </div>

        <button className={styles.searchCloseBtn} onClick={onClose} title="Close (Esc)">
          ×
        </button>
      </div>
    </div>
  );
}
