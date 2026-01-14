import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "./useToast";
import type { ToastType } from "@/components/Toast";

describe("useToast", () => {
  it("should initialize with empty toasts array", () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toEqual([]);
  });

  it("should add toast with addToast", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast("Test message", "info");
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      message: "Test message",
      type: "info",
    });
    expect(result.current.toasts[0].id).toBeDefined();
  });

  it("should use default type 'info' when type is not provided", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast("Test message");
    });

    expect(result.current.toasts[0].type).toBe("info");
  });

  it("should add multiple toasts", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast("First", "info");
      result.current.addToast("Second", "success");
      result.current.addToast("Third", "error");
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0].message).toBe("First");
    expect(result.current.toasts[1].message).toBe("Second");
    expect(result.current.toasts[2].message).toBe("Third");
  });

  it("should generate unique IDs for each toast", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast("First");
      result.current.addToast("Second");
      result.current.addToast("Third");
    });

    const ids = result.current.toasts.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it("should remove toast with removeToast", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast("First");
      result.current.addToast("Second");
      result.current.addToast("Third");
    });

    const secondId = result.current.toasts[1].id;

    act(() => {
      result.current.removeToast(secondId);
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts.find((t) => t.id === secondId)).toBeUndefined();
    expect(result.current.toasts[0].message).toBe("First");
    expect(result.current.toasts[1].message).toBe("Third");
  });

  it("should handle removing non-existent toast", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast("Test");
    });

    const initialLength = result.current.toasts.length;

    act(() => {
      result.current.removeToast("non-existent-id");
    });

    expect(result.current.toasts).toHaveLength(initialLength);
  });

  it("should handle removing from empty array", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.removeToast("some-id");
    });

    expect(result.current.toasts).toEqual([]);
  });

  it("should support all toast types", () => {
    const { result } = renderHook(() => useToast());
    const types: ToastType[] = ["info", "success", "warning", "error"];

    act(() => {
      types.forEach((type) => {
        result.current.addToast(`Message ${type}`, type);
      });
    });

    expect(result.current.toasts).toHaveLength(4);
    types.forEach((type, index) => {
      expect(result.current.toasts[index].type).toBe(type);
    });
  });

  it("should maintain toast order", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.addToast("First");
      result.current.addToast("Second");
      result.current.addToast("Third");
    });

    const ids = result.current.toasts.map((t) => t.id);

    // Remove middle one
    act(() => {
      result.current.removeToast(ids[1]);
    });

    expect(result.current.toasts[0].message).toBe("First");
    expect(result.current.toasts[1].message).toBe("Third");
  });
});
