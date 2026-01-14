import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useXTermSearch } from "./useXTermSearch";
import type { SearchAddon } from "@xterm/addon-search";

describe("useXTermSearch", () => {
  let mockSearchAddon: {
    findNext: ReturnType<typeof vi.fn>;
    findPrevious: ReturnType<typeof vi.fn>;
    clearDecorations: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSearchAddon = {
      findNext: vi.fn().mockReturnValue(true),
      findPrevious: vi.fn().mockReturnValue(true),
      clearDecorations: vi.fn(),
    };
  });

  it("should return search functions and ref", () => {
    const { result } = renderHook(() => useXTermSearch());
    expect(result.current.searchAddonRef).toBeDefined();
    expect(result.current.search).toBeDefined();
    expect(result.current.searchNext).toBeDefined();
    expect(result.current.searchPrevious).toBeDefined();
    expect(result.current.clearSearch).toBeDefined();
  });

  it("should return false when search addon is not set", () => {
    const { result } = renderHook(() => useXTermSearch());
    expect(result.current.search("test")).toBe(false);
    expect(result.current.searchNext()).toBe(false);
    expect(result.current.searchPrevious()).toBe(false);
  });

  it("should search when addon is set", () => {
    const { result } = renderHook(() => useXTermSearch());
    act(() => {
      result.current.searchAddonRef.current = mockSearchAddon as unknown as SearchAddon;
    });

    act(() => {
      const found = result.current.search("test", { caseSensitive: true });
      expect(found).toBe(true);
      expect(mockSearchAddon.findNext).toHaveBeenCalledWith("test", {
        caseSensitive: true,
        wholeWord: undefined,
        regex: undefined,
        incremental: true,
      });
    });
  });

  it("should clear decorations when query is empty", () => {
    const { result } = renderHook(() => useXTermSearch());
    act(() => {
      result.current.searchAddonRef.current = mockSearchAddon as unknown as SearchAddon;
    });

    act(() => {
      result.current.search("test");
      result.current.search("");
    });

    expect(mockSearchAddon.clearDecorations).toHaveBeenCalled();
  });

  it("should search next with stored query and options", () => {
    const { result } = renderHook(() => useXTermSearch());
    act(() => {
      result.current.searchAddonRef.current = mockSearchAddon as unknown as SearchAddon;
    });

    act(() => {
      result.current.search("test", { caseSensitive: true, wholeWord: true });
    });

    act(() => {
      const found = result.current.searchNext();
      expect(found).toBe(true);
      expect(mockSearchAddon.findNext).toHaveBeenCalledWith("test", {
        caseSensitive: true,
        wholeWord: true,
        regex: undefined,
        incremental: false,
      });
    });
  });

  it("should search previous with stored query and options", () => {
    const { result } = renderHook(() => useXTermSearch());
    act(() => {
      result.current.searchAddonRef.current = mockSearchAddon as unknown as SearchAddon;
    });

    act(() => {
      result.current.search("test", { regex: true });
    });

    act(() => {
      const found = result.current.searchPrevious();
      expect(found).toBe(true);
      expect(mockSearchAddon.findPrevious).toHaveBeenCalledWith("test", {
        caseSensitive: undefined,
        wholeWord: undefined,
        regex: true,
        incremental: false,
      });
    });
  });

  it("should return false when searching next without query", () => {
    const { result } = renderHook(() => useXTermSearch());
    act(() => {
      result.current.searchAddonRef.current = mockSearchAddon as unknown as SearchAddon;
    });

    act(() => {
      expect(result.current.searchNext()).toBe(false);
      expect(mockSearchAddon.findNext).not.toHaveBeenCalled();
    });
  });

  it("should return false when searching previous without query", () => {
    const { result } = renderHook(() => useXTermSearch());
    act(() => {
      result.current.searchAddonRef.current = mockSearchAddon as unknown as SearchAddon;
    });

    act(() => {
      expect(result.current.searchPrevious()).toBe(false);
      expect(mockSearchAddon.findPrevious).not.toHaveBeenCalled();
    });
  });

  it("should clear search and decorations", () => {
    const { result } = renderHook(() => useXTermSearch());
    act(() => {
      result.current.searchAddonRef.current = mockSearchAddon as unknown as SearchAddon;
    });

    act(() => {
      result.current.search("test");
      result.current.clearSearch();
    });

    expect(mockSearchAddon.clearDecorations).toHaveBeenCalled();
    expect(result.current.searchNext()).toBe(false);
  });
});
