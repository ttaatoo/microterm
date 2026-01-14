import { renderHook, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useTerminalSearch } from "./useTerminalSearch";
import type { XTerminalHandle } from "@/components/XTerminal";

describe("useTerminalSearch", () => {
  let mockTerminal: XTerminalHandle;
  let getActiveTerminal: () => XTerminalHandle | null;

  beforeEach(() => {
    mockTerminal = {
      search: vi.fn().mockReturnValue(true),
      searchNext: vi.fn().mockReturnValue(true),
      searchPrevious: vi.fn().mockReturnValue(true),
      clearSearch: vi.fn(),
      focus: vi.fn(),
    };
    getActiveTerminal = vi.fn(() => mockTerminal);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with search closed", () => {
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal }));
    expect(result.current.searchOpen).toBe(false);
  });

  it("should open search", () => {
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal }));
    act(() => {
      result.current.openSearch();
    });
    expect(result.current.searchOpen).toBe(true);
  });

  it("should handle search with options", () => {
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal }));
    act(() => {
      result.current.handleSearch("test", {
        caseSensitive: true,
        wholeWord: true,
        regex: false,
      });
    });
    expect(mockTerminal.search).toHaveBeenCalledWith("test", {
      caseSensitive: true,
      wholeWord: true,
      regex: false,
    });
  });

  it("should handle search next", () => {
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal }));
    act(() => {
      result.current.handleSearchNext();
    });
    expect(mockTerminal.searchNext).toHaveBeenCalledTimes(1);
  });

  it("should handle search previous", () => {
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal }));
    act(() => {
      result.current.handleSearchPrevious();
    });
    expect(mockTerminal.searchPrevious).toHaveBeenCalledTimes(1);
  });

  it("should close search and clear", () => {
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal }));
    act(() => {
      result.current.openSearch();
      result.current.handleSearchClose();
    });
    expect(result.current.searchOpen).toBe(false);
    expect(mockTerminal.clearSearch).toHaveBeenCalledTimes(1);
    expect(mockTerminal.focus).toHaveBeenCalledTimes(1);
  });

  it("should not call terminal methods when terminal is null", () => {
    getActiveTerminal = vi.fn(() => null);
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal }));
    act(() => {
      result.current.handleSearch("test", { caseSensitive: false, wholeWord: false, regex: false });
      result.current.handleSearchNext();
      result.current.handleSearchPrevious();
      result.current.handleSearchClose();
    });
    // Should not throw
    expect(result.current.searchOpen).toBe(false);
  });

  it("should open search on Cmd+F", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal }));
    expect(result.current.searchOpen).toBe(false);

    await act(async () => {
      await user.keyboard("{Meta>}f{/Meta}");
    });

    await waitFor(() => {
      expect(result.current.searchOpen).toBe(true);
    });
  });

  it("should close search on Escape when open", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal }));
    act(() => {
      result.current.openSearch();
    });

    await act(async () => {
      await user.keyboard("{Escape}");
    });

    await waitFor(() => {
      expect(result.current.searchOpen).toBe(false);
      expect(mockTerminal.clearSearch).toHaveBeenCalled();
    });
  });

  it("should close search when disabled", () => {
    const { result, rerender } = renderHook(
      ({ disabled }) => useTerminalSearch({ getActiveTerminal, disabled }),
      { initialProps: { disabled: false } }
    );

    act(() => {
      result.current.openSearch();
    });
    expect(result.current.searchOpen).toBe(true);

    rerender({ disabled: true });

    expect(result.current.searchOpen).toBe(false);
    expect(mockTerminal.clearSearch).toHaveBeenCalled();
  });

  it("should not open search on Cmd+F when disabled", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useTerminalSearch({ getActiveTerminal, disabled: true }));
    expect(result.current.searchOpen).toBe(false);

    await act(async () => {
      await user.keyboard("{Meta>}f{/Meta}");
    });

    // Wait a bit to ensure event handler doesn't fire
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.searchOpen).toBe(false);
  });
});
