import { useCallback, useEffect, useRef, useState } from "react";

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
    <div className="search-bar-overlay">
      <div className="search-bar">
        <div className="search-input-container">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Find"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="search-options">
          <button
            className={`search-option-btn ${options.regex ? "active" : ""}`}
            onClick={() => toggleOption("regex")}
            title="Use Regular Expression"
          >
            .*
          </button>
          <button
            className={`search-option-btn ${options.caseSensitive ? "active" : ""}`}
            onClick={() => toggleOption("caseSensitive")}
            title="Match Case"
          >
            Aa
          </button>
          <button
            className={`search-option-btn ${options.wholeWord ? "active" : ""}`}
            onClick={() => toggleOption("wholeWord")}
            title="Match Whole Word"
          >
            <span className="whole-word-icon">[⎵]</span>
          </button>
        </div>

        <div className="search-nav">
          <button
            className="search-nav-btn"
            onClick={onSearchNext}
            title="Next Match (Enter)"
            disabled={!query}
          >
            ↓
          </button>
          <button
            className="search-nav-btn"
            onClick={onSearchPrevious}
            title="Previous Match (Shift+Enter)"
            disabled={!query}
          >
            ↑
          </button>
        </div>

        <button className="search-close-btn" onClick={onClose} title="Close (Esc)">
          ×
        </button>
      </div>
    </div>
  );
}
