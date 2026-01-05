import { describe, it, expect } from "vitest";
import { isPinStatePayload } from "./guards";

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
});
