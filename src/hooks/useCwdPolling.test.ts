import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCwdPolling } from "./useCwdPolling";
import { CWD_POLL_INTERVAL_MS } from "@/lib/constants";

// Mock Tauri API
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", async () => {
  return {
    invoke: (...args: unknown[]) => mockInvoke(...args),
  };
});

describe("useCwdPolling", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it("should not poll when sessionId is null", async () => {
    const onTitleChange = vi.fn();
    renderHook(() =>
      useCwdPolling({
        sessionId: null,
        isVisible: true,
        onTitleChange,
      })
    );

    await new Promise((resolve) => setTimeout(resolve, CWD_POLL_INTERVAL_MS * 2 + 100));
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(onTitleChange).not.toHaveBeenCalled();
  });

  it("should not poll when isVisible is false", async () => {
    const onTitleChange = vi.fn();
    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: false,
        onTitleChange,
      })
    );

    await new Promise((resolve) => setTimeout(resolve, CWD_POLL_INTERVAL_MS * 2 + 100));
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(onTitleChange).not.toHaveBeenCalled();
  });

  it("should not poll when onTitleChange is undefined", async () => {
    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange: undefined,
      })
    );

    await new Promise((resolve) => setTimeout(resolve, CWD_POLL_INTERVAL_MS * 2 + 100));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should poll immediately on mount", async () => {
    const onTitleChange = vi.fn();
    mockInvoke.mockResolvedValue("/home/user");

    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    // Wait for async import and invoke
    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledWith("get_pty_cwd", {
          sessionId: "test-session",
        });
      },
      { timeout: 2000 }
    );
  });

  it("should poll on interval", async () => {
    const onTitleChange = vi.fn();
    mockInvoke.mockResolvedValue("/home/user");

    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );

    await new Promise((resolve) => setTimeout(resolve, CWD_POLL_INTERVAL_MS + 100));
    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledTimes(2);
      },
      { timeout: 2000 }
    );

    await new Promise((resolve) => setTimeout(resolve, CWD_POLL_INTERVAL_MS + 100));
    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledTimes(3);
      },
      { timeout: 2000 }
    );
  });

  it("should call onTitleChange when CWD changes", async () => {
    const onTitleChange = vi.fn();
    mockInvoke
      .mockResolvedValueOnce("/home/user")
      .mockResolvedValueOnce("/home/user/projects");

    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    await waitFor(
      () => {
        expect(onTitleChange).toHaveBeenCalledWith("user");
      },
      { timeout: 2000 }
    );

    await new Promise((resolve) => setTimeout(resolve, CWD_POLL_INTERVAL_MS + 100));
    await waitFor(
      () => {
        expect(onTitleChange).toHaveBeenCalledWith("projects");
      },
      { timeout: 2000 }
    );
  });

  it("should not call onTitleChange when CWD is the same", async () => {
    const onTitleChange = vi.fn();
    mockInvoke.mockResolvedValue("/home/user");

    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    await waitFor(
      () => {
        expect(onTitleChange).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );

    await new Promise((resolve) => setTimeout(resolve, CWD_POLL_INTERVAL_MS + 100));
    await waitFor(
      () => {
        // Should still be 1, not 2
        expect(onTitleChange).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );
  });

  it("should extract directory name from path", async () => {
    const onTitleChange = vi.fn();
    mockInvoke.mockResolvedValue("/home/user/projects/microterm");

    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    await waitFor(
      () => {
        expect(onTitleChange).toHaveBeenCalledWith("microterm");
      },
      { timeout: 2000 }
    );
  });

  it("should handle root path", async () => {
    const onTitleChange = vi.fn();
    mockInvoke.mockResolvedValue("/");

    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    await waitFor(
      () => {
        expect(onTitleChange).toHaveBeenCalledWith("/");
      },
      { timeout: 2000 }
    );
  });

  it("should handle path with trailing slash", async () => {
    const onTitleChange = vi.fn();
    mockInvoke.mockResolvedValue("/home/user/");

    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    await waitFor(
      () => {
        expect(onTitleChange).toHaveBeenCalledWith("user");
      },
      { timeout: 2000 }
    );
  });

  it("should ignore errors silently", async () => {
    const onTitleChange = vi.fn();
    mockInvoke.mockRejectedValue(new Error("Session closed"));

    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    expect(onTitleChange).not.toHaveBeenCalled();
  });

  it("should stop polling on unmount", async () => {
    const onTitleChange = vi.fn();
    mockInvoke.mockResolvedValue("/home/user");

    const { unmount } = renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );

    unmount();

    await new Promise((resolve) => setTimeout(resolve, CWD_POLL_INTERVAL_MS * 2 + 100));
    // Should still be 1, not more
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("should update callback when onTitleChange changes", async () => {
    const onTitleChange1 = vi.fn();
    const onTitleChange2 = vi.fn();
    mockInvoke.mockResolvedValue("/home/user");

    const { rerender } = renderHook(
      ({ onTitleChange }) =>
        useCwdPolling({
          sessionId: "test-session",
          isVisible: true,
          onTitleChange,
        }),
      {
        initialProps: { onTitleChange: onTitleChange1 },
      }
    );

    await waitFor(
      () => {
        expect(onTitleChange1).toHaveBeenCalledWith("user");
      },
      { timeout: 2000 }
    );

    rerender({ onTitleChange: onTitleChange2 });

    await new Promise((resolve) => setTimeout(resolve, CWD_POLL_INTERVAL_MS + 100));
    await waitFor(
      () => {
        expect(onTitleChange2).toHaveBeenCalledWith("user");
      },
      { timeout: 2000 }
    );
  });

  it("should handle null CWD response", async () => {
    const onTitleChange = vi.fn();
    mockInvoke.mockResolvedValue(null);

    renderHook(() =>
      useCwdPolling({
        sessionId: "test-session",
        isVisible: true,
        onTitleChange,
      })
    );

    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    expect(onTitleChange).not.toHaveBeenCalled();
  });
});
