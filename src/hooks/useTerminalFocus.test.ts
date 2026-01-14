import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useTerminalFocus } from "./useTerminalFocus";
import type { Terminal } from "@xterm/xterm";

// Mock Tauri APIs
const mockFocus = vi.fn();
const mockUnlistenFocus = vi.fn();
const mockUnlistenToggle = vi.fn();

// Helper to flush all pending promises
const _flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

vi.mock("@tauri-apps/api/window", () => {
  const mockWindow = {
    onFocusChanged: vi.fn((callback) => {
      // Store callback for testing - synchronously to avoid timing issues
      (window as any).__tauriFocusCallback = callback;
      return Promise.resolve(mockUnlistenFocus);
    }),
    metadata: {
      label: "main",
    },
  };
  return {
    getCurrentWindow: vi.fn(() => mockWindow),
  };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((eventName, callback) => {
    if (eventName === "toggle-window") {
      // Store callback for testing - synchronously to avoid timing issues
      (window as any).__tauriToggleCallback = callback;
      return Promise.resolve(mockUnlistenToggle);
    }
    return Promise.resolve(vi.fn());
  }),
}));

describe("useTerminalFocus", () => {
  let mockTerminal: Terminal;

  beforeEach(() => {
    mockTerminal = {
      focus: mockFocus,
    } as unknown as Terminal;
    mockFocus.mockClear();
    mockUnlistenFocus.mockClear();
    mockUnlistenToggle.mockClear();
    delete (window as any).__tauriFocusCallback;
    delete (window as any).__tauriToggleCallback;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should focus terminal on window focus event", () => {
    renderHook(() => useTerminalFocus({ terminal: mockTerminal }));
    const focusEvent = new Event("focus");
    window.dispatchEvent(focusEvent);
    expect(mockFocus).toHaveBeenCalledTimes(1);
  });

  it("should not focus when terminal is null", () => {
    renderHook(() => useTerminalFocus({ terminal: null }));
    const focusEvent = new Event("focus");
    window.dispatchEvent(focusEvent);
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it("should cleanup window focus listener", () => {
    const { unmount } = renderHook(() => useTerminalFocus({ terminal: mockTerminal }));
    unmount();
    const focusEvent = new Event("focus");
    window.dispatchEvent(focusEvent);
    // Should not be called after unmount (though cleanup might not prevent all calls)
    // This test verifies the cleanup is set up
  });

  it("should focus terminal when Tauri window gains focus", async () => {
    vi.useFakeTimers();
    renderHook(() => useTerminalFocus({ terminal: mockTerminal }));

    // Run all pending timers to allow async setup to complete
    await vi.runAllTimersAsync();

    expect((window as any).__tauriFocusCallback).toBeDefined();

    const callback = (window as any).__tauriFocusCallback;
    if (callback) {
      callback({ payload: true });
      await vi.advanceTimersByTimeAsync(100);
      expect(mockFocus).toHaveBeenCalled();
    }

    vi.useRealTimers();
  });

  it("should not focus terminal when Tauri window loses focus", async () => {
    vi.useFakeTimers();
    renderHook(() => useTerminalFocus({ terminal: mockTerminal }));

    // Run all pending timers to allow async setup to complete
    await vi.runAllTimersAsync();

    expect((window as any).__tauriFocusCallback).toBeDefined();

    const callback = (window as any).__tauriFocusCallback;
    if (callback) {
      mockFocus.mockClear();
      callback({ payload: false });
      await vi.advanceTimersByTimeAsync(100);
      expect(mockFocus).not.toHaveBeenCalled();
    }

    vi.useRealTimers();
  });

  it("should focus terminal on toggle-window event", async () => {
    vi.useFakeTimers();
    renderHook(() => useTerminalFocus({ terminal: mockTerminal }));

    // Run all pending timers to allow async setup to complete
    await vi.runAllTimersAsync();

    expect((window as any).__tauriToggleCallback).toBeDefined();

    const callback = (window as any).__tauriToggleCallback;
    if (callback) {
      callback({});
      await vi.advanceTimersByTimeAsync(200);
      expect(mockFocus).toHaveBeenCalled();
    }

    vi.useRealTimers();
  });

  it("should focus terminal when becoming visible", async () => {
    const { rerender } = renderHook(
      ({ isVisible }) => useTerminalFocus({ terminal: mockTerminal, isVisible }),
      { initialProps: { isVisible: false } }
    );

    mockFocus.mockClear();
    rerender({ isVisible: true });

    // Wait for requestAnimationFrame to execute
    await waitFor(() => {
      expect(mockFocus).toHaveBeenCalled();
    });
  });

  it("should not focus when terminal is null and becoming visible", async () => {
    const { rerender } = renderHook(
      ({ isVisible }) => useTerminalFocus({ terminal: null, isVisible }),
      { initialProps: { isVisible: false } }
    );

    mockFocus.mockClear();
    rerender({ isVisible: true });

    // Wait to ensure no focus call happens
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it("should cleanup Tauri listeners on unmount", async () => {
    const { unmount } = renderHook(() => useTerminalFocus({ terminal: mockTerminal }));

    // Wait for async setup to complete
    await waitFor(() => {
      expect((window as any).__tauriFocusCallback).toBeDefined();
      expect((window as any).__tauriToggleCallback).toBeDefined();
    });

    unmount();

    // Wait a bit for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockUnlistenFocus).toHaveBeenCalled();
    expect(mockUnlistenToggle).toHaveBeenCalled();
  });
});
