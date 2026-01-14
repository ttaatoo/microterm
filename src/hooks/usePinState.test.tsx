import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePinState } from "./usePinState";

// Mock dependencies
vi.mock("@/lib/settings", () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@/lib/guards", () => ({
  isPinStatePayload: vi.fn(),
}));

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockUnlisten = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: any[]) => mockListen(...args),
}));

import { loadSettings, saveSettings } from "@/lib/settings";
import { isPinStatePayload } from "@/lib/guards";

describe("usePinState", () => {
  const mockSettings = {
    opacity: 0.96,
    fontSize: 14,
    pinned: false,
    onboardingComplete: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSettings).mockReturnValue(mockSettings);
    mockInvoke.mockResolvedValue(undefined);
    mockListen.mockResolvedValue(mockUnlisten);
    vi.mocked(isPinStatePayload).mockReturnValue(true);
  });

  describe("Initialization", () => {
    it("should load pin state from settings on mount", async () => {
      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        pinned: true,
      });

      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(result.current.pinned).toBe(true);
      });
    });

    it("should default to false when pinned is not in settings", async () => {
      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        pinned: undefined,
      });

      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(result.current.pinned).toBe(false);
      });
    });

    it("should sync initial state to Rust backend on mount", async () => {
      renderHook(() => usePinState());

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("set_pinned", { pinned: false });
      });
    });

    it("should set up pin state listener on mount", async () => {
      renderHook(() => usePinState());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalledWith("pin-state-updated", expect.any(Function));
      });
    });

    it("should handle listener setup failure gracefully", async () => {
      mockListen.mockRejectedValue(new Error("Listener failed"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      renderHook(() => usePinState());

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "[Pin] Failed to setup pin state listener:",
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });

    it("should handle initial sync failure gracefully", async () => {
      mockInvoke.mockRejectedValue(new Error("Sync failed"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      renderHook(() => usePinState());

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "[Pin] Failed to sync initial pin state:",
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe("Cleanup", () => {
    it("should unlisten on unmount", async () => {
      const { unmount } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      unmount();

      expect(mockUnlisten).toHaveBeenCalled();
    });
  });

  describe("Pin State Events", () => {
    it("should update state when receiving valid pin-state-updated event", async () => {
      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      // Get the listener callback
      const callback = mockListen.mock.calls[0][1];

      // Simulate event
      act(() => {
        callback({
          payload: { pinned: true },
        });
      });

      expect(result.current.pinned).toBe(true);
    });

    it("should ignore invalid pin-state-updated payloads", async () => {
      vi.mocked(isPinStatePayload).mockReturnValue(false);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      const callback = mockListen.mock.calls[0][1];

      act(() => {
        callback({
          payload: { invalid: "data" },
        });
      });

      expect(result.current.pinned).toBe(false); // Should not change
      expect(consoleError).toHaveBeenCalledWith(
        "[Pin] Invalid pin-state-updated payload:",
        expect.any(Object)
      );

      consoleError.mockRestore();
    });
  });

  describe("togglePin", () => {
    it("should toggle pin state from false to true", async () => {
      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(result.current.pinned).toBe(false);
      });

      vi.clearAllMocks();

      await act(async () => {
        await result.current.togglePin();
      });

      expect(result.current.pinned).toBe(true);
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: true,
        })
      );
      expect(mockInvoke).toHaveBeenCalledWith("set_pinned", { pinned: true });
    });

    it("should toggle pin state from true to false", async () => {
      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        pinned: true,
      });

      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(result.current.pinned).toBe(true);
      });

      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        pinned: true,
      });
      vi.clearAllMocks();

      await act(async () => {
        await result.current.togglePin();
      });

      expect(result.current.pinned).toBe(false);
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: false,
        })
      );
      expect(mockInvoke).toHaveBeenCalledWith("set_pinned", { pinned: false });
    });

    it("should revert state on backend sync failure", async () => {
      mockInvoke.mockRejectedValue(new Error("Backend sync failed"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(result.current.pinned).toBe(false);
      });

      vi.clearAllMocks();

      await act(async () => {
        await result.current.togglePin();
      });

      // Should revert to original state
      expect(result.current.pinned).toBe(false);
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: false,
        })
      );
      expect(consoleError).toHaveBeenCalledWith(
        "[Pin] Failed to sync pin state to backend:",
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe("setPin", () => {
    it("should set pin state to true", async () => {
      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(result.current.pinned).toBe(false);
      });

      vi.clearAllMocks();

      await act(async () => {
        await result.current.setPin(true);
      });

      expect(result.current.pinned).toBe(true);
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: true,
        })
      );
      expect(mockInvoke).toHaveBeenCalledWith("set_pinned", { pinned: true });
    });

    it("should set pin state to false", async () => {
      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        pinned: true,
      });

      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(result.current.pinned).toBe(true);
      });

      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        pinned: true,
      });
      vi.clearAllMocks();

      await act(async () => {
        await result.current.setPin(false);
      });

      expect(result.current.pinned).toBe(false);
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned: false,
        })
      );
      expect(mockInvoke).toHaveBeenCalledWith("set_pinned", { pinned: false });
    });

    it("should skip update if already in desired state", async () => {
      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(result.current.pinned).toBe(false);
      });

      vi.clearAllMocks();

      await act(async () => {
        await result.current.setPin(false);
      });

      // Should not save or invoke backend
      expect(saveSettings).not.toHaveBeenCalled();
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(result.current.pinned).toBe(false);
    });

    it("should revert state on backend sync failure", async () => {
      mockInvoke.mockRejectedValue(new Error("Backend sync failed"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => usePinState());

      await waitFor(() => {
        expect(result.current.pinned).toBe(false);
      });

      vi.clearAllMocks();

      await act(async () => {
        await result.current.setPin(true);
      });

      // Should revert to original state
      expect(result.current.pinned).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "[Pin] Failed to set pin state:",
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe("Callback Stability", () => {
    it("should maintain stable callback references", () => {
      const { result, rerender } = renderHook(() => usePinState());

      const firstTogglePin = result.current.togglePin;
      const firstSetPin = result.current.setPin;

      rerender();

      expect(result.current.togglePin).toBe(firstTogglePin);
      expect(result.current.setPin).toBe(firstSetPin);
    });
  });
});
