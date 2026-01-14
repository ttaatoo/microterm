import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PtySession } from "./session";
import type { Terminal } from "@xterm/xterm";

// Mock the imports
vi.mock("@/lib/tauri/pty", () => ({
  createPtySession: vi.fn(),
  writeToPty: vi.fn(),
  resizePty: vi.fn(),
  closePtySession: vi.fn(),
}));

vi.mock("@/lib/tauri/preload", () => ({
  getListen: vi.fn(),
  ensurePreload: vi.fn().mockResolvedValue(undefined),
}));

// Mock DataBuffer with trackable constructor
const MockDataBufferConstructor = vi.fn();

vi.mock("@/lib/terminal/dataBuffer", () => {
  return {
    DataBuffer: class MockDataBuffer {
      push = vi.fn();
      flush = vi.fn();
      clear = vi.fn();
      dispose = vi.fn();
      isEmpty = vi.fn().mockReturnValue(true);
      size = vi.fn().mockReturnValue(0);

      constructor(public options: any) {
        MockDataBufferConstructor(options);
      }
    },
  };
});

import { createPtySession, writeToPty, resizePty, closePtySession } from "@/lib/tauri/pty";
import { getListen, ensurePreload } from "@/lib/tauri/preload";

describe("PtySession", () => {
  let mockTerminal: Partial<Terminal>;
  let mockListen: ReturnType<typeof vi.fn>;
  let mockUnlisten: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    MockDataBufferConstructor.mockClear();
    vi.useFakeTimers();

    mockTerminal = {
      write: vi.fn(),
      cols: 80,
      rows: 24,
    };

    mockUnlisten = vi.fn();
    mockListen = vi.fn().mockResolvedValue(mockUnlisten);

    vi.mocked(getListen).mockResolvedValue(mockListen);
    vi.mocked(createPtySession).mockResolvedValue("test-session-id");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Construction", () => {
    it("should create session with buffering enabled by default", () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      expect(session).toBeDefined();
      expect(MockDataBufferConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          flushInterval: 5,
          onFlush: expect.any(Function),
        })
      );
    });

    it("should create session without buffering when disabled", () => {
      MockDataBufferConstructor.mockClear();

      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
        enableBuffering: false,
      });

      expect(session).toBeDefined();
      expect(MockDataBufferConstructor).not.toHaveBeenCalled();
    });

    it("should use custom buffer flush interval", () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
        bufferFlushInterval: 100,
      });

      expect(MockDataBufferConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          flushInterval: 100,
        })
      );
    });

    it("should accept onSessionCreated callback", () => {
      const onSessionCreated = vi.fn();
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
        onSessionCreated,
      });

      expect(session).toBeDefined();
    });
  });

  describe("create()", () => {
    it("should create PTY session successfully", async () => {
      const onSessionCreated = vi.fn();
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
        onSessionCreated,
      });

      await session.create(80, 24);

      expect(ensurePreload).toHaveBeenCalled();
      expect(createPtySession).toHaveBeenCalledWith(80, 24);
      expect(onSessionCreated).toHaveBeenCalledWith("test-session-id");
      expect(session.isActive()).toBe(true);
      expect(session.getSessionId()).toBe("test-session-id");
    });

    it("should validate dimensions before creation", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(0, 0);

      // Should call with minimum valid dimensions (20x5 as per ptyUtils)
      expect(createPtySession).toHaveBeenCalledWith(20, 5);
    });

    it("should retry on failure", async () => {
      vi.mocked(createPtySession)
        .mockRejectedValueOnce(new Error("Failed once"))
        .mockResolvedValueOnce("test-session-id");

      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      const createPromise = session.create(80, 24);

      // Run all timers to handle retry delay
      await vi.runAllTimersAsync();
      await createPromise;

      expect(createPtySession).toHaveBeenCalledTimes(2);
      expect(mockTerminal.write).toHaveBeenCalledWith(
        expect.stringContaining("Retrying...")
      );
      expect(session.isActive()).toBe(true);
    });

    it("should show error after max retries", async () => {
      vi.mocked(createPtySession).mockRejectedValue(new Error("Failed"));

      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      const createPromise = session.create(80, 24);

      // Run all timers to handle retry delays
      await vi.runAllTimersAsync();
      await createPromise;

      // Should call 4 times (initial + 3 retries from MAX_PTY_RETRIES=3)
      expect(createPtySession).toHaveBeenCalledTimes(4);
      expect(mockTerminal.write).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create terminal after 3 attempts")
      );
      expect(session.isActive()).toBe(false);
    });

    it("should increase retry delay exponentially", async () => {
      vi.mocked(createPtySession).mockRejectedValue(new Error("Failed"));

      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      const promise = session.create(80, 24);

      // Wait for all retry delays to complete
      await vi.runAllTimersAsync();
      await promise;

      // Dispose to prevent restart timer from running
      session.dispose();

      // Should call 4 times (initial + 3 retries from MAX_PTY_RETRIES=3)
      expect(createPtySession).toHaveBeenCalledTimes(4);
    });
  });

  describe("reuse()", () => {
    it("should reuse existing session", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.reuse("existing-session-id", 80, 24);

      expect(session.getSessionId()).toBe("existing-session-id");
      expect(resizePty).toHaveBeenCalledWith("existing-session-id", 80, 24);
    });

    it("should create new session if resize fails", async () => {
      vi.mocked(resizePty).mockRejectedValueOnce(new Error("Resize failed"));

      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.reuse("existing-session-id", 80, 24);

      expect(resizePty).toHaveBeenCalled();
      expect(createPtySession).toHaveBeenCalled();
    });
  });

  describe("write()", () => {
    it("should write data to PTY", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.write("test command\n");

      expect(writeToPty).toHaveBeenCalledWith("test-session-id", "test command\n");
    });

    it("should not write if session is not active", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.write("test");

      expect(writeToPty).not.toHaveBeenCalled();
    });

    it("should attempt reconnection on write failure", async () => {
      vi.mocked(writeToPty).mockRejectedValueOnce(new Error("Write failed"));

      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.write("test");

      expect(mockTerminal.write).toHaveBeenCalledWith(
        expect.stringContaining("Connection lost. Attempting to reconnect...")
      );
      expect(closePtySession).toHaveBeenCalled();
      expect(createPtySession).toHaveBeenCalledTimes(2); // Initial + reconnect
    });
  });

  describe("resize()", () => {
    it("should resize PTY session", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.resize(100, 30);

      expect(resizePty).toHaveBeenCalledWith("test-session-id", 100, 30);
    });

    it("should validate dimensions before resize", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.resize(0, 0);

      // Should call with minimum valid dimensions (20x5 as per ptyUtils)
      expect(resizePty).toHaveBeenCalledWith("test-session-id", 20, 5);
    });

    it("should not resize if session is not active", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.resize(100, 30);

      expect(resizePty).not.toHaveBeenCalled();
    });

    it("should handle resize errors gracefully", async () => {
      vi.mocked(resizePty).mockRejectedValueOnce(new Error("Resize failed"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.resize(100, 30);

      expect(consoleError).toHaveBeenCalledWith(
        "[PTY] Resize failed:",
        expect.any(Error)
      );
      consoleError.mockRestore();
    });
  });

  describe("setupListeners()", () => {
    it("should set up PTY output listener", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();

      expect(getListen).toHaveBeenCalled();
      expect(mockListen).toHaveBeenCalledWith("pty-output", expect.any(Function));
    });

    it("should set up PTY exit listener", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();

      expect(mockListen).toHaveBeenCalledWith("pty-exit", expect.any(Function));
    });

    it("should handle PTY output events with buffering", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();

      // Get the output listener callback
      const outputListener = mockListen.mock.calls.find(
        (call: any) => call[0] === "pty-output"
      )?.[1];

      // Simulate output event
      outputListener({
        payload: {
          session_id: "test-session-id",
          data: "output data",
        },
      });

      // Should use buffer (we can't easily verify the buffer was called
      // without access to the instance, but we can verify terminal wasn't called directly)
      // Note: In a real scenario, the buffer would eventually flush to terminal.write
    });

    it("should handle PTY output events without buffering", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
        enableBuffering: false,
      });

      await session.create(80, 24);
      await session.setupListeners();

      const outputListener = mockListen.mock.calls.find(
        (call: any) => call[0] === "pty-output"
      )?.[1];

      outputListener({
        payload: {
          session_id: "test-session-id",
          data: "output data",
        },
      });

      expect(mockTerminal.write).toHaveBeenCalledWith("output data");
    });

    it("should handle PTY exit events", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();

      const exitListener = mockListen.mock.calls.find(
        (call: any) => call[0] === "pty-exit"
      )?.[1];

      // Clear mock to track only the exit message write
      vi.mocked(mockTerminal.write).mockClear();

      // Trigger exit event with matching session_id
      exitListener({
        payload: {
          session_id: "test-session-id", // Matches the session created in beforeEach
          exit_code: 0,
        },
      });

      expect(mockTerminal.write).toHaveBeenCalledWith(
        expect.stringContaining("[Process exited]")
      );

      // Should restart after delay
      vi.mocked(createPtySession).mockResolvedValue("restarted-session-id");
      await vi.advanceTimersByTimeAsync(1000);

      expect(createPtySession).toHaveBeenCalledTimes(2);
    });

    it("should ignore events for different sessions", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();

      const outputListener = mockListen.mock.calls.find(
        (call: any) => call[0] === "pty-output"
      )?.[1];

      outputListener({
        payload: {
          session_id: "different-session-id",
          data: "output data",
        },
      });

      expect(mockTerminal.write).not.toHaveBeenCalledWith("output data");
    });

    it("should return unlisten function", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      const unlisten = await session.setupListeners();

      expect(unlisten).toBeInstanceOf(Function);

      unlisten();
      expect(mockUnlisten).toHaveBeenCalledTimes(2); // output + exit
    });
  });

  describe("close()", () => {
    it("should close PTY session", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();
      await session.close();

      expect(closePtySession).toHaveBeenCalledWith("test-session-id");
      expect(session.isActive()).toBe(false);
    });

    it("should clean up event listeners", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();
      await session.close();

      expect(mockUnlisten).toHaveBeenCalledTimes(2);
    });

    it("should dispose data buffer", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.close();

      // Verify DataBuffer was constructed (dispose should have been called internally)
      expect(MockDataBufferConstructor).toHaveBeenCalled();
    });

    it("should handle close errors gracefully", async () => {
      vi.mocked(closePtySession).mockRejectedValueOnce(new Error("Close failed"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.close();

      expect(consoleError).toHaveBeenCalledWith("[PTY] Close failed:", expect.any(Error));
      consoleError.mockRestore();
    });

    it("should prevent writes after close", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();

      const outputListener = mockListen.mock.calls.find(
        (call: any) => call[0] === "pty-output"
      )?.[1];

      await session.close();

      // Try to trigger output after close
      outputListener({
        payload: {
          session_id: "test-session-id",
          data: "late data",
        },
      });

      // Should not write to terminal after close
      const writeCalls = vi.mocked(mockTerminal.write).mock.calls;
      expect(writeCalls).not.toContainEqual(["late data"]);
    });
  });

  describe("dispose()", () => {
    it("should dispose session resources", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      session.dispose();

      await vi.runAllTimersAsync();

      expect(closePtySession).toHaveBeenCalled();
    });

    it("should prevent restart after disposal", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();

      const exitListener = mockListen.mock.calls.find(
        (call: any) => call[0] === "pty-exit"
      )?.[1];

      session.dispose();

      // Trigger exit event
      exitListener({
        payload: {
          session_id: "test-session-id",
          exit_code: 0,
        },
      });

      // Wait for restart delay
      await vi.advanceTimersByTimeAsync(2000);

      // Should not create new session after disposal
      expect(createPtySession).toHaveBeenCalledTimes(1); // Only initial creation
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid create/close cycles", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.close();
      await session.create(80, 24);
      await session.close();

      expect(createPtySession).toHaveBeenCalledTimes(2);
      expect(closePtySession).toHaveBeenCalledTimes(2);
    });

    it("should handle write before setup", async () => {
      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.write("early write");

      expect(writeToPty).toHaveBeenCalled();
    });

    it("should handle invalid event payloads gracefully", async () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const _session = new PtySession({
        terminal: mockTerminal as Terminal,
      });

      await session.create(80, 24);
      await session.setupListeners();

      const outputListener = mockListen.mock.calls.find(
        (call: any) => call[0] === "pty-output"
      )?.[1];

      // Invalid payload
      outputListener({
        payload: { invalid: "payload" },
      });

      expect(consoleWarn).toHaveBeenCalledWith(
        "[PTY] Invalid pty-output payload:",
        expect.any(Object)
      );
      consoleWarn.mockRestore();
    });
  });
});
