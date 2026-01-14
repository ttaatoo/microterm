import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTerminalPty } from "./useTerminalPty";

// Mock PtyManager
vi.mock("@/lib/ptyManager", () => {
  return {
    PtyManager: class MockPtyManager {
      ensureReady = vi.fn().mockResolvedValue(undefined);
      setupListeners = vi.fn().mockResolvedValue(() => {});
      createSession = vi.fn();
      reuseSession = vi.fn();
      close = vi.fn().mockResolvedValue(undefined);
      getSessionId = vi.fn().mockReturnValue("test-session-id");

      constructor({ onSessionCreated }: any) {
        this.createSession.mockImplementation(async () => {
          onSessionCreated?.("test-session-id");
        });
        this.reuseSession.mockImplementation(async () => {
          onSessionCreated?.("reused-session-id");
        });
      }
    },
  };
});

// Mock Terminal
const createMockTerminal = () => ({
  cols: 80,
  rows: 24,
  open: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
  onData: vi.fn(),
  onResize: vi.fn(),
  options: {},
});

describe("useTerminalPty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not initialize when terminal is null", () => {
    const { result } = renderHook(() =>
      useTerminalPty({
        terminal: null,
      })
    );

    expect(result.current.sessionId).toBeNull();
    expect(result.current.isReady).toBe(false);
    expect(result.current.ptyManager).toBeNull();
  });

  it("should create PTY manager when terminal is provided", async () => {
    const mockTerminal = createMockTerminal();

    const { result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    await waitFor(() => {
      expect(result.current.ptyManager).not.toBeNull();
      expect(result.current.ptyManager).toHaveProperty("ensureReady");
      expect(result.current.ptyManager).toHaveProperty("createSession");
    });
  });

  it("should create new session by default", async () => {
    const mockTerminal = createMockTerminal();

    const { result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // Verify createSession was called (not reuseSession)
    const mockPtyManager = result.current.ptyManager;
    expect(mockPtyManager).not.toBeNull();
    expect(mockPtyManager!.createSession).toHaveBeenCalledWith(80, 24);
    expect(mockPtyManager!.reuseSession).not.toHaveBeenCalled();
  });

  it("should reuse existing session when provided", async () => {
    const mockTerminal = createMockTerminal();

    const { result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
        existingSessionId: "existing-session",
      })
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // Verify reuseSession was called (not createSession)
    const mockPtyManager = result.current.ptyManager;
    expect(mockPtyManager).not.toBeNull();
    expect(mockPtyManager!.reuseSession).toHaveBeenCalledWith("existing-session", 80, 24);
    expect(mockPtyManager!.createSession).not.toHaveBeenCalled();
  });

  it("should call onSessionCreated callback", async () => {
    const mockTerminal = createMockTerminal();
    const onSessionCreated = vi.fn();

    renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
        onSessionCreated,
      })
    );

    await waitFor(() => {
      expect(onSessionCreated).toHaveBeenCalledWith("test-session-id");
    });
  });

  it("should set sessionId state", async () => {
    const mockTerminal = createMockTerminal();

    const { result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    await waitFor(() => {
      expect(result.current.sessionId).toBe("test-session-id");
    });
  });

  it("should set isReady flag after initialization", async () => {
    const mockTerminal = createMockTerminal();

    const { result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    // Initially not ready
    expect(result.current.isReady).toBe(false);

    // Should become ready
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
  });

  it("should return ptyManager reference", async () => {
    const mockTerminal = createMockTerminal();

    const { result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    await waitFor(() => {
      expect(result.current.ptyManager).not.toBeNull();
    });

    expect(result.current.ptyManager).toHaveProperty("ensureReady");
    expect(result.current.ptyManager).toHaveProperty("createSession");
  });

  it("should call ensureReady before creating session", async () => {
    const mockTerminal = createMockTerminal();

    const { result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    await waitFor(() => {
      const mockPtyManager = result.current.ptyManager;
      expect(mockPtyManager).not.toBeNull();
      expect(mockPtyManager!.ensureReady).toHaveBeenCalled();
    });
  });

  it("should setup listeners before creating session", async () => {
    const mockTerminal = createMockTerminal();

    const { result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    await waitFor(() => {
      const mockPtyManager = result.current.ptyManager;
      expect(mockPtyManager).not.toBeNull();
      expect(mockPtyManager!.setupListeners).toHaveBeenCalled();
    });
  });

  it("should cleanup on unmount", async () => {
    const mockTerminal = createMockTerminal();

    const { unmount, result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const mockPtyManager = result.current.ptyManager;
    expect(mockPtyManager).not.toBeNull();

    unmount();

    // PTY session should NOT be closed on unmount - it may be reused
    // Only event listeners are cleaned up
    await waitFor(() => {
      expect(mockPtyManager!.close).not.toHaveBeenCalled();
    });
  });

  it("should handle cleanup without closing session", async () => {
    const mockTerminal = createMockTerminal();

    const { unmount, result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const mockPtyManager = result.current.ptyManager;
    expect(mockPtyManager).not.toBeNull();

    unmount();

    // Cleanup should not call close() - session is preserved
    await waitFor(() => {
      expect(mockPtyManager!.close).not.toHaveBeenCalled();
    });
  });

  it("should not update state after unmount", async () => {
    const mockTerminal = createMockTerminal();

    const { unmount, result } = renderHook(() =>
      useTerminalPty({
        terminal: mockTerminal as any,
      })
    );

    // Unmount immediately before initialization completes
    unmount();

    // Wait to ensure initialization would have completed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should not have set state after unmount
    expect(result.current.isReady).toBe(false);
  });
});
