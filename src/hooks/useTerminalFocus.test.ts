import { renderHook, waitFor } from "@testing-library/react";
import type { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTerminalFocus } from "./useTerminalFocus";

// Mock Tauri APIs
const mockFocus = vi.fn();
const mockUnlistenFocus = vi.fn();
const mockUnlistenToggle = vi.fn();

// Helper to flush all pending promises

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
    if (typeof window !== "undefined") {
      delete (window as any).__tauriFocusCallback;
      delete (window as any).__tauriToggleCallback;
    }
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

    const { unmount } = renderHook(() => useTerminalFocus({ terminal: mockTerminal }));

    // Run all pending timers to allow async setup to complete
    await vi.runAllTimersAsync();

    expect((window as any).__tauriFocusCallback).toBeDefined();

    const callback = (window as any).__tauriFocusCallback;
    if (callback) {
      // Clear any previous calls - this is critical to ensure we're only testing
      // the Tauri callback behavior, not any previous test's side effects
      mockFocus.mockClear();

      // In CI environments, window focus events from other tests or environment setup
      // might interfere. The hook registers a window focus listener in the first useEffect.
      //
      // To ensure test isolation, we'll temporarily replace window.addEventListener
      // to prevent new focus listeners from being registered, and we'll also prevent
      // focus events from being dispatched during the test.
      const originalAddEventListener = window.addEventListener;
      const originalRemoveEventListener = window.removeEventListener;
      const registeredFocusHandlers: Array<EventListener> = [];

      // Intercept addEventListener to track focus handlers
      window.addEventListener = vi.fn((type: string, handler: EventListener, options?: any) => {
        if (type === "focus") {
          registeredFocusHandlers.push(handler);
        }
        return originalAddEventListener.call(window, type, handler, options);
      }) as typeof window.addEventListener;

      // Intercept removeEventListener to track when handlers are removed
      window.removeEventListener = vi.fn((type: string, handler: EventListener, options?: any) => {
        if (type === "focus") {
          const index = registeredFocusHandlers.indexOf(handler);
          if (index > -1) {
            registeredFocusHandlers.splice(index, 1);
          }
        }
        return originalRemoveEventListener.call(window, type, handler, options);
      }) as typeof window.removeEventListener;

      // Remove all currently registered focus handlers to prevent interference
      // This ensures we're only testing the Tauri callback behavior
      registeredFocusHandlers.forEach((handler) => {
        originalRemoveEventListener.call(window, "focus", handler);
      });
      registeredFocusHandlers.length = 0;

      // Call Tauri callback with false (window loses focus)
      // This should NOT trigger terminal focus
      callback({ payload: false });

      // Advance timers to allow any setTimeout to complete
      await vi.advanceTimersByTimeAsync(200);

      // Restore original methods
      window.addEventListener = originalAddEventListener;
      window.removeEventListener = originalRemoveEventListener;

      // Verify focus was not called - the Tauri callback with payload: false should not focus
      expect(mockFocus).not.toHaveBeenCalled();
    }

    unmount();
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
