import { describe, it, expect } from "vitest";
import {
  isPinStatePayload,
  isPtyOutput,
  isPtyExit,
  
  type PtyOutput,
  type PtyExit,
} from "./guards";

describe("guards.ts", () => {
  describe("isPinStatePayload", () => {
    it("should return true for valid payload with pinned: true", () => {
      expect(isPinStatePayload({ pinned: true })).toBe(true);
    });

    it("should return true for valid payload with pinned: false", () => {
      expect(isPinStatePayload({ pinned: false })).toBe(true);
    });

    it("should return false for null", () => {
      expect(isPinStatePayload(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isPinStatePayload(undefined)).toBe(false);
    });

    it("should return false for non-object types", () => {
      expect(isPinStatePayload("string")).toBe(false);
      expect(isPinStatePayload(123)).toBe(false);
      expect(isPinStatePayload(true)).toBe(false);
    });

    it("should return false for object without pinned property", () => {
      expect(isPinStatePayload({})).toBe(false);
      expect(isPinStatePayload({ other: "value" })).toBe(false);
    });

    it("should return false for object with non-boolean pinned", () => {
      expect(isPinStatePayload({ pinned: "true" })).toBe(false);
      expect(isPinStatePayload({ pinned: 1 })).toBe(false);
      expect(isPinStatePayload({ pinned: null })).toBe(false);
      expect(isPinStatePayload({ pinned: undefined })).toBe(false);
    });

    it("should return true for object with extra properties", () => {
      expect(isPinStatePayload({ pinned: true, extra: "data" })).toBe(true);
    });
  });

  describe("isPtyOutput", () => {
    it("should return true for valid PTY output", () => {
      const payload: PtyOutput = {
        session_id: "abc123",
        data: "Hello, world!",
      };
      expect(isPtyOutput(payload)).toBe(true);
    });

    it("should return true for PTY output with empty strings", () => {
      const payload = {
        session_id: "",
        data: "",
      };
      expect(isPtyOutput(payload)).toBe(true);
    });

    it("should return true for PTY output with extra properties", () => {
      const payload = {
        session_id: "abc123",
        data: "output",
        extra: "ignored",
      };
      expect(isPtyOutput(payload)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isPtyOutput(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isPtyOutput(undefined)).toBe(false);
    });

    it("should return false for non-object types", () => {
      expect(isPtyOutput("string")).toBe(false);
      expect(isPtyOutput(123)).toBe(false);
      expect(isPtyOutput(true)).toBe(false);
      expect(isPtyOutput([])).toBe(false);
    });

    it("should return false for object without session_id", () => {
      expect(isPtyOutput({ data: "output" })).toBe(false);
    });

    it("should return false for object without data", () => {
      expect(isPtyOutput({ session_id: "abc123" })).toBe(false);
    });

    it("should return false for object with non-string session_id", () => {
      expect(isPtyOutput({ session_id: 123, data: "output" })).toBe(false);
      expect(isPtyOutput({ session_id: null, data: "output" })).toBe(false);
      expect(isPtyOutput({ session_id: true, data: "output" })).toBe(false);
    });

    it("should return false for object with non-string data", () => {
      expect(isPtyOutput({ session_id: "abc123", data: 123 })).toBe(false);
      expect(isPtyOutput({ session_id: "abc123", data: null })).toBe(false);
      expect(isPtyOutput({ session_id: "abc123", data: false })).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(isPtyOutput({})).toBe(false);
    });
  });

  describe("isPtyExit", () => {
    it("should return true for valid PTY exit with exit code", () => {
      const payload: PtyExit = {
        session_id: "abc123",
        exit_code: 0,
      };
      expect(isPtyExit(payload)).toBe(true);
    });

    it("should return true for PTY exit with null exit code", () => {
      const payload: PtyExit = {
        session_id: "abc123",
        exit_code: null,
      };
      expect(isPtyExit(payload)).toBe(true);
    });

    it("should return true for PTY exit with non-zero exit code", () => {
      const payload = {
        session_id: "abc123",
        exit_code: 1,
      };
      expect(isPtyExit(payload)).toBe(true);
    });

    it("should return true for PTY exit with negative exit code", () => {
      const payload = {
        session_id: "abc123",
        exit_code: -1,
      };
      expect(isPtyExit(payload)).toBe(true);
    });

    it("should return true for PTY exit with large exit code", () => {
      const payload = {
        session_id: "abc123",
        exit_code: 255,
      };
      expect(isPtyExit(payload)).toBe(true);
    });

    it("should return true for PTY exit with extra properties", () => {
      const payload = {
        session_id: "abc123",
        exit_code: 0,
        extra: "ignored",
      };
      expect(isPtyExit(payload)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isPtyExit(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isPtyExit(undefined)).toBe(false);
    });

    it("should return false for non-object types", () => {
      expect(isPtyExit("string")).toBe(false);
      expect(isPtyExit(123)).toBe(false);
      expect(isPtyExit(true)).toBe(false);
      expect(isPtyExit([])).toBe(false);
    });

    it("should return false for object without session_id", () => {
      expect(isPtyExit({ exit_code: 0 })).toBe(false);
    });

    it("should return false for object without exit_code", () => {
      expect(isPtyExit({ session_id: "abc123" })).toBe(false);
    });

    it("should return false for object with non-string session_id", () => {
      expect(isPtyExit({ session_id: 123, exit_code: 0 })).toBe(false);
      expect(isPtyExit({ session_id: null, exit_code: 0 })).toBe(false);
      expect(isPtyExit({ session_id: true, exit_code: 0 })).toBe(false);
    });

    it("should return false for object with invalid exit_code type", () => {
      expect(isPtyExit({ session_id: "abc123", exit_code: "0" })).toBe(false);
      expect(isPtyExit({ session_id: "abc123", exit_code: true })).toBe(false);
      expect(
        isPtyExit({ session_id: "abc123", exit_code: undefined })
      ).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(isPtyExit({})).toBe(false);
    });
  });
});
