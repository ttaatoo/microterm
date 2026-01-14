import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPtySession, writeToPty, resizePty, closePtySession } from "./pty";

// Mock preload module
vi.mock("./preload", () => ({
  getInvoke: vi.fn(),
}));

import { getInvoke } from "./preload";

describe("PTY Tauri Commands", () => {
  let mockInvoke: any;

  beforeEach(() => {
    mockInvoke = vi.fn();
    vi.mocked(getInvoke).mockResolvedValue(mockInvoke);
  });

  describe("createPtySession", () => {
    it("should create PTY session with correct parameters", async () => {
      mockInvoke.mockResolvedValue("session-123");

      const sessionId = await createPtySession(80, 24);

      expect(getInvoke).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith("create_pty_session", {
        cols: 80,
        rows: 24,
      });
      expect(sessionId).toBe("session-123");
    });

    it("should handle large dimensions", async () => {
      mockInvoke.mockResolvedValue("session-123");

      await createPtySession(200, 100);

      expect(mockInvoke).toHaveBeenCalledWith("create_pty_session", {
        cols: 200,
        rows: 100,
      });
    });

    it("should propagate errors", async () => {
      mockInvoke.mockRejectedValue(new Error("Failed to create PTY"));

      await expect(createPtySession(80, 24)).rejects.toThrow("Failed to create PTY");
    });

    it("should handle zero dimensions", async () => {
      mockInvoke.mockResolvedValue("session-123");

      await createPtySession(0, 0);

      expect(mockInvoke).toHaveBeenCalledWith("create_pty_session", {
        cols: 0,
        rows: 0,
      });
    });
  });

  describe("writeToPty", () => {
    it("should write data to PTY session", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await writeToPty("session-123", "echo hello\n");

      expect(getInvoke).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith("write_to_pty", {
        sessionId: "session-123",
        data: "echo hello\n",
      });
    });

    it("should handle empty data", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await writeToPty("session-123", "");

      expect(mockInvoke).toHaveBeenCalledWith("write_to_pty", {
        sessionId: "session-123",
        data: "",
      });
    });

    it("should handle special characters", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await writeToPty("session-123", "\x03"); // Ctrl+C

      expect(mockInvoke).toHaveBeenCalledWith("write_to_pty", {
        sessionId: "session-123",
        data: "\x03",
      });
    });

    it("should handle unicode characters", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await writeToPty("session-123", "Hello 🌍");

      expect(mockInvoke).toHaveBeenCalledWith("write_to_pty", {
        sessionId: "session-123",
        data: "Hello 🌍",
      });
    });

    it("should handle large data", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const largeData = "x".repeat(10000);
      await writeToPty("session-123", largeData);

      expect(mockInvoke).toHaveBeenCalledWith("write_to_pty", {
        sessionId: "session-123",
        data: largeData,
      });
    });

    it("should propagate errors", async () => {
      mockInvoke.mockRejectedValue(new Error("Write failed"));

      await expect(writeToPty("session-123", "test")).rejects.toThrow("Write failed");
    });
  });

  describe("resizePty", () => {
    it("should resize PTY session", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await resizePty("session-123", 100, 30);

      expect(getInvoke).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith("resize_pty", {
        sessionId: "session-123",
        cols: 100,
        rows: 30,
      });
    });

    it("should handle small dimensions", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await resizePty("session-123", 40, 10);

      expect(mockInvoke).toHaveBeenCalledWith("resize_pty", {
        sessionId: "session-123",
        cols: 40,
        rows: 10,
      });
    });

    it("should handle large dimensions", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await resizePty("session-123", 500, 300);

      expect(mockInvoke).toHaveBeenCalledWith("resize_pty", {
        sessionId: "session-123",
        cols: 500,
        rows: 300,
      });
    });

    it("should propagate errors", async () => {
      mockInvoke.mockRejectedValue(new Error("Resize failed"));

      await expect(resizePty("session-123", 80, 24)).rejects.toThrow("Resize failed");
    });
  });

  describe("closePtySession", () => {
    it("should close PTY session", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await closePtySession("session-123");

      expect(getInvoke).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith("close_pty_session", {
        sessionId: "session-123",
      });
    });

    it("should handle closing non-existent session", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await closePtySession("non-existent");

      expect(mockInvoke).toHaveBeenCalledWith("close_pty_session", {
        sessionId: "non-existent",
      });
    });

    it("should propagate errors", async () => {
      mockInvoke.mockRejectedValue(new Error("Close failed"));

      await expect(closePtySession("session-123")).rejects.toThrow("Close failed");
    });

    it("should handle empty session ID", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await closePtySession("");

      expect(mockInvoke).toHaveBeenCalledWith("close_pty_session", {
        sessionId: "",
      });
    });
  });

  describe("Integration", () => {
    it("should create, write, resize, and close session", async () => {
      mockInvoke
        .mockResolvedValueOnce("session-123") // create
        .mockResolvedValueOnce(undefined) // write
        .mockResolvedValueOnce(undefined) // resize
        .mockResolvedValueOnce(undefined); // close

      const sessionId = await createPtySession(80, 24);
      await writeToPty(sessionId, "echo test\n");
      await resizePty(sessionId, 100, 30);
      await closePtySession(sessionId);

      expect(mockInvoke).toHaveBeenCalledTimes(4);
    });

    it("should handle multiple sessions", async () => {
      mockInvoke
        .mockResolvedValueOnce("session-1")
        .mockResolvedValueOnce("session-2")
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const session1 = await createPtySession(80, 24);
      const session2 = await createPtySession(80, 24);

      await writeToPty(session1, "test1");
      await writeToPty(session2, "test2");

      expect(session1).toBe("session-1");
      expect(session2).toBe("session-2");
      expect(mockInvoke).toHaveBeenCalledTimes(4);
    });
  });
});
