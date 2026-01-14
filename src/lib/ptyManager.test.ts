import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PtyManager } from "./ptyManager";
import type { Terminal } from "@xterm/xterm";
import { MAX_PTY_RETRIES, PTY_RESTART_DELAY_MS } from "@/lib/constants";

// Mock Tauri preload
const mockInvoke = vi.fn();
const mockGetInvoke = vi.fn().mockResolvedValue(mockInvoke);
const mockGetListen = vi.fn().mockResolvedValue(vi.fn());

vi.mock("@/lib/tauri/preload", () => ({
  getInvoke: () => mockGetInvoke(),
  getListen: () => mockGetListen(),
  ensurePreload: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tauri", () => ({
  getInvoke: () => mockGetInvoke(),
  getListen: () => mockGetListen(),
}));

// Mock ptyUtils
vi.mock("@/lib/ptyUtils", () => ({
  ensureValidDimensions: vi.fn((cols: number, rows: number) => ({ cols, rows })),
}));

describe("PtyManager", () => {
  let mockTerminal: Terminal;
  let mockOnSessionCreated: ((sessionId: string) => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnSessionCreated = vi.fn() as (sessionId: string) => void;
    mockTerminal = {
      cols: 80,
      rows: 24,
      write: vi.fn(),
    } as unknown as Terminal;

    mockInvoke.mockClear();
    mockGetInvoke.mockClear();
    mockGetListen.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create instance", () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    expect(manager).toBeInstanceOf(PtyManager);
    expect(manager.getSessionId()).toBeNull();
  });

  it("should create session", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    mockInvoke.mockResolvedValue("test-session-id");

    await manager.createSession(80, 24);

    expect(mockInvoke).toHaveBeenCalledWith("create_pty_session", {
      cols: 80,
      rows: 24,
    });
    expect(manager.getSessionId()).toBe("test-session-id");
    expect(mockOnSessionCreated).toHaveBeenCalledWith("test-session-id");
  });

  it("should retry on session creation failure", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    mockInvoke
      .mockRejectedValueOnce(new Error("Failed"))
      .mockResolvedValueOnce("retry-session-id");

    const promise = manager.createSession(80, 24);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(manager.getSessionId()).toBe("retry-session-id");
  });

  it("should stop retrying after max retries", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    mockInvoke.mockRejectedValue(new Error("Failed"));

    const promise = manager.createSession(80, 24);
    for (let i = 0; i < MAX_PTY_RETRIES + 1; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }
    await promise;

    expect(mockInvoke).toHaveBeenCalledTimes(MAX_PTY_RETRIES + 1);
    expect(mockTerminal.write).toHaveBeenCalledWith(
      expect.stringContaining("Failed to create terminal")
    );
  });

  it("should reuse existing session", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    mockInvoke.mockResolvedValue(undefined);

    await manager.reuseSession("existing-session-id", 80, 24);

    expect(manager.getSessionId()).toBe("existing-session-id");
    expect(mockInvoke).toHaveBeenCalledWith("resize_pty", {
      sessionId: "existing-session-id",
      cols: 80,
      rows: 24,
    });
  });

  it("should create new session if reuse fails", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    mockInvoke
      .mockRejectedValueOnce(new Error("Reuse failed"))
      .mockResolvedValueOnce("new-session-id");

    await manager.reuseSession("existing-session-id", 80, 24);

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(manager.getSessionId()).toBe("new-session-id");
  });

  it("should write to session", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    await manager.ensureReady();
    // Set sessionId directly by creating a session
    mockInvoke.mockResolvedValue("test-session-id");
    await manager.createSession(80, 24);
    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(undefined);

    await manager.write("test data");

    expect(mockInvoke).toHaveBeenCalledWith("write_to_pty", {
      sessionId: "test-session-id",
      data: "test data",
    });
  });

  it("should not write when sessionId is null", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    await manager.ensureReady();
    // Don't create a session, so sessionId will be null

    await manager.write("test data");

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should resize session", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    await manager.ensureReady();
    // Set sessionId by creating a session
    mockInvoke.mockResolvedValue("test-session-id");
    await manager.createSession(80, 24);
    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(undefined);

    await manager.resize(100, 50);

    expect(mockInvoke).toHaveBeenCalledWith("resize_pty", {
      sessionId: "test-session-id",
      cols: 100,
      rows: 50,
    });
  });

  it("should not resize when sessionId is null", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    await manager.ensureReady();
    // Don't create a session, so sessionId will be null

    await manager.resize(100, 50);

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should setup listeners", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    const mockUnlistenOutput = vi.fn();
    const mockUnlistenExit = vi.fn();
    const mockListen = vi
      .fn()
      .mockResolvedValueOnce(mockUnlistenOutput)
      .mockResolvedValueOnce(mockUnlistenExit);

    mockGetListen.mockResolvedValue(mockListen);

    const cleanup = await manager.setupListeners();

    expect(mockListen).toHaveBeenCalledWith("pty-output", expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith("pty-exit", expect.any(Function));
    expect(cleanup).toBeDefined();

    cleanup();
    expect(mockUnlistenOutput).toHaveBeenCalled();
    expect(mockUnlistenExit).toHaveBeenCalled();
  });

  it("should buffer and flush data", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    await manager.ensureReady();
    // Set sessionId by creating a session
    mockInvoke.mockResolvedValue("test-session-id");
    await manager.createSession(80, 24);

    // Setup listeners to enable buffering
    const mockListen = vi.fn().mockResolvedValue(vi.fn());
    mockGetListen.mockResolvedValue(mockListen);
    await manager.setupListeners();

    // Simulate PTY output events
    const outputCallback = mockListen.mock.calls.find(
      (call) => call[0] === "pty-output"
    )?.[1];

    if (outputCallback) {
      outputCallback({
        payload: {
          session_id: "test-session-id",
          data: "test",
        },
      });
      outputCallback({
        payload: {
          session_id: "test-session-id",
          data: " data",
        },
      });

      // Advance timers to trigger flush
      await vi.advanceTimersByTimeAsync(10);

      expect(mockTerminal.write).toHaveBeenCalledWith("test data");
    }
  });

  it("should restart session on exit", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    await manager.ensureReady();
    // Set sessionId by creating a session
    mockInvoke.mockResolvedValue("test-session-id");
    await manager.createSession(80, 24);
    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue("new-session-id");

    const mockListen = vi.fn().mockResolvedValue(vi.fn());
    mockGetListen.mockResolvedValue(mockListen);
    await manager.setupListeners();

    const exitCallback = mockListen.mock.calls.find(
      (call) => call[0] === "pty-exit"
    )?.[1];

    if (exitCallback) {
      exitCallback({
        payload: {
          session_id: "test-session-id",
          exit_code: 0,
        },
      });

      // Advance timers to trigger restart
      await vi.advanceTimersByTimeAsync(PTY_RESTART_DELAY_MS);

      expect(mockTerminal.write).toHaveBeenCalledWith(
        expect.stringContaining("[Process exited]")
      );
      expect(mockInvoke).toHaveBeenCalledWith("create_pty_session", {
        cols: 80,
        rows: 24,
      });
    }
  });

  it("should close session", async () => {
    const manager = new PtyManager({
      terminal: mockTerminal,
      onSessionCreated: mockOnSessionCreated,
    });

    await manager.ensureReady();
    // Set sessionId by creating a session
    mockInvoke.mockResolvedValue("test-session-id");
    await manager.createSession(80, 24);
    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(undefined);

    // Setup listeners first
    const mockUnlistenOutput = vi.fn();
    const mockUnlistenExit = vi.fn();
    const mockListen = vi
      .fn()
      .mockResolvedValueOnce(mockUnlistenOutput)
      .mockResolvedValueOnce(mockUnlistenExit);
    mockGetListen.mockResolvedValue(mockListen);
    await manager.setupListeners();

    await manager.close();

    expect(mockInvoke).toHaveBeenCalledWith("close_pty_session", {
      sessionId: "test-session-id",
    });
    expect(mockUnlistenOutput).toHaveBeenCalled();
    expect(mockUnlistenExit).toHaveBeenCalled();
    expect(manager.getSessionId()).toBeNull();
  });
});
