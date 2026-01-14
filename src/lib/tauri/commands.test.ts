import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCommand, executeCommandStream, completeCommand } from "./commands";

// Mock preload module
const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock("./preload", () => ({
  getInvoke: vi.fn(() => Promise.resolve(mockInvoke)),
  getListen: vi.fn(() => Promise.resolve(mockListen)),
}));

describe("commands.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeCommand", () => {
    it("should execute command without arguments", async () => {
      const mockResult = {
        stdout: "hello\n",
        stderr: "",
        exit_code: 0,
      };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await executeCommand("echo");

      expect(mockInvoke).toHaveBeenCalledWith("execute_command", {
        cmd: "echo",
        args: [],
      });
      expect(result).toEqual(mockResult);
    });

    it("should execute command with arguments", async () => {
      const mockResult = {
        stdout: "hello world\n",
        stderr: "",
        exit_code: 0,
      };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await executeCommand("echo", ["hello", "world"]);

      expect(mockInvoke).toHaveBeenCalledWith("execute_command", {
        cmd: "echo",
        args: ["hello", "world"],
      });
      expect(result).toEqual(mockResult);
    });

    it("should handle command errors", async () => {
      const mockResult = {
        stdout: "",
        stderr: "command not found\n",
        exit_code: 127,
      };
      mockInvoke.mockResolvedValue(mockResult);

      const result = await executeCommand("nonexistent");

      expect(result.exit_code).toBe(127);
      expect(result.stderr).toContain("command not found");
    });

    it("should propagate invoke errors", async () => {
      mockInvoke.mockRejectedValue(new Error("IPC error"));

      await expect(executeCommand("echo")).rejects.toThrow("IPC error");
    });
  });

  describe("executeCommandStream", () => {
    it("should stream stdout chunks", async () => {
      const onStdout = vi.fn();
      const onStderr = vi.fn();
      const onComplete = vi.fn();

      const unlistenStdout = vi.fn();
      const unlistenStderr = vi.fn();
      const unlistenComplete = vi.fn();

      // Mock event listeners
      mockListen.mockImplementation((eventName: string, callback: (event: any) => void) => {
        if (eventName === "command-stdout") {
          // Simulate stdout events
          setTimeout(() => {
            callback({ payload: { chunk: "line 1\n", is_stderr: false } });
            callback({ payload: { chunk: "line 2\n", is_stderr: false } });
          }, 10);
          return Promise.resolve(unlistenStdout);
        } else if (eventName === "command-stderr") {
          return Promise.resolve(unlistenStderr);
        } else if (eventName === "command-complete") {
          // Simulate completion event
          setTimeout(() => {
            callback({ payload: 0 });
          }, 20);
          return Promise.resolve(unlistenComplete);
        }
        return Promise.resolve(vi.fn());
      });

      mockInvoke.mockResolvedValue(undefined);

      await executeCommandStream("ls", [], onStdout, onStderr, onComplete);

      // Wait for async events
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(onStdout).toHaveBeenCalledWith("line 1\n");
      expect(onStdout).toHaveBeenCalledWith("line 2\n");
      expect(onComplete).toHaveBeenCalledWith(0);
    });

    it("should stream stderr chunks", async () => {
      const onStdout = vi.fn();
      const onStderr = vi.fn();
      const onComplete = vi.fn();

      const unlistenStdout = vi.fn();
      const unlistenStderr = vi.fn();
      const unlistenComplete = vi.fn();

      mockListen.mockImplementation((eventName: string, callback: (event: any) => void) => {
        if (eventName === "command-stdout") {
          return Promise.resolve(unlistenStdout);
        } else if (eventName === "command-stderr") {
          // Simulate stderr events
          setTimeout(() => {
            callback({ payload: { chunk: "error message\n", is_stderr: true } });
          }, 10);
          return Promise.resolve(unlistenStderr);
        } else if (eventName === "command-complete") {
          setTimeout(() => {
            callback({ payload: 1 });
          }, 20);
          return Promise.resolve(unlistenComplete);
        }
        return Promise.resolve(vi.fn());
      });

      mockInvoke.mockResolvedValue(undefined);

      await executeCommandStream("failing-cmd", [], onStdout, onStderr, onComplete);

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(onStderr).toHaveBeenCalledWith("error message\n");
      expect(onComplete).toHaveBeenCalledWith(1);
    });

    it("should cleanup listeners on completion", async () => {
      const onStdout = vi.fn();
      const onStderr = vi.fn();
      const onComplete = vi.fn();

      const unlistenStdout = vi.fn();
      const unlistenStderr = vi.fn();
      const unlistenComplete = vi.fn();

      mockListen.mockImplementation((eventName: string, callback: (event: any) => void) => {
        if (eventName === "command-stdout") {
          return Promise.resolve(unlistenStdout);
        } else if (eventName === "command-stderr") {
          return Promise.resolve(unlistenStderr);
        } else if (eventName === "command-complete") {
          setTimeout(() => {
            callback({ payload: 0 });
          }, 10);
          return Promise.resolve(unlistenComplete);
        }
        return Promise.resolve(vi.fn());
      });

      mockInvoke.mockResolvedValue(undefined);

      await executeCommandStream("echo", ["test"], onStdout, onStderr, onComplete);

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Verify all listeners were cleaned up
      expect(unlistenStdout).toHaveBeenCalled();
      expect(unlistenStderr).toHaveBeenCalled();
      expect(unlistenComplete).toHaveBeenCalled();
    });

    it("should invoke stream command with correct parameters", async () => {
      const onStdout = vi.fn();
      const onStderr = vi.fn();
      const onComplete = vi.fn();

      mockListen.mockResolvedValue(vi.fn());
      mockInvoke.mockResolvedValue(undefined);

      await executeCommandStream("git", ["status"], onStdout, onStderr, onComplete);

      expect(mockInvoke).toHaveBeenCalledWith("execute_command_stream", {
        cmd: "git",
        args: ["status"],
      });
    });
  });

  describe("completeCommand", () => {
    it("should return completions for valid prefix", async () => {
      const mockCompletions = ["git", "grep", "gunzip"];
      mockInvoke.mockResolvedValue(mockCompletions);

      const result = await completeCommand("g");

      expect(mockInvoke).toHaveBeenCalledWith("complete_command", {
        prefix: "g",
      });
      expect(result).toEqual(mockCompletions);
    });

    it("should return empty array for no matches", async () => {
      mockInvoke.mockResolvedValue([]);

      const result = await completeCommand("zzz");

      expect(result).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error("Completion error"));

      const result = await completeCommand("g");

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("Command completion error:", expect.any(Error));

      consoleSpy.mockRestore();
    });

    it("should handle empty prefix", async () => {
      const mockCompletions = ["ls", "cd", "pwd"];
      mockInvoke.mockResolvedValue(mockCompletions);

      const result = await completeCommand("");

      expect(result).toEqual(mockCompletions);
    });
  });
});
