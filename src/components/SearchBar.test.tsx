import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "./SearchBar";

// Mock CSS modules
vi.mock("./SearchBar.css", () => ({
  searchBarOverlay: "search-bar-overlay",
  searchBar: "search-bar",
  searchInputContainer: "search-input-container",
  searchInput: "search-input",
  searchOptions: "search-options",
  searchOptionBtn: "search-option-btn",
  searchOptionBtnActive: "search-option-btn-active",
  wholeWordIcon: "whole-word-icon",
  searchNav: "search-nav",
  searchNavBtn: "search-nav-btn",
  searchCloseBtn: "search-close-btn",
}));

describe("SearchBar", () => {
  const mockOnClose = vi.fn();
  const mockOnSearch = vi.fn();
  const mockOnSearchNext = vi.fn();
  const mockOnSearchPrevious = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSearch: mockOnSearch,
    onSearchNext: mockOnSearchNext,
    onSearchPrevious: mockOnSearchPrevious,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should not render when isOpen is false", () => {
      const { container } = render(<SearchBar {...defaultProps} isOpen={false} />);

      expect(container.firstChild).toBeNull();
    });

    it("should render when isOpen is true", () => {
      render(<SearchBar {...defaultProps} />);

      expect(screen.getByPlaceholderText("Find")).toBeInTheDocument();
    });

    it("should render search input", () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "text");
    });

    it("should render option buttons", () => {
      render(<SearchBar {...defaultProps} />);

      expect(screen.getByTitle("Use Regular Expression")).toBeInTheDocument();
      expect(screen.getByTitle("Match Case")).toBeInTheDocument();
      expect(screen.getByTitle("Match Whole Word")).toBeInTheDocument();
    });

    it("should render navigation buttons", () => {
      render(<SearchBar {...defaultProps} />);

      expect(screen.getByTitle("Next Match (Enter)")).toBeInTheDocument();
      expect(screen.getByTitle("Previous Match (Shift+Enter)")).toBeInTheDocument();
    });

    it("should render close button", () => {
      render(<SearchBar {...defaultProps} />);

      expect(screen.getByTitle("Close (Esc)")).toBeInTheDocument();
    });
  });

  describe("Input Focus", () => {
    it("should focus input when opened", () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      expect(input).toHaveFocus();
    });

    it("should select input text when opened", () => {
      const { rerender } = render(<SearchBar {...defaultProps} isOpen={false} />);

      rerender(<SearchBar {...defaultProps} isOpen={true} />);

      const input = screen.getByPlaceholderText("Find") as HTMLInputElement;
      expect(input.selectionStart).toBe(0);
    });
  });

  describe("Search Input", () => {
    it("should update query on input change", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      await user.clear(input);
      await user.type(input, "test query");

      expect(input).toHaveValue("test query");
    });

    it("should call onSearch when query changes", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      await user.type(input, "a");

      expect(mockOnSearch).toHaveBeenCalledWith("a", {
        caseSensitive: false,
        wholeWord: false,
        regex: false,
      });
    });

    it("should call onSearch with current options", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      // Toggle case sensitive
      const caseSensitiveBtn = screen.getByTitle("Match Case");
      await user.click(caseSensitiveBtn);

      // Type query
      const input = screen.getByPlaceholderText("Find");
      await user.type(input, "test");

      expect(mockOnSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          caseSensitive: true,
        })
      );
    });
  });

  describe("Search Options", () => {
    it("should toggle regex option", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const regexBtn = screen.getByTitle("Use Regular Expression");

      // Initially not active
      expect(regexBtn).not.toHaveClass("search-option-btn-active");

      // Click to activate
      await user.click(regexBtn);

      expect(regexBtn).toHaveClass("search-option-btn-active");
      expect(mockOnSearch).toHaveBeenCalledWith("", {
        caseSensitive: false,
        wholeWord: false,
        regex: true,
      });
    });

    it("should toggle case sensitive option", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const caseSensitiveBtn = screen.getByTitle("Match Case");

      // Click to activate
      await user.click(caseSensitiveBtn);

      expect(caseSensitiveBtn).toHaveClass("search-option-btn-active");
      expect(mockOnSearch).toHaveBeenCalledWith("", {
        caseSensitive: true,
        wholeWord: false,
        regex: false,
      });
    });

    it("should toggle whole word option", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const wholeWordBtn = screen.getByTitle("Match Whole Word");

      // Click to activate
      await user.click(wholeWordBtn);

      expect(wholeWordBtn).toHaveClass("search-option-btn-active");
      expect(mockOnSearch).toHaveBeenCalledWith("", {
        caseSensitive: false,
        wholeWord: true,
        regex: false,
      });
    });

    it("should toggle option off when clicked again", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const regexBtn = screen.getByTitle("Use Regular Expression");

      // Activate
      await user.click(regexBtn);
      expect(regexBtn).toHaveClass("search-option-btn-active");

      // Deactivate
      await user.click(regexBtn);
      expect(regexBtn).not.toHaveClass("search-option-btn-active");
    });

    it("should allow multiple options to be active", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const regexBtn = screen.getByTitle("Use Regular Expression");
      const caseSensitiveBtn = screen.getByTitle("Match Case");

      await user.click(regexBtn);
      await user.click(caseSensitiveBtn);

      expect(regexBtn).toHaveClass("search-option-btn-active");
      expect(caseSensitiveBtn).toHaveClass("search-option-btn-active");
      expect(mockOnSearch).toHaveBeenCalledWith("", {
        caseSensitive: true,
        wholeWord: false,
        regex: true,
      });
    });
  });

  describe("Navigation", () => {
    it("should call onSearchNext when next button clicked", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      // Add query first
      const input = screen.getByPlaceholderText("Find");
      await user.type(input, "test");

      const nextBtn = screen.getByTitle("Next Match (Enter)");
      await user.click(nextBtn);

      expect(mockOnSearchNext).toHaveBeenCalledTimes(1);
    });

    it("should call onSearchPrevious when previous button clicked", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      // Add query first
      const input = screen.getByPlaceholderText("Find");
      await user.type(input, "test");

      const prevBtn = screen.getByTitle("Previous Match (Shift+Enter)");
      await user.click(prevBtn);

      expect(mockOnSearchPrevious).toHaveBeenCalledTimes(1);
    });

    it("should disable navigation buttons when query is empty", () => {
      render(<SearchBar {...defaultProps} />);

      const nextBtn = screen.getByTitle("Next Match (Enter)");
      const prevBtn = screen.getByTitle("Previous Match (Shift+Enter)");

      expect(nextBtn).toBeDisabled();
      expect(prevBtn).toBeDisabled();
    });

    it("should enable navigation buttons when query exists", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      await user.type(input, "test");

      const nextBtn = screen.getByTitle("Next Match (Enter)");
      const prevBtn = screen.getByTitle("Previous Match (Shift+Enter)");

      expect(nextBtn).not.toBeDisabled();
      expect(prevBtn).not.toBeDisabled();
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("should call onClose when Escape is pressed", () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      fireEvent.keyDown(input, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onSearchNext when Enter is pressed", () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      fireEvent.keyDown(input, { key: "Enter" });

      expect(mockOnSearchNext).toHaveBeenCalledTimes(1);
    });

    it("should call onSearchPrevious when Shift+Enter is pressed", () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

      expect(mockOnSearchPrevious).toHaveBeenCalledTimes(1);
      expect(mockOnSearchNext).not.toHaveBeenCalled();
    });

    it("should prevent default on Escape", () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      fireEvent(input, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("should prevent default on Enter", () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      fireEvent(input, event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe("Close Button", () => {
    it("should call onClose when close button clicked", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const closeBtn = screen.getByTitle("Close (Esc)");
      await user.click(closeBtn);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Search Triggers", () => {
    it("should call onSearch on mount when open", () => {
      render(<SearchBar {...defaultProps} />);

      expect(mockOnSearch).toHaveBeenCalledWith("", {
        caseSensitive: false,
        wholeWord: false,
        regex: false,
      });
    });

    it("should not call onSearch when closed", () => {
      render(<SearchBar {...defaultProps} isOpen={false} />);

      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it("should call onSearch when reopened", () => {
      const { rerender } = render(<SearchBar {...defaultProps} isOpen={false} />);

      expect(mockOnSearch).not.toHaveBeenCalled();

      rerender(<SearchBar {...defaultProps} isOpen={true} />);

      expect(mockOnSearch).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid option toggling", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const regexBtn = screen.getByTitle("Use Regular Expression");

      // Rapid clicks
      await user.click(regexBtn);
      await user.click(regexBtn);
      await user.click(regexBtn);

      // Should end up deactivated (odd number of clicks)
      expect(regexBtn).toHaveClass("search-option-btn-active");
    });

    it("should handle empty query navigation attempts", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");

      // Try Enter with empty query
      fireEvent.keyDown(input, { key: "Enter" });

      // Should still call onSearchNext (button is what's disabled)
      expect(mockOnSearchNext).toHaveBeenCalled();
    });

    it("should preserve query when options change", async () => {
      const _user = userEvent.setup();
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");
      await user.type(input, "preserved");

      const regexBtn = screen.getByTitle("Use Regular Expression");
      await user.click(regexBtn);

      expect(input).toHaveValue("preserved");
    });

    it("should handle multiple keyboard shortcuts in sequence", () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByPlaceholderText("Find");

      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(mockOnSearchNext).toHaveBeenCalledTimes(1);
      expect(mockOnSearchPrevious).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
