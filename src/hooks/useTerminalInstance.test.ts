import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTerminalInstance } from "./useTerminalInstance";
import { createRef } from "react";

// Mock dependencies
vi.mock("@xterm/xterm", () => ({
  Terminal: class MockTerminal {
    open = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    onData = vi.fn();
    cols = 80;
    rows = 24;
    options: any = {};
    refresh = vi.fn();
    scrollToLine = vi.fn();
    buffer: any;
    element: HTMLElement | undefined;

    constructor(_options: any) {
      this.options = _options;
      // Create a mock DOM element
      this.element = document.createElement("div");
      // Initialize mutable buffer
      this.buffer = {
        active: {
          viewportY: 0,
        },
      };
    }
  },
}));

vi.mock("@/lib/terminal/theme", () => ({
  getTerminalTheme: vi.fn((opacity) => ({
    background: `rgba(0, 0, 0, ${opacity})`,
    foreground: "#abb2bf",
  })),
}));

vi.mock("@/lib/terminalAddons", () => ({
  setupTerminalAddons: vi.fn(() => ({
    fitAddon: { fit: vi.fn() } as any,
    searchAddon: {} as any,
    webLinksAddon: {} as any,
    webglAddon: { dispose: vi.fn() } as any,
  })),
}));

vi.mock("@/lib/settings", () => ({
  loadSettings: vi.fn(() => ({
    opacity: 0.96,
    fontSize: 14,
  })),
}));

import { getTerminalTheme } from "@/lib/terminal/theme";
import { setupTerminalAddons } from "@/lib/terminalAddons";

describe("useTerminalInstance", () => {
  let containerRef: ReturnType<typeof createRef<HTMLDivElement>>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a real DOM element for the container
    const div = document.createElement("div");
    document.body.appendChild(div);

    containerRef = { current: div };
  });

  it("should create terminal instance on mount", () => {
    const { result } = renderHook(() =>
      useTerminalInstance({
        containerRef,
        opacity: 0.95,
        fontSize: 16,
      })
    );

    // Check that terminal was created
    expect(result.current).not.toBeNull();
    expect(result.current?.terminal).toBeDefined();
    expect(result.current?.fitAddon).toBeDefined();

    // Verify terminal options
    expect(result.current?.terminal.options).toMatchObject({
      fontSize: 16,
      cursorBlink: true,
      cursorStyle: "block",
    });
  });

  it("should apply initial opacity from props", () => {
    renderHook(() =>
      useTerminalInstance({
        containerRef,
        opacity: 0.85,
      })
    );

    expect(getTerminalTheme).toHaveBeenCalledWith(0.85);
  });

  it("should update theme when opacity changes", () => {
    const { rerender } = renderHook(
      ({ opacity }) =>
        useTerminalInstance({
          containerRef,
          opacity,
        }),
      { initialProps: { opacity: 0.95 } }
    );

    vi.clearAllMocks();

    // Change opacity
    rerender({ opacity: 0.80 });

    expect(getTerminalTheme).toHaveBeenCalledWith(0.80);
  });

  it("should register onData handler if provided", () => {
    const mockOnData = vi.fn();

    const { result } = renderHook(() =>
      useTerminalInstance({
        containerRef,
        onData: mockOnData,
      })
    );

    // Verify onData was called during setup
    expect(result.current?.terminal.onData).toHaveBeenCalledWith(mockOnData);
  });

  it("should skip initial fit when container has zero size", () => {
    const fitMock = vi.fn();
    const setupMock = vi.mocked(setupTerminalAddons);

    setupMock.mockReturnValueOnce({
      fitAddon: { fit: fitMock } as any,
      searchAddon: {} as any,
      webLinksAddon: {} as any,
      webglAddon: { dispose: vi.fn() } as any,
    });

    const rectSpy = vi
      .spyOn(containerRef.current!, "getBoundingClientRect")
      .mockReturnValue({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        x: 0,
        y: 0,
        toJSON: () => "",
      } as DOMRect);

    renderHook(() =>
      useTerminalInstance({
        containerRef,
      })
    );

    expect(fitMock).not.toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it("should cleanup on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useTerminalInstance({
        containerRef,
      })
    );

    const terminal = result.current?.terminal;
    expect(terminal).toBeDefined();

    unmount();

    // Verify dispose was called
    expect(terminal?.dispose).toHaveBeenCalled();
  });

  describe("Terminal Caching", () => {
    it("should cache terminal when paneId is provided", () => {
      const { result, unmount } = renderHook(() =>
        useTerminalInstance({
          containerRef,
          paneId: "pane-1",
        })
      );

      const cachedTerminal = result.current?.terminal;
      expect(cachedTerminal).toBeDefined();

      unmount();

      // Terminal should NOT be disposed when cached
      expect(cachedTerminal?.dispose).not.toHaveBeenCalled();
    });

    it("should reuse cached terminal on remount", () => {
      // First mount
      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useTerminalInstance({
          containerRef,
          paneId: "pane-1",
        })
      );

      const firstTerminal = result1.current?.terminal;
      const firstElement = firstTerminal?.element;
      expect(firstTerminal).toBeDefined();

      unmount1();

      // Create new container for remount
      const div2 = document.createElement("div");
      document.body.appendChild(div2);
      const containerRef2 = { current: div2 };

      // Second mount with same paneId
      const { result: result2 } = renderHook(() =>
        useTerminalInstance({
          containerRef: containerRef2,
          paneId: "pane-1",
        })
      );

      const secondTerminal = result2.current?.terminal;

      // Should be the same terminal instance
      expect(secondTerminal).toBe(firstTerminal);
      expect(secondTerminal?.element).toBe(firstElement);
    });

    it("should preserve scroll position on cache hit", () => {
      // First mount
      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useTerminalInstance({
          containerRef,
          paneId: "pane-2",
        })
      );

      const terminal = result1.current?.terminal;
      expect(terminal).toBeDefined();

      // Mock the scroll position by replacing the buffer object
      if (terminal) {
        Object.defineProperty(terminal, "buffer", {
          value: {
            active: { viewportY: 42 },
          },
          writable: true,
          configurable: true,
        });
      }

      unmount1();

      // Create new container for remount
      const div2 = document.createElement("div");
      document.body.appendChild(div2);
      const containerRef2 = { current: div2 };

      // Second mount with same paneId - should restore scroll position
      renderHook(() =>
        useTerminalInstance({
          containerRef: containerRef2,
          paneId: "pane-2",
        })
      );

      // Wait for requestAnimationFrame
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          // Should restore to saved scroll position (42)
          expect(terminal?.scrollToLine).toHaveBeenCalledWith(42);
          resolve();
        });
      });
    });

    it("should not cache terminal when paneId is not provided", () => {
      // First mount without paneId
      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useTerminalInstance({
          containerRef,
        })
      );

      const firstTerminal = result1.current?.terminal;
      expect(firstTerminal).toBeDefined();

      unmount1();

      // Terminal should be disposed
      expect(firstTerminal?.dispose).toHaveBeenCalled();

      // Second mount without paneId should create new terminal
      const div2 = document.createElement("div");
      document.body.appendChild(div2);
      const containerRef2 = { current: div2 };

      const { result: result2 } = renderHook(() =>
        useTerminalInstance({
          containerRef: containerRef2,
        })
      );

      const secondTerminal = result2.current?.terminal;

      // Should be a different terminal instance
      expect(secondTerminal).not.toBe(firstTerminal);
    });

    it("should handle different paneIds as separate caches", () => {
      // Mount terminal for pane-1
      const { result: result1 } = renderHook(() =>
        useTerminalInstance({
          containerRef,
          paneId: "pane-1",
        })
      );

      const terminal1 = result1.current?.terminal;

      // Mount terminal for pane-2
      const div2 = document.createElement("div");
      document.body.appendChild(div2);
      const containerRef2 = { current: div2 };

      const { result: result2 } = renderHook(() =>
        useTerminalInstance({
          containerRef: containerRef2,
          paneId: "pane-2",
        })
      );

      const terminal2 = result2.current?.terminal;

      // Should be different terminal instances
      expect(terminal1).not.toBe(terminal2);
      expect(terminal1).toBeDefined();
      expect(terminal2).toBeDefined();
    });
  });

  describe("disposeCachedTerminal", () => {
    it("should dispose and remove cached terminal", async () => {
      const { disposeCachedTerminal } = await import("./useTerminalInstance");

      // Create cached terminal
      const { result } = renderHook(() =>
        useTerminalInstance({
          containerRef,
          paneId: "pane-dispose",
        })
      );

      const terminal = result.current?.terminal;
      expect(terminal).toBeDefined();

      // Dispose cached terminal
      disposeCachedTerminal("pane-dispose");

      // Verify dispose was called
      expect(terminal?.dispose).toHaveBeenCalled();

      // Remount should create new terminal (cache was cleared)
      const div2 = document.createElement("div");
      document.body.appendChild(div2);
      const containerRef2 = { current: div2 };

      const { result: result2 } = renderHook(() =>
        useTerminalInstance({
          containerRef: containerRef2,
          paneId: "pane-dispose",
        })
      );

      const newTerminal = result2.current?.terminal;

      // Should be a different terminal instance
      expect(newTerminal).not.toBe(terminal);
    });

    it("should handle disposing non-existent cache gracefully", async () => {
      const { disposeCachedTerminal } = await import("./useTerminalInstance");

      // Should not throw when disposing non-existent cache
      expect(() => disposeCachedTerminal("non-existent-pane")).not.toThrow();
    });
  });
});
