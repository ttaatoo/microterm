import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePtySession } from "./usePtySession";
import type { Terminal } from "@xterm/xterm";

// Mock PtySession class
const mockPtySessionInstance = {
  create: vi.fn(),
  reuse: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  close: vi.fn(),
  setupListeners: vi.fn(),
  dispose: vi.fn(),
  getSessionId: vi.fn(),
};

// Track constructor calls
const mockPtySessionConstructor = vi.fn();

vi.mock("./session", () => ({
  PtySession: class MockPtySession {
    create = mockPtySessionInstance.create;
    reuse = mockPtySessionInstance.reuse;
    write = mockPtySessionInstance.write;
    resize = mockPtySessionInstance.resize;
    close = mockPtySessionInstance.close;
    setupListeners = mockPtySessionInstance.setupListeners;
    dispose = mockPtySessionInstance.dispose;
    getSessionId = mockPtySessionInstance.getSessionId;

    constructor(public options: any) {
      mockPtySessionConstructor(options);
    }
  },
}));


describe("usePtySession", () => {
  let mockTerminal: Partial<Terminal>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPtySessionConstructor.mockClear();
    mockTerminal = {
      write: vi.fn(),
      cols: 80,
      rows: 24,
    };
    mockPtySessionInstance.getSessionId.mockReturnValue("test-session-id");
  });

  describe("Initialization", () => {
    it("should not create PtySession when terminal is null", () => {
      renderHook(() => usePtySession({ terminal: null }));

      expect(mockPtySessionConstructor).not.toHaveBeenCalled();
    });

    it("should create PtySession when terminal is provided", () => {
      renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      expect(mockPtySessionConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          terminal: mockTerminal,
        })
      );
    });

    it("should pass options to PtySession", () => {
      const onSessionCreated = vi.fn();

      renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
          onSessionCreated,
          enableBuffering: false,
          bufferFlushInterval: 100,
        })
      );

      expect(mockPtySessionConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          terminal: mockTerminal,
          enableBuffering: false,
          bufferFlushInterval: 100,
          onSessionCreated: expect.any(Function),
        })
      );
    });

    it("should call onSessionCreated callback with session ID", () => {
      const onSessionCreated = vi.fn();

      renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
          onSessionCreated,
        })
      );

      // Get the onSessionCreated callback passed to PtySession
      const ptyOptions = mockPtySessionConstructor.mock.calls[0][0];
      ptyOptions.onSessionCreated?.("new-session-id");

      expect(onSessionCreated).toHaveBeenCalledWith("new-session-id");
    });

    it("should update sessionIdRef when onSessionCreated is called", () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      // Get the onSessionCreated callback passed to PtySession
      const ptyOptions = mockPtySessionConstructor.mock.calls[0][0];
      ptyOptions.onSessionCreated?.("new-session-id");

      expect(result.current.sessionIdRef.current).toBe("new-session-id");
    });
  });

  describe("Cleanup", () => {
    it("should dispose PtySession on unmount", () => {
      const { unmount } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      unmount();

      expect(mockPtySessionInstance.dispose).toHaveBeenCalled();
    });

    it("should recreate PtySession when terminal changes", () => {
      const { rerender } = renderHook(
        ({ terminal }) => usePtySession({ terminal }),
        {
          initialProps: { terminal: mockTerminal as Terminal },
        }
      );

      const newTerminal = { ...mockTerminal };
      rerender({ terminal: newTerminal as Terminal });

      // Should dispose old instance and create new one
      expect(mockPtySessionInstance.dispose).toHaveBeenCalled();
      expect(mockPtySessionConstructor).toHaveBeenCalledTimes(2);
    });
  });

  describe("createSession", () => {
    it("should call PtySession.create with correct parameters", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      await act(async () => {
        await result.current.createSession(80, 24);
      });

      expect(mockPtySessionInstance.create).toHaveBeenCalledWith(80, 24);
    });

    it("should update sessionIdRef after creation", async () => {
      mockPtySessionInstance.getSessionId.mockReturnValue("created-session-id");

      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      await act(async () => {
        await result.current.createSession(80, 24);
      });

      expect(result.current.sessionIdRef.current).toBe("created-session-id");
    });

    it("should handle creation when ptySessionRef is null", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: null,
        })
      );

      // Should not throw
      await act(async () => {
        await result.current.createSession(80, 24);
      });

      expect(mockPtySessionInstance.create).not.toHaveBeenCalled();
    });
  });

  describe("reuseSession", () => {
    it("should call PtySession.reuse with correct parameters", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      await act(async () => {
        await result.current.reuseSession("existing-id", 80, 24);
      });

      expect(mockPtySessionInstance.reuse).toHaveBeenCalledWith("existing-id", 80, 24);
    });

    it("should update sessionIdRef after reuse", async () => {
      mockPtySessionInstance.getSessionId.mockReturnValue("reused-session-id");

      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      await act(async () => {
        await result.current.reuseSession("existing-id", 80, 24);
      });

      expect(result.current.sessionIdRef.current).toBe("reused-session-id");
    });
  });

  describe("writeToSession", () => {
    it("should call PtySession.write with data", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      await act(async () => {
        await result.current.writeToSession("test data");
      });

      expect(mockPtySessionInstance.write).toHaveBeenCalledWith("test data");
    });

    it("should handle write when ptySessionRef is null", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: null,
        })
      );

      await act(async () => {
        await result.current.writeToSession("test data");
      });

      expect(mockPtySessionInstance.write).not.toHaveBeenCalled();
    });
  });

  describe("resizeSession", () => {
    it("should call PtySession.resize with dimensions", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      await act(async () => {
        await result.current.resizeSession(100, 30);
      });

      expect(mockPtySessionInstance.resize).toHaveBeenCalledWith(100, 30);
    });

    it("should handle resize when ptySessionRef is null", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: null,
        })
      );

      await act(async () => {
        await result.current.resizeSession(100, 30);
      });

      expect(mockPtySessionInstance.resize).not.toHaveBeenCalled();
    });
  });

  describe("closeSession", () => {
    it("should call PtySession.close", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      await act(async () => {
        await result.current.closeSession();
      });

      expect(mockPtySessionInstance.close).toHaveBeenCalled();
    });

    it("should clear sessionIdRef after close", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      // Set session ID first
      result.current.sessionIdRef.current = "some-id";

      await act(async () => {
        await result.current.closeSession();
      });

      expect(result.current.sessionIdRef.current).toBeNull();
    });

    it("should handle close when ptySessionRef is null", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: null,
        })
      );

      await act(async () => {
        await result.current.closeSession();
      });

      expect(mockPtySessionInstance.close).not.toHaveBeenCalled();
    });
  });

  describe("setupListeners", () => {
    it("should call PtySession.setupListeners", async () => {
      const mockUnlisten = vi.fn();
      mockPtySessionInstance.setupListeners.mockResolvedValue(mockUnlisten);

      const { result } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      let unlisten: (() => void) | undefined;
      await act(async () => {
        unlisten = await result.current.setupListeners();
      });

      expect(mockPtySessionInstance.setupListeners).toHaveBeenCalled();
      expect(unlisten).toBe(mockUnlisten);
    });

    it("should return noop function when ptySessionRef is null", async () => {
      const { result } = renderHook(() =>
        usePtySession({
          terminal: null,
        })
      );

      let unlisten: (() => void) | undefined;
      await act(async () => {
        unlisten = await result.current.setupListeners();
      });

      expect(mockPtySessionInstance.setupListeners).not.toHaveBeenCalled();
      expect(unlisten).toBeInstanceOf(Function);
    });
  });

  describe("Stability", () => {
    it("should maintain stable callback references", () => {
      const { result, rerender } = renderHook(() =>
        usePtySession({
          terminal: mockTerminal as Terminal,
        })
      );

      const firstCallbacks = { ...result.current };
      rerender();
      const secondCallbacks = { ...result.current };

      expect(firstCallbacks.createSession).toBe(secondCallbacks.createSession);
      expect(firstCallbacks.reuseSession).toBe(secondCallbacks.reuseSession);
      expect(firstCallbacks.writeToSession).toBe(secondCallbacks.writeToSession);
      expect(firstCallbacks.resizeSession).toBe(secondCallbacks.resizeSession);
      expect(firstCallbacks.closeSession).toBe(secondCallbacks.closeSession);
      expect(firstCallbacks.setupListeners).toBe(secondCallbacks.setupListeners);
    });
  });
});
