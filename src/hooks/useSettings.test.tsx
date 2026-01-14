import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSettings } from "./useSettings";

// Mock dependencies
vi.mock("@/lib/settings", () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  DEFAULT_SHORTCUT: "CommandOrControl+Shift+Space",
  DEFAULT_PIN_SHORTCUT: "CommandOrControl+Shift+P",
}));

vi.mock("@/lib/tauri", () => ({
  registerGlobalShortcut: vi.fn(),
  registerGlobalShortcutNoToggle: vi.fn(),
  unregisterGlobalShortcut: vi.fn(),
}));

vi.mock("@/lib/pin", () => ({
  togglePinState: vi.fn(),
}));

import { loadSettings, saveSettings, DEFAULT_SHORTCUT, DEFAULT_PIN_SHORTCUT } from "@/lib/settings";
import {
  registerGlobalShortcut,
  registerGlobalShortcutNoToggle,
  unregisterGlobalShortcut,
} from "@/lib/tauri";
import { togglePinState } from "@/lib/pin";

describe("useSettings", () => {
  const mockSettings = {
    opacity: 0.96,
    fontSize: 14,
    globalShortcut: "CommandOrControl+Shift+Space",
    shortcutEnabled: true,
    pinShortcut: "CommandOrControl+Shift+P",
    onboardingComplete: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSettings).mockReturnValue(mockSettings);
    vi.mocked(registerGlobalShortcut).mockResolvedValue(undefined);
    vi.mocked(registerGlobalShortcutNoToggle).mockResolvedValue(undefined);
    vi.mocked(unregisterGlobalShortcut).mockResolvedValue(undefined);
  });

  describe("Initialization", () => {
    it("should load settings on mount", async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(loadSettings).toHaveBeenCalled();
        expect(result.current.opacity).toBe(0.96);
        expect(result.current.fontSize).toBe(14);
      });
    });

    it("should show onboarding for first-time users", async () => {
      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        onboardingComplete: false,
      });

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.showOnboarding).toBe(true);
      });
    });

    it("should not show onboarding for returning users", async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.showOnboarding).toBe(false);
      });
    });

    it("should register global shortcut on mount", async () => {
      renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcut).toHaveBeenCalledWith(
          "CommandOrControl+Shift+Space",
          expect.any(Function)
        );
      });
    });

    it("should register pin shortcut on mount", async () => {
      renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcutNoToggle).toHaveBeenCalledWith(
          "CommandOrControl+Shift+P",
          expect.any(Function)
        );
      });
    });

    it("should not register shortcut when disabled", async () => {
      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        shortcutEnabled: false,
      });

      renderHook(() => useSettings());

      await waitFor(() => {
        expect(loadSettings).toHaveBeenCalled();
      });

      // Wait a bit to ensure registerGlobalShortcut is not called
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(registerGlobalShortcut).not.toHaveBeenCalled();
    });

    it("should use default pin shortcut when not specified", async () => {
      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        pinShortcut: undefined,
      });

      renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcutNoToggle).toHaveBeenCalledWith(
          DEFAULT_PIN_SHORTCUT,
          expect.any(Function)
        );
      });
    });

    it("should call onShortcutError when registration fails", async () => {
      const onShortcutError = vi.fn();
      vi.mocked(registerGlobalShortcut).mockRejectedValue(new Error("Registration failed"));

      renderHook(() => useSettings({ onShortcutError }));

      await waitFor(() => {
        expect(onShortcutError).toHaveBeenCalledWith("CommandOrControl+Shift+Space");
      });
    });
  });

  describe("Cleanup", () => {
    it("should unregister shortcuts on unmount", async () => {
      const { unmount } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcut).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(unregisterGlobalShortcut).toHaveBeenCalledWith("CommandOrControl+Shift+Space");
        expect(unregisterGlobalShortcut).toHaveBeenCalledWith("CommandOrControl+Shift+P");
      });
    });

    it("should not throw when unregister fails", async () => {
      vi.mocked(unregisterGlobalShortcut).mockRejectedValue(new Error("Unregister failed"));

      const { unmount } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcut).toHaveBeenCalled();
      });

      // Should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("handleSettingsChange", () => {
    it("should update opacity and fontSize", async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.opacity).toBe(0.96);
      });

      const newSettings = {
        ...mockSettings,
        opacity: 0.8,
        fontSize: 16,
      };

      await act(async () => {
        await result.current.handleSettingsChange(newSettings);
      });

      expect(result.current.opacity).toBe(0.8);
      expect(result.current.fontSize).toBe(16);
    });

    it("should re-register shortcut when changed", async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcut).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      const newSettings = {
        ...mockSettings,
        globalShortcut: "CommandOrControl+Shift+T",
      };

      await act(async () => {
        await result.current.handleSettingsChange(newSettings);
      });

      expect(unregisterGlobalShortcut).toHaveBeenCalledWith("CommandOrControl+Shift+Space");
      expect(registerGlobalShortcut).toHaveBeenCalledWith(
        "CommandOrControl+Shift+T",
        expect.any(Function)
      );
    });

    it("should unregister shortcut when disabled", async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcut).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      const newSettings = {
        ...mockSettings,
        shortcutEnabled: false,
      };

      await act(async () => {
        await result.current.handleSettingsChange(newSettings);
      });

      expect(unregisterGlobalShortcut).toHaveBeenCalledWith("CommandOrControl+Shift+Space");
      expect(registerGlobalShortcut).not.toHaveBeenCalled();
    });

    it("should re-register pin shortcut when changed", async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcutNoToggle).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      const newSettings = {
        ...mockSettings,
        pinShortcut: "CommandOrControl+P",
      };

      await act(async () => {
        await result.current.handleSettingsChange(newSettings);
      });

      expect(unregisterGlobalShortcut).toHaveBeenCalledWith("CommandOrControl+Shift+P");
      expect(registerGlobalShortcutNoToggle).toHaveBeenCalledWith(
        "CommandOrControl+P",
        expect.any(Function)
      );
    });

    it("should use default shortcut when not specified", async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcut).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      // First change to a different shortcut
      await act(async () => {
        await result.current.handleSettingsChange({
          ...mockSettings,
          globalShortcut: "CommandOrControl+Alt+T",
        });
      });

      vi.clearAllMocks();

      // Then change back to undefined (should use default)
      const newSettings = {
        ...mockSettings,
        globalShortcut: undefined,
      };

      await act(async () => {
        await result.current.handleSettingsChange(newSettings);
      });

      expect(registerGlobalShortcut).toHaveBeenCalledWith(DEFAULT_SHORTCUT, expect.any(Function));
    });

    it("should call onShortcutError when shortcut change fails", async () => {
      const onShortcutError = vi.fn();
      const { result } = renderHook(() => useSettings({ onShortcutError }));

      await waitFor(() => {
        expect(registerGlobalShortcut).toHaveBeenCalled();
      });

      vi.mocked(registerGlobalShortcut).mockRejectedValue(new Error("Registration failed"));

      const newSettings = {
        ...mockSettings,
        globalShortcut: "CommandOrControl+Shift+T",
      };

      await act(async () => {
        await result.current.handleSettingsChange(newSettings);
      });

      expect(onShortcutError).toHaveBeenCalledWith("CommandOrControl+Shift+T");
    });
  });

  describe("handleOnboardingComplete", () => {
    it("should hide onboarding and save settings", async () => {
      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        onboardingComplete: false,
      });

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.showOnboarding).toBe(true);
      });

      act(() => {
        result.current.handleOnboardingComplete();
      });

      expect(result.current.showOnboarding).toBe(false);
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardingComplete: true,
        })
      );
    });

    it("should maintain other settings when marking onboarding complete", async () => {
      vi.mocked(loadSettings).mockReturnValue({
        ...mockSettings,
        onboardingComplete: false,
      });

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.showOnboarding).toBe(true);
      });

      act(() => {
        result.current.handleOnboardingComplete();
      });

      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          opacity: 0.96,
          fontSize: 14,
          globalShortcut: "CommandOrControl+Shift+Space",
          onboardingComplete: true,
        })
      );
    });
  });

  describe("Pin Shortcut Integration", () => {
    it("should call togglePinState when pin shortcut is triggered", async () => {
      renderHook(() => useSettings());

      await waitFor(() => {
        expect(registerGlobalShortcutNoToggle).toHaveBeenCalled();
      });

      // Get the callback passed to registerGlobalShortcutNoToggle
      const callback = vi.mocked(registerGlobalShortcutNoToggle).mock.calls[0][1];

      await callback();

      expect(togglePinState).toHaveBeenCalled();
    });
  });
});
