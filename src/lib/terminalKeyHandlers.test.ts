import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createWordMovementHandler } from "./terminalKeyHandlers";
import type { Terminal } from "@xterm/xterm";

// Mock Tauri invoke
const mockInvoke = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

describe("terminalKeyHandlers", () => {
  let mockTerminal: Terminal;
  let mockBuffer: any;
  let mockLine: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLine = {
      translateToString: vi.fn((_trim: boolean) => "hello world test"),
    };

    mockBuffer = {
      active: {
        cursorX: 5,
        cursorY: 0,
        getLine: vi.fn((y: number) => (y === 0 ? mockLine : null)),
      },
    };

    mockTerminal = {
      buffer: mockBuffer,
    } as unknown as Terminal;

    mockInvoke.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createWordMovementHandler", () => {
    it("should return a handler function", () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );
      expect(typeof handler).toBe("function");
    });

    it("should return true when sessionId is null", () => {
      const handler = createWordMovementHandler(mockTerminal, () => null, mockInvoke);
      const event = new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true });
      expect(handler(event)).toBe(true);
    });

    it("should allow Ctrl+Tab to pass through", () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );
      const event = new KeyboardEvent("keydown", { key: "Tab", ctrlKey: true });
      expect(handler(event)).toBe(true);
    });

    it("should allow Cmd+[ and Cmd+] to pass through", () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );
      const event1 = new KeyboardEvent("keydown", { key: "[", metaKey: true });
      const event2 = new KeyboardEvent("keydown", { key: "]", metaKey: true });
      expect(handler(event1)).toBe(true);
      expect(handler(event2)).toBe(true);
    });

    it("should allow Cmd+1-9 to pass through", () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );
      const event = new KeyboardEvent("keydown", { key: "5", metaKey: true });
      expect(handler(event)).toBe(true);
    });

    it("should allow Cmd+W to pass through", () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );
      const event = new KeyboardEvent("keydown", { key: "w", metaKey: true });
      expect(handler(event)).toBe(true);
    });

    it("should allow Cmd+D to pass through", () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );
      const event = new KeyboardEvent("keydown", { key: "d", metaKey: true });
      expect(handler(event)).toBe(true);
    });

    it("should handle Option+Left for word movement backward", async () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );

      // Set cursor in the middle of a word
      mockBuffer.active.cursorX = 7; // Position in "world"

      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      const event = {
        key: "ArrowLeft",
        altKey: true,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        type: "keydown",
        preventDefault,
        stopPropagation,
      } as unknown as KeyboardEvent;

      const result = handler(event);
      expect(result).toBe(false);
      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();

      // Wait for async operation
      await vi.runAllTimersAsync();

      expect(mockInvoke).toHaveBeenCalledWith("write_to_pty", {
        sessionId: "test-session-id",
        data: expect.any(String),
      });
    });

    it("should handle Option+Right for word movement forward", async () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );

      // Set cursor at the beginning
      mockBuffer.active.cursorX = 0;

      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      const event = {
        key: "ArrowRight",
        altKey: true,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        type: "keydown",
        preventDefault,
        stopPropagation,
      } as unknown as KeyboardEvent;

      const result = handler(event);
      expect(result).toBe(false);

      await vi.runAllTimersAsync();

      expect(mockInvoke).toHaveBeenCalledWith("write_to_pty", {
        sessionId: "test-session-id",
        data: expect.any(String),
      });
    });

    it("should not handle Option+Left on non-keydown events", () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );

      const event = new KeyboardEvent("keyup", {
        key: "ArrowLeft",
        altKey: true,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
      });

      const result = handler(event);
      expect(result).toBe(false);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should not handle Option+Left when other modifiers are pressed", () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );

      const event = new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        altKey: true,
        shiftKey: true, // Shift key pressed
        metaKey: false,
        ctrlKey: false,
      });

      const result = handler(event);
      expect(result).toBe(true); // Should allow default behavior
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should return true for other keys", () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );

      const event = new KeyboardEvent("keydown", { key: "a" });
      expect(handler(event)).toBe(true);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should handle movement when cursor is in whitespace", async () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );

      // Set cursor in whitespace (between "hello" and "world")
      mockLine.translateToString = vi.fn(() => "hello world test");
      mockBuffer.active.cursorX = 5; // Position in the space

      const event = new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        altKey: true,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
      });

      handler(event);
      await vi.runAllTimersAsync();

      expect(mockInvoke).toHaveBeenCalled();
    });

    it("should not move when cursor is at the beginning", async () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );

      mockBuffer.active.cursorX = 0;

      const event = new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        altKey: true,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
      });

      handler(event);
      await vi.runAllTimersAsync();

      // Should not invoke if no movement needed
      // The handler will still be called but moveCount will be 0
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should not move when cursor is at the end", async () => {
      const handler = createWordMovementHandler(
        mockTerminal,
        () => "test-session-id",
        mockInvoke
      );

      mockLine.translateToString = vi.fn(() => "hello world");
      mockBuffer.active.cursorX = 11; // At the end

      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        altKey: true,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
      });

      handler(event);
      await vi.runAllTimersAsync();

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
