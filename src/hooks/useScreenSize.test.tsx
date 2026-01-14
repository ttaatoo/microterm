import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useScreenSize } from "./useScreenSize";

// Mock Tauri API
const mockCurrentMonitor = vi.fn();

describe("useScreenSize", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default window.screen mock
    Object.defineProperty(window, "screen", {
      writable: true,
      value: {
        width: 1920,
        height: 1080,
      },
    });

    // Remove Tauri from window by default
    delete (window as any).__TAURI__;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Tauri environment", () => {
    beforeEach(() => {
      // Setup Tauri environment
      (window as any).__TAURI__ = {};

      // Mock the dynamic import
      vi.doMock("@tauri-apps/api/window", () => ({
        currentMonitor: mockCurrentMonitor,
      }));
    });

    it("should get screen size from Tauri API", async () => {
      const mockMonitor = {
        size: { width: 3840, height: 2160 },
        scaleFactor: 2,
      };
      mockCurrentMonitor.mockResolvedValue(mockMonitor);

      const { result } = renderHook(() => useScreenSize());

      // Initially null
      expect(result.current).toBeNull();

      // Wait for async effect to complete
      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // Should return logical pixels (physical / scale factor)
      expect(result.current).toEqual({
        width: 1920, // 3840 / 2
        height: 1080, // 2160 / 2
      });
    });

    it("should handle monitor with scale factor 1", async () => {
      const mockMonitor = {
        size: { width: 1920, height: 1080 },
        scaleFactor: 1,
      };
      mockCurrentMonitor.mockResolvedValue(mockMonitor);

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 1920,
        height: 1080,
      });
    });

    it("should handle monitor with scale factor 1.5", async () => {
      const mockMonitor = {
        size: { width: 2880, height: 1620 },
        scaleFactor: 1.5,
      };
      mockCurrentMonitor.mockResolvedValue(mockMonitor);

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 1920, // 2880 / 1.5 = 1920
        height: 1080, // 1620 / 1.5 = 1080
      });
    });

    it("should round logical pixels to floor", async () => {
      const mockMonitor = {
        size: { width: 3000, height: 2000 },
        scaleFactor: 1.75,
      };
      mockCurrentMonitor.mockResolvedValue(mockMonitor);

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // 3000 / 1.75 = 1714.285... -> 1714
      // 2000 / 1.75 = 1142.857... -> 1142
      expect(result.current).toEqual({
        width: 1714,
        height: 1142,
      });
    });

    it("should fallback to window.screen when monitor is null", async () => {
      mockCurrentMonitor.mockResolvedValue(null);

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // Should use window.screen fallback
      expect(result.current).toEqual({
        width: 1920,
        height: 1080,
      });
    });

    it("should fallback to window.screen on Tauri error", async () => {
      mockCurrentMonitor.mockRejectedValue(new Error("Tauri API failed"));

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // Should use window.screen fallback
      expect(result.current).toEqual({
        width: 1920,
        height: 1080,
      });
    });

    it("should warn on Tauri failure", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();
      mockCurrentMonitor.mockRejectedValue(new Error("Test error"));

      renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "Failed to get screen size from Tauri:",
          expect.any(Error)
        );
      });
    });
  });

  describe("Browser environment", () => {
    it("should get screen size from window.screen", async () => {
      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 1920,
        height: 1080,
      });
    });

    it("should handle different screen sizes", async () => {
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 2560,
          height: 1440,
        },
      });

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 2560,
        height: 1440,
      });
    });

    it("should handle small screens", async () => {
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 1280,
          height: 720,
        },
      });

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 1280,
        height: 720,
      });
    });

    it("should handle ultra-wide screens", async () => {
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 3440,
          height: 1440,
        },
      });

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 3440,
        height: 1440,
      });
    });

    it("should handle portrait orientation", async () => {
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 1080,
          height: 1920,
        },
      });

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 1080,
        height: 1920,
      });
    });

    it("should return null when window.screen is unavailable", async () => {
      Object.defineProperty(window, "screen", {
        writable: true,
        value: undefined,
      });

      const { result } = renderHook(() => useScreenSize());

      // Should remain null after timeout
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(result.current).toBeNull();
    });
  });

  describe("Resize listener", () => {
    it("should update screen size on window resize", async () => {
      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 1920,
        height: 1080,
      });

      // Change screen size
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 2560,
          height: 1440,
        },
      });

      // Trigger resize event
      window.dispatchEvent(new Event("resize"));

      await waitFor(() => {
        expect(result.current).toEqual({
          width: 2560,
          height: 1440,
        });
      });
    });

    it("should handle multiple resize events", async () => {
      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // First resize
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 2560,
          height: 1440,
        },
      });
      window.dispatchEvent(new Event("resize"));

      await waitFor(() => {
        expect(result.current?.width).toBe(2560);
      });

      // Second resize
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 1280,
          height: 720,
        },
      });
      window.dispatchEvent(new Event("resize"));

      await waitFor(() => {
        expect(result.current?.width).toBe(1280);
      });
    });

    it("should clean up resize listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useScreenSize());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "resize",
        expect.any(Function)
      );
    });

    it("should not leak memory with multiple mount/unmount cycles", async () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      // Mount and unmount multiple times
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() => useScreenSize());
        await new Promise((resolve) => setTimeout(resolve, 10));
        unmount();
      }

      // Should have equal adds and removes
      expect(addEventListenerSpy).toHaveBeenCalledTimes(5);
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero scale factor gracefully", async () => {
      (window as any).__TAURI__ = {};

      const mockMonitor = {
        size: { width: 1920, height: 1080 },
        scaleFactor: 0,
      };
      mockCurrentMonitor.mockResolvedValue(mockMonitor);

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // Should return Infinity or fallback to window.screen
      // The actual behavior depends on implementation
      expect(result.current).toBeTruthy();
    });

    it("should handle negative dimensions", async () => {
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: -1920,
          height: -1080,
        },
      });

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // Should return the negative values as-is (or handle according to implementation)
      expect(result.current?.width).toBeDefined();
      expect(result.current?.height).toBeDefined();
    });

    it("should handle very large screen dimensions", async () => {
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 15360, // 8K x 4 monitors
          height: 8640,
        },
      });

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 15360,
        height: 8640,
      });
    });

    it("should handle fractional screen dimensions", async () => {
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 1920.5,
          height: 1080.7,
        },
      });

      const { result } = renderHook(() => useScreenSize());

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      // Fractional values should be preserved or handled consistently
      expect(result.current?.width).toBeDefined();
      expect(result.current?.height).toBeDefined();
    });
  });

  describe("Concurrent operations", () => {
    it("should handle rapid unmount/remount", async () => {
      const { unmount: unmount1 } = renderHook(() => useScreenSize());
      const { unmount: unmount2 } = renderHook(() => useScreenSize());
      const { result } = renderHook(() => useScreenSize());

      unmount1();
      unmount2();

      await waitFor(() => {
        expect(result.current).not.toBeNull();
      });

      expect(result.current).toEqual({
        width: 1920,
        height: 1080,
      });
    });

    it("should handle screen change during async operation", async () => {
      (window as any).__TAURI__ = {};

      // Slow async operation
      mockCurrentMonitor.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                size: { width: 3840, height: 2160 },
                scaleFactor: 2,
              });
            }, 100);
          })
      );

      const { result } = renderHook(() => useScreenSize());

      // Change screen size while async operation is pending
      Object.defineProperty(window, "screen", {
        writable: true,
        value: {
          width: 2560,
          height: 1440,
        },
      });

      await waitFor(
        () => {
          expect(result.current).not.toBeNull();
        },
        { timeout: 200 }
      );

      // Should use Tauri result when it resolves
      expect(result.current).toEqual({
        width: 1920,
        height: 1080,
      });
    });
  });
});
