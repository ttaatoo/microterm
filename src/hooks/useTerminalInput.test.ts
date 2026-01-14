import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useTerminalInput } from "./useTerminalInput";
import { PtyManager } from "@/lib/ptyManager";
import type { Terminal } from "@xterm/xterm";
import { ESC_KEY, DOUBLE_ESC_INTERVAL_MS } from "@/lib/constants";

// Mock Tauri APIs
const mockInvoke = vi.fn().mockResolvedValue(undefined);
const mockGetInvoke = vi.fn().mockResolvedValue(mockInvoke);

vi.mock("@/lib/tauri", () => ({
  getInvoke: () => mockGetInvoke(),
}));

vi.mock("@/lib/settings", () => ({
  loadSettings: vi.fn(() => ({
    pinned: false,
  })),
}));

vi.mock("@/lib/guards", () => ({
  isPinStatePayload: vi.fn((payload: any) => {
    return payload && typeof payload === "object" && "pinned" in payload;
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((eventName, callback) => {
    if (eventName === "pin-state-updated") {
      // Store callback for testing
      (window as any).__pinStateCallback = callback;
      return Promise.resolve(vi.fn());
    }
    return Promise.resolve(vi.fn());
  }),
}));

describe("useTerminalInput", () => {
  let mockTerminal: Terminal;
  let mockPtyManager: PtyManager;
  let mockOnData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnData = vi.fn();
    mockTerminal = {
      onData: vi.fn((handler) => {
        mockOnData.mockImplementation(handler);
        return { dispose: vi.fn() };
      }),
    } as unknown as Terminal;

    mockPtyManager = {
      getSessionId: vi.fn().mockReturnValue("test-session-id"),
      write: vi.fn().mockResolvedValue(undefined),
    } as unknown as PtyManager;

    mockInvoke.mockClear();
    mockGetInvoke.mockClear();
    delete (window as any).__pinStateCallback;
    delete (window as any).__TAURI__;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should register terminal data handler", () => {
    renderHook(() =>
      useTerminalInput({
        terminal: mockTerminal,
        ptyManager: mockPtyManager,
        isPtyReady: true,
      })
    );

    expect(mockTerminal.onData).toHaveBeenCalled();
  });

  it("should write input to PTY when ready", async () => {
    renderHook(() =>
      useTerminalInput({
        terminal: mockTerminal,
        ptyManager: mockPtyManager,
        isPtyReady: true,
      })
    );

    await waitFor(() => {
      expect(mockOnData).toBeDefined();
    });

    act(() => {
      mockOnData("test input");
    });

    await waitFor(() => {
      expect(mockPtyManager.write).toHaveBeenCalledWith("test input");
    });
  });

  it("should buffer input when PTY is not ready", async () => {
    renderHook(() =>
      useTerminalInput({
        terminal: mockTerminal,
        ptyManager: mockPtyManager,
        isPtyReady: false,
      })
    );

    await waitFor(() => {
      expect(mockOnData).toBeDefined();
    });

    act(() => {
      mockOnData("buffered input");
    });

    expect(mockPtyManager.write).not.toHaveBeenCalled();
  });

  it("should flush buffered input when PTY becomes ready", async () => {
    const { rerender } = renderHook(
      ({ isPtyReady }) =>
        useTerminalInput({
          terminal: mockTerminal,
          ptyManager: mockPtyManager,
          isPtyReady,
        }),
      { initialProps: { isPtyReady: false } }
    );

    await waitFor(() => {
      expect(mockOnData).toBeDefined();
    });

    act(() => {
      mockOnData("buffered 1");
      mockOnData("buffered 2");
    });

    expect(mockPtyManager.write).not.toHaveBeenCalled();

    rerender({ isPtyReady: true });

    await waitFor(() => {
      expect(mockPtyManager.write).toHaveBeenCalledWith("buffered 1buffered 2");
    });
  });

  it("should hide window on double ESC when not pinned", async () => {
    (window as any).__TAURI__ = {};
    renderHook(() =>
      useTerminalInput({
        terminal: mockTerminal,
        ptyManager: mockPtyManager,
        isPtyReady: true,
      })
    );

    await waitFor(() => {
      expect(mockOnData).toBeDefined();
    });

    act(() => {
      mockOnData(ESC_KEY);
    });

    // Wait a bit less than DOUBLE_ESC_INTERVAL_MS
    await new Promise((resolve) => setTimeout(resolve, DOUBLE_ESC_INTERVAL_MS - 10));

    act(() => {
      mockOnData(ESC_KEY);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("hide_window");
    });
  });

  it("should not hide window on double ESC when pinned", async () => {
    (window as any).__TAURI__ = {};
    const { loadSettings } = await import("@/lib/settings");
    vi.mocked(loadSettings).mockReturnValue({ pinned: true });

    renderHook(() =>
      useTerminalInput({
        terminal: mockTerminal,
        ptyManager: mockPtyManager,
        isPtyReady: true,
      })
    );

    await waitFor(() => {
      expect(mockOnData).toBeDefined();
    });

    act(() => {
      mockOnData(ESC_KEY);
    });

    await new Promise((resolve) => setTimeout(resolve, DOUBLE_ESC_INTERVAL_MS - 10));

    act(() => {
      mockOnData(ESC_KEY);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should not hide window if ESC presses are too far apart", async () => {
    (window as any).__TAURI__ = {};
    renderHook(() =>
      useTerminalInput({
        terminal: mockTerminal,
        ptyManager: mockPtyManager,
        isPtyReady: true,
      })
    );

    await waitFor(() => {
      expect(mockOnData).toBeDefined();
    });

    act(() => {
      mockOnData(ESC_KEY);
    });

    // Wait longer than DOUBLE_ESC_INTERVAL_MS
    await new Promise((resolve) => setTimeout(resolve, DOUBLE_ESC_INTERVAL_MS + 10));

    act(() => {
      mockOnData(ESC_KEY);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should update pin state from event", async () => {
    (window as any).__TAURI__ = {};
    renderHook(() =>
      useTerminalInput({
        terminal: mockTerminal,
        ptyManager: mockPtyManager,
        isPtyReady: true,
      })
    );

    await waitFor(() => {
      expect((window as any).__pinStateCallback).toBeDefined();
    });

    const callback = (window as any).__pinStateCallback;
    if (callback) {
      act(() => {
        callback({ payload: { pinned: true } });
      });
    }

    // Verify pin state was updated by trying double ESC (should not hide)
    await waitFor(() => {
      expect(mockOnData).toBeDefined();
    });

    act(() => {
      mockOnData(ESC_KEY);
    });

    await new Promise((resolve) => setTimeout(resolve, DOUBLE_ESC_INTERVAL_MS - 10));

    act(() => {
      mockOnData(ESC_KEY);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should not write when PTY manager is null", async () => {
    renderHook(() =>
      useTerminalInput({
        terminal: mockTerminal,
        ptyManager: null,
        isPtyReady: true,
      })
    );

    await waitFor(() => {
      expect(mockOnData).toBeDefined();
    });

    act(() => {
      mockOnData("test");
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockPtyManager.write).not.toHaveBeenCalled();
  });

  it("should not write when session ID is null", async () => {
    const ptyManagerNoSession = {
      ...mockPtyManager,
      getSessionId: vi.fn().mockReturnValue(null),
    } as unknown as PtyManager;

    renderHook(() =>
      useTerminalInput({
        terminal: mockTerminal,
        ptyManager: ptyManagerNoSession,
        isPtyReady: true,
      })
    );

    await waitFor(() => {
      expect(mockOnData).toBeDefined();
    });

    act(() => {
      mockOnData("test");
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(ptyManagerNoSession.write).not.toHaveBeenCalled();
  });

  it("should cleanup terminal data handler on unmount", () => {
    const mockDispose = vi.fn();
    const terminalWithDispose = {
      ...mockTerminal,
      onData: vi.fn(() => ({ dispose: mockDispose })),
    } as unknown as Terminal;

    const { unmount } = renderHook(() =>
      useTerminalInput({
        terminal: terminalWithDispose,
        ptyManager: mockPtyManager,
        isPtyReady: true,
      })
    );

    unmount();
    expect(mockDispose).toHaveBeenCalled();
  });
});
