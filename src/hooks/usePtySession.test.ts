import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { usePtySession } from "./usePtySession";
import type { Terminal } from "@xterm/xterm";
import { MAX_PTY_RETRIES, PTY_RESTART_DELAY_MS } from "@/lib/constants";

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: any[]) => mockListen(...args),
}));

// Mock ptyUtils
vi.mock("@/lib/ptyUtils", () => ({
  ensureValidDimensions: vi.fn((cols: number, rows: number) => ({ cols, rows })),
}));

describe("usePtySession", () => {
  let mockTerminal: Terminal;
  let mockOnSessionCreated: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnSessionCreated = vi.fn();
    mockTerminal = {
      cols: 80,
      rows: 24,
      write: vi.fn(),
    } as unknown as Terminal;

    mockInvoke.mockClear();
    mockListen.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return session management functions", () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    expect(result.current.sessionIdRef).toBeDefined();
    expect(result.current.createSession).toBeDefined();
    expect(result.current.reuseSession).toBeDefined();
    expect(result.current.writeToSession).toBeDefined();
    expect(result.current.resizeSession).toBeDefined();
    expect(result.current.closeSession).toBeDefined();
    expect(result.current.setupListeners).toBeDefined();
  });

  it("should create a new session", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    mockInvoke.mockResolvedValue("new-session-id");

    await act(async () => {
      await result.current.createSession(80, 24);
    });

    expect(mockInvoke).toHaveBeenCalledWith("create_pty_session", {
      cols: 80,
      rows: 24,
    });
    expect(result.current.sessionIdRef.current).toBe("new-session-id");
    expect(mockOnSessionCreated).toHaveBeenCalledWith("new-session-id");
  });

  it("should retry on failure", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    // First call fails, second succeeds
    mockInvoke
      .mockRejectedValueOnce(new Error("Failed"))
      .mockResolvedValueOnce("retry-session-id");

    await act(async () => {
      const promise = result.current.createSession(80, 24);
      // Advance timers to trigger retry
      await vi.advanceTimersByTimeAsync(1000);
      await promise;
    });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(result.current.sessionIdRef.current).toBe("retry-session-id");
  });

  it("should stop retrying after max retries", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    mockInvoke.mockRejectedValue(new Error("Failed"));

    await act(async () => {
      const promise = result.current.createSession(80, 24);
      // Advance timers through all retries
      for (let i = 0; i < MAX_PTY_RETRIES + 1; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }
      await promise;
    });

    expect(mockInvoke).toHaveBeenCalledTimes(MAX_PTY_RETRIES + 1);
    expect(mockTerminal.write).toHaveBeenCalledWith(
      expect.stringContaining("Failed to create terminal")
    );
  });

  it("should reuse existing session", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    mockInvoke.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.reuseSession("existing-session-id", 80, 24);
    });

    expect(result.current.sessionIdRef.current).toBe("existing-session-id");
    expect(mockInvoke).toHaveBeenCalledWith("resize_pty", {
      sessionId: "existing-session-id",
      cols: 80,
      rows: 24,
    });
  });

  it("should create new session if reuse fails", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    mockInvoke
      .mockRejectedValueOnce(new Error("Reuse failed"))
      .mockResolvedValueOnce("new-session-id");

    await act(async () => {
      await result.current.reuseSession("existing-session-id", 80, 24);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(result.current.sessionIdRef.current).toBe("new-session-id");
  });

  it("should write to session", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    result.current.sessionIdRef.current = "test-session-id";
    mockInvoke.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.writeToSession("test data");
    });

    expect(mockInvoke).toHaveBeenCalledWith("write_to_pty", {
      sessionId: "test-session-id",
      data: "test data",
    });
  });

  it("should not write when sessionId is null", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    result.current.sessionIdRef.current = null;

    await act(async () => {
      await result.current.writeToSession("test data");
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should reconnect on write failure", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    result.current.sessionIdRef.current = "old-session-id";
    mockInvoke
      .mockRejectedValueOnce(new Error("Write failed"))
      .mockResolvedValueOnce(undefined) // close_pty_session
      .mockResolvedValueOnce("new-session-id"); // create_pty_session

    await act(async () => {
      await result.current.writeToSession("test data");
    });

    expect(mockInvoke).toHaveBeenCalledWith("close_pty_session", {
      sessionId: "old-session-id",
    });
    expect(mockInvoke).toHaveBeenCalledWith("create_pty_session", {
      cols: 80,
      rows: 24,
    });
    expect(result.current.sessionIdRef.current).toBe("new-session-id");
  });

  it("should resize session", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    result.current.sessionIdRef.current = "test-session-id";
    mockInvoke.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.resizeSession(100, 50);
    });

    expect(mockInvoke).toHaveBeenCalledWith("resize_pty", {
      sessionId: "test-session-id",
      cols: 100,
      rows: 50,
    });
  });

  it("should not resize when sessionId is null", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    result.current.sessionIdRef.current = null;

    await act(async () => {
      await result.current.resizeSession(100, 50);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should close session", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    result.current.sessionIdRef.current = "test-session-id";
    mockInvoke.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.closeSession();
    });

    expect(mockInvoke).toHaveBeenCalledWith("close_pty_session", {
      sessionId: "test-session-id",
    });
    expect(result.current.sessionIdRef.current).toBeNull();
  });

  it("should setup listeners for PTY output and exit", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    const mockUnlistenOutput = vi.fn();
    const mockUnlistenExit = vi.fn();

    mockListen
      .mockResolvedValueOnce(mockUnlistenOutput)
      .mockResolvedValueOnce(mockUnlistenExit);

    let cleanup: (() => void) | undefined;

    await act(async () => {
      cleanup = await result.current.setupListeners();
    });

    expect(mockListen).toHaveBeenCalledWith("pty-output", expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith("pty-exit", expect.any(Function));
    expect(cleanup).toBeDefined();

    // Test cleanup
    if (cleanup) {
      act(() => {
        cleanup();
      });
      expect(mockUnlistenOutput).toHaveBeenCalled();
      expect(mockUnlistenExit).toHaveBeenCalled();
    }
  });

  it("should write terminal output when PTY output event is received", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    result.current.sessionIdRef.current = "test-session-id";

    let outputCallback: ((event: any) => void) | undefined;

    mockListen.mockImplementation((eventName, callback) => {
      if (eventName === "pty-output") {
        outputCallback = callback;
      }
      return Promise.resolve(vi.fn());
    });

    await act(async () => {
      await result.current.setupListeners();
    });

    if (outputCallback) {
      act(() => {
        outputCallback({
          payload: {
            session_id: "test-session-id",
            data: "test output",
          },
        });
      });

      expect(mockTerminal.write).toHaveBeenCalledWith("test output");
    }
  });

  it("should restart session on PTY exit", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: mockTerminal,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    result.current.sessionIdRef.current = "test-session-id";
    mockInvoke.mockResolvedValue("new-session-id");

    let exitCallback: ((event: any) => void) | undefined;

    mockListen.mockImplementation((eventName, callback) => {
      if (eventName === "pty-exit") {
        exitCallback = callback;
      }
      return Promise.resolve(vi.fn());
    });

    await act(async () => {
      await result.current.setupListeners();
    });

    if (exitCallback) {
      act(() => {
        exitCallback({
          payload: {
            session_id: "test-session-id",
            exit_code: 0,
          },
        });
      });

      // Advance timers to trigger restart
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PTY_RESTART_DELAY_MS);
      });

      expect(mockTerminal.write).toHaveBeenCalledWith(
        expect.stringContaining("[Process exited]")
      );
      expect(mockInvoke).toHaveBeenCalledWith("create_pty_session", {
        cols: 80,
        rows: 24,
      });
    }
  });

  it("should return empty cleanup when terminal is null", async () => {
    const { result } = renderHook(() =>
      usePtySession({
        terminal: null,
        onSessionCreated: mockOnSessionCreated,
      })
    );

    let cleanup: (() => void) | undefined;

    await act(async () => {
      cleanup = await result.current.setupListeners();
    });

    expect(cleanup).toBeDefined();
    expect(typeof cleanup).toBe("function");
    // Should not throw when called
    act(() => {
      cleanup?.();
    });
  });
});
