import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DataBuffer } from "./dataBuffer";

describe("DataBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Operations", () => {
    it("should buffer data and flush after interval", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ flushInterval: 5, onFlush });

      buffer.push("hello");
      buffer.push(" ");
      buffer.push("world");

      expect(onFlush).not.toHaveBeenCalled();
      expect(buffer.size()).toBe(3);
      expect(buffer.isEmpty()).toBe(false);

      // Advance timers to trigger flush
      vi.advanceTimersByTime(5);

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith("hello world");
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.size()).toBe(0);
    });

    it("should use default flush interval of 5ms", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.push("test");

      vi.advanceTimersByTime(4);
      expect(onFlush).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onFlush).toHaveBeenCalledWith("test");
    });

    it("should handle custom flush intervals", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ flushInterval: 100, onFlush });

      buffer.push("test");

      vi.advanceTimersByTime(99);
      expect(onFlush).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onFlush).toHaveBeenCalledWith("test");
    });
  });

  describe("flush()", () => {
    it("should flush buffer immediately", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ flushInterval: 100, onFlush });

      buffer.push("test1");
      buffer.push("test2");
      expect(onFlush).not.toHaveBeenCalled();

      buffer.flush();

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith("test1test2");
      expect(buffer.isEmpty()).toBe(true);
    });

    it("should cancel pending flush timer", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ flushInterval: 100, onFlush });

      buffer.push("test");
      buffer.flush();

      // Should not flush again after timer
      vi.advanceTimersByTime(100);
      expect(onFlush).toHaveBeenCalledTimes(1);
    });

    it("should not flush if buffer is empty", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.flush();

      expect(onFlush).not.toHaveBeenCalled();
    });

    it("should handle multiple flushes correctly", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.push("chunk1");
      buffer.flush();
      expect(onFlush).toHaveBeenCalledWith("chunk1");

      buffer.push("chunk2");
      buffer.flush();
      expect(onFlush).toHaveBeenCalledWith("chunk2");

      expect(onFlush).toHaveBeenCalledTimes(2);
    });
  });

  describe("clear()", () => {
    it("should clear buffer without flushing", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.push("test1");
      buffer.push("test2");

      buffer.clear();

      expect(onFlush).not.toHaveBeenCalled();
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.size()).toBe(0);
    });

    it("should cancel pending flush timer", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ flushInterval: 100, onFlush });

      buffer.push("test");
      buffer.clear();

      vi.advanceTimersByTime(100);
      expect(onFlush).not.toHaveBeenCalled();
    });
  });

  describe("dispose()", () => {
    it("should flush buffer before disposal", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.push("test1");
      buffer.push("test2");

      buffer.dispose();

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith("test1test2");
      expect(buffer.isEmpty()).toBe(true);
    });

    it("should handle disposal of empty buffer", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.dispose();

      expect(onFlush).not.toHaveBeenCalled();
    });
  });

  describe("Timer Management", () => {
    it("should only schedule one timer at a time", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ flushInterval: 10, onFlush });

      buffer.push("chunk1");
      buffer.push("chunk2");
      buffer.push("chunk3");

      // Only one flush should happen
      vi.advanceTimersByTime(10);
      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith("chunk1chunk2chunk3");
    });

    it("should schedule new timer after manual flush", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ flushInterval: 10, onFlush });

      buffer.push("chunk1");
      buffer.flush();

      buffer.push("chunk2");
      vi.advanceTimersByTime(10);

      expect(onFlush).toHaveBeenCalledTimes(2);
      expect(onFlush).toHaveBeenNthCalledWith(1, "chunk1");
      expect(onFlush).toHaveBeenNthCalledWith(2, "chunk2");
    });
  });

  describe("Memory Leak Prevention", () => {
    it("should clear timer reference after flush", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.push("test");
      vi.advanceTimersByTime(5);

      // Push again and verify new timer is created
      buffer.push("test2");
      vi.advanceTimersByTime(5);

      expect(onFlush).toHaveBeenCalledTimes(2);
    });

    it("should not accumulate timers", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ flushInterval: 10, onFlush });

      // Rapidly push data
      for (let i = 0; i < 100; i++) {
        buffer.push(`chunk${i}`);
      }

      // Only one flush should occur
      vi.advanceTimersByTime(10);
      expect(onFlush).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string push", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.push("");
      vi.advanceTimersByTime(5);

      expect(onFlush).toHaveBeenCalledWith("");
    });

    it("should handle large data chunks", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      const largeChunk = "x".repeat(10000);
      buffer.push(largeChunk);
      vi.advanceTimersByTime(5);

      expect(onFlush).toHaveBeenCalledWith(largeChunk);
    });

    it("should handle special characters", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.push("\x1b[31m");
      buffer.push("colored text");
      buffer.push("\x1b[0m");
      vi.advanceTimersByTime(5);

      expect(onFlush).toHaveBeenCalledWith("\x1b[31mcolored text\x1b[0m");
    });

    it("should handle unicode characters", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      buffer.push("Hello ");
      buffer.push("🌍");
      buffer.push(" 世界");
      vi.advanceTimersByTime(5);

      expect(onFlush).toHaveBeenCalledWith("Hello 🌍 世界");
    });
  });

  describe("Performance", () => {
    it("should efficiently concatenate many small chunks", () => {
      const onFlush = vi.fn();
      const buffer = new DataBuffer({ onFlush });

      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        buffer.push("x");
      }
      buffer.flush();
      const endTime = performance.now();

      expect(onFlush).toHaveBeenCalledWith("x".repeat(1000));
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });
});
