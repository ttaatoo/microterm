import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDoubleEsc } from "./useDoubleEsc";
import { ESC_KEY, DOUBLE_ESC_INTERVAL_MS } from "@/lib/constants";

describe("useDoubleEsc", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return false for non-ESC input", () => {
    const onDoubleEsc = vi.fn();
    const { result } = renderHook(() => useDoubleEsc({ onDoubleEsc }));

    expect(result.current.checkDoubleEsc("a")).toBe(false);
    expect(result.current.checkDoubleEsc("Enter")).toBe(false);
    expect(result.current.checkDoubleEsc(" ")).toBe(false);
    expect(onDoubleEsc).not.toHaveBeenCalled();
  });

  it("should return false for single ESC", () => {
    const onDoubleEsc = vi.fn();
    const { result } = renderHook(() => useDoubleEsc({ onDoubleEsc }));

    expect(result.current.checkDoubleEsc(ESC_KEY)).toBe(false);
    expect(onDoubleEsc).not.toHaveBeenCalled();
  });

  it("should detect double ESC within interval", () => {
    const onDoubleEsc = vi.fn();
    const { result } = renderHook(() => useDoubleEsc({ onDoubleEsc }));

    // First ESC
    act(() => {
      result.current.checkDoubleEsc(ESC_KEY);
    });

    // Second ESC within interval
    act(() => {
      vi.advanceTimersByTime(DOUBLE_ESC_INTERVAL_MS - 10);
      const handled = result.current.checkDoubleEsc(ESC_KEY);
      expect(handled).toBe(true);
    });

    expect(onDoubleEsc).toHaveBeenCalledTimes(1);
  });

  it("should not detect double ESC if interval exceeded", () => {
    const onDoubleEsc = vi.fn();
    const { result } = renderHook(() => useDoubleEsc({ onDoubleEsc }));

    // First ESC
    act(() => {
      result.current.checkDoubleEsc(ESC_KEY);
    });

    // Second ESC after interval
    act(() => {
      vi.advanceTimersByTime(DOUBLE_ESC_INTERVAL_MS + 1);
      const handled = result.current.checkDoubleEsc(ESC_KEY);
      expect(handled).toBe(false);
    });

    expect(onDoubleEsc).not.toHaveBeenCalled();
  });

  it("should not trigger when disabled", () => {
    const onDoubleEsc = vi.fn();
    const { result } = renderHook(() =>
      useDoubleEsc({ disabled: true, onDoubleEsc })
    );

    // First ESC
    act(() => {
      result.current.checkDoubleEsc(ESC_KEY);
    });

    // Second ESC within interval
    act(() => {
      vi.advanceTimersByTime(DOUBLE_ESC_INTERVAL_MS - 10);
      const handled = result.current.checkDoubleEsc(ESC_KEY);
      expect(handled).toBe(true); // Still returns true (handled)
    });

    expect(onDoubleEsc).not.toHaveBeenCalled(); // But callback not called
  });

  it("should reset after double ESC to prevent triple-ESC", () => {
    const onDoubleEsc = vi.fn();
    const { result } = renderHook(() => useDoubleEsc({ onDoubleEsc }));

    // First ESC
    act(() => {
      result.current.checkDoubleEsc(ESC_KEY);
    });

    // Second ESC (double ESC detected)
    act(() => {
      vi.advanceTimersByTime(DOUBLE_ESC_INTERVAL_MS - 10);
      result.current.checkDoubleEsc(ESC_KEY);
    });

    expect(onDoubleEsc).toHaveBeenCalledTimes(1);

    // Third ESC immediately after
    act(() => {
      const handled = result.current.checkDoubleEsc(ESC_KEY);
      expect(handled).toBe(false); // Should not trigger again
    });

    expect(onDoubleEsc).toHaveBeenCalledTimes(1);
  });

  it("should handle rapid ESC presses", () => {
    const onDoubleEsc = vi.fn();
    const { result } = renderHook(() => useDoubleEsc({ onDoubleEsc }));

    act(() => {
      // Rapid presses
      result.current.checkDoubleEsc(ESC_KEY);
      vi.advanceTimersByTime(10);
      result.current.checkDoubleEsc(ESC_KEY);
      vi.advanceTimersByTime(10);
      result.current.checkDoubleEsc(ESC_KEY);
    });

    // Should only trigger once (first two form a pair)
    expect(onDoubleEsc).toHaveBeenCalledTimes(1);
  });

  it("should use default disabled=false", () => {
    const onDoubleEsc = vi.fn();
    const { result } = renderHook(() => useDoubleEsc({ onDoubleEsc }));

    act(() => {
      result.current.checkDoubleEsc(ESC_KEY);
      vi.advanceTimersByTime(DOUBLE_ESC_INTERVAL_MS - 10);
      result.current.checkDoubleEsc(ESC_KEY);
    });

    expect(onDoubleEsc).toHaveBeenCalledTimes(1);
  });
});
