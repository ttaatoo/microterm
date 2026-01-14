import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useTerminalResize } from "./useTerminalResize";
import { PtyManager } from "@/lib/ptyManager";
import type { Terminal } from "@xterm/xterm";
import { createRef } from "react";
import type { setupTerminalAddons } from "@/lib/terminalAddons";

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

global.ResizeObserver = MockResizeObserver as any;

describe("useTerminalResize", () => {
  let mockTerminal: Terminal;
  let mockPtyManager: PtyManager;
  let mockFitAddon: ReturnType<typeof setupTerminalAddons>["fitAddon"];
  let containerRef: React.RefObject<HTMLDivElement | null>;
  let mockOnResize: ReturnType<typeof vi.fn>;
  let mockDisposeResizeListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDisposeResizeListener = vi.fn();
    mockOnResize = vi.fn();
    mockTerminal = {
      cols: 80,
      rows: 24,
      onResize: vi.fn((callback) => {
        mockOnResize.mockImplementation(callback);
        return { dispose: mockDisposeResizeListener };
      }),
    } as unknown as Terminal;

    mockFitAddon = {
      fit: vi.fn(),
      activate: vi.fn(),
      dispose: vi.fn(),
      proposeDimensions: vi.fn(),
    } as ReturnType<typeof setupTerminalAddons>["fitAddon"];

    mockPtyManager = {
      getSessionId: vi.fn().mockReturnValue("test-session-id"),
      resize: vi.fn().mockResolvedValue(undefined),
    } as unknown as PtyManager;

    containerRef = createRef<HTMLDivElement>();
    const div = document.createElement("div");
    containerRef.current = div;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not setup ResizeObserver when containerRef is null", () => {
    const nullRef = createRef<HTMLDivElement>();
    renderHook(() =>
      useTerminalResize({
        containerRef: nullRef,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        ptyManager: mockPtyManager,
      })
    );

    expect(mockTerminal.onResize).not.toHaveBeenCalled();
  });

  it("should not setup ResizeObserver when terminal is null", () => {
    renderHook(() =>
      useTerminalResize({
        containerRef,
        terminal: null,
        fitAddon: mockFitAddon,
        ptyManager: mockPtyManager,
      })
    );

    expect(mockTerminal.onResize).not.toHaveBeenCalled();
  });

  it("should not setup ResizeObserver when fitAddon is null", () => {
    renderHook(() =>
      useTerminalResize({
        containerRef,
        terminal: mockTerminal,
        fitAddon: null,
        ptyManager: mockPtyManager,
      })
    );

    expect(mockTerminal.onResize).not.toHaveBeenCalled();
  });

  it("should setup ResizeObserver and terminal resize listener", async () => {
    renderHook(() =>
      useTerminalResize({
        containerRef,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        ptyManager: mockPtyManager,
      })
    );

    await waitFor(() => {
      expect(mockTerminal.onResize).toHaveBeenCalled();
    });

    // Verify ResizeObserver was created and observe was called
    // Note: We can't directly access the ResizeObserver instance, but we can verify
    // that the terminal's onResize was called, which indicates setup happened
    expect(mockTerminal.onResize).toHaveBeenCalled();
  });

  it("should fit terminal and resize PTY on container resize", async () => {
    let resizeCallback: ResizeObserverCallback | null = null;

    // Intercept ResizeObserver constructor to capture callback
    const OriginalResizeObserver = global.ResizeObserver;
    global.ResizeObserver = class extends OriginalResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        resizeCallback = callback;
      }
    } as any;

    renderHook(() =>
      useTerminalResize({
        containerRef,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        ptyManager: mockPtyManager,
      })
    );

    await waitFor(() => {
      expect(resizeCallback).not.toBeNull();
    });

    if (resizeCallback) {
      act(() => {
        resizeCallback!([], {} as ResizeObserver);
      });

      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
        expect(mockPtyManager.resize).toHaveBeenCalledWith(80, 24);
      });
    }

    global.ResizeObserver = OriginalResizeObserver;
  });

  it("should resize PTY when terminal emits resize event", async () => {
    renderHook(() =>
      useTerminalResize({
        containerRef,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        ptyManager: mockPtyManager,
      })
    );

    await waitFor(() => {
      expect(mockTerminal.onResize).toHaveBeenCalled();
    });

    act(() => {
      (mockOnResize as any)({ cols: 100, rows: 30 });
    });

    await waitFor(() => {
      expect(mockPtyManager.resize).toHaveBeenCalledWith(100, 30);
    });
  });

  it("should not resize PTY when ptyManager is null", async () => {
    let resizeCallback: ResizeObserverCallback | null = null;

    const OriginalResizeObserver = global.ResizeObserver;
    global.ResizeObserver = class extends OriginalResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        resizeCallback = callback;
      }
    } as any;

    renderHook(() =>
      useTerminalResize({
        containerRef,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        ptyManager: null,
      })
    );

    await waitFor(() => {
      expect(resizeCallback).not.toBeNull();
    });

    if (resizeCallback) {
      act(() => {
        resizeCallback!([], {} as ResizeObserver);
      });

      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });

      // Should not throw even if ptyManager is null
      expect(mockPtyManager.resize).not.toHaveBeenCalled();
    }

    global.ResizeObserver = OriginalResizeObserver;
  });

  it("should re-fit terminal when becoming visible", async () => {
    const { rerender } = renderHook(
      ({ isVisible }) =>
        useTerminalResize({
          containerRef,
          terminal: mockTerminal,
          fitAddon: mockFitAddon,
          ptyManager: mockPtyManager,
          isVisible,
        }),
      { initialProps: { isVisible: false } }
    );

    vi.mocked(mockFitAddon.fit).mockClear();
    vi.mocked(mockPtyManager.resize).mockClear();

    rerender({ isVisible: true });

    // Wait for requestAnimationFrame to execute
    await waitFor(() => {
      expect(mockFitAddon.fit).toHaveBeenCalled();
    }, { timeout: 1000 });

    if (mockPtyManager.getSessionId()) {
      await waitFor(() => {
        expect(mockPtyManager.resize).toHaveBeenCalled();
      }, { timeout: 1000 });
    }
  });

  it("should not re-fit when not visible", async () => {
    renderHook(() =>
      useTerminalResize({
        containerRef,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        ptyManager: mockPtyManager,
        isVisible: false,
      })
    );

    vi.mocked(mockFitAddon?.fit).mockClear();

    // Wait a bit to ensure no fit call happens
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should not fit when not visible
    expect(mockFitAddon.fit).not.toHaveBeenCalled();
  });

  it("should cleanup ResizeObserver and terminal listener on unmount", async () => {
    let resizeObserverInstance: MockResizeObserver | null = null;

    const OriginalResizeObserver = global.ResizeObserver;
    global.ResizeObserver = class extends OriginalResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        resizeObserverInstance = new MockResizeObserver();
        return resizeObserverInstance as any;
      }
    } as any;

    const { unmount } = renderHook(() =>
      useTerminalResize({
        containerRef,
        terminal: mockTerminal,
        fitAddon: mockFitAddon,
        ptyManager: mockPtyManager,
      })
    );

    await waitFor(() => {
      expect(resizeObserverInstance).not.toBeNull();
    });

    unmount();

    if (resizeObserverInstance) {
      const instance = resizeObserverInstance as MockResizeObserver;
      expect(instance.disconnect).toHaveBeenCalled();
    }
    expect(mockDisposeResizeListener).toHaveBeenCalled();

    global.ResizeObserver = OriginalResizeObserver;
  });
});
