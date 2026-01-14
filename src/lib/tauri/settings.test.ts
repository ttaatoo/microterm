import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSettings,
  updateSettings,
  setOpacity,
  setFontSize,
  setPinned,
  getPinned,
  setOnboardingComplete,
  type AppSettings,
} from "./settings";

// Mock preload module
vi.mock("./preload", () => ({
  invoke: vi.fn(),
  checkTauriAvailable: vi.fn(() => true),
}));

import { invoke, checkTauriAvailable } from "./preload";

describe("settings.ts", () => {
  const mockSettings: AppSettings = {
    opacity: 0.95,
    fontSize: 14,
    globalShortcut: "CommandOrControl+Shift+T",
    shortcutEnabled: true,
    pinShortcut: "CommandOrControl+Shift+P",
    onboardingComplete: true,
    pinned: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkTauriAvailable).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  describe("getSettings", () => {
    it("should get settings from backend", async () => {
      vi.mocked(invoke).mockResolvedValue(mockSettings);

      const result = await getSettings();

      expect(invoke).toHaveBeenCalledWith("get_settings");
      expect(result).toEqual(mockSettings);
    });

    it("should return null when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await getSettings();

      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValue(new Error("Backend error"));

      const result = await getSettings();

      expect(consoleSpy).toHaveBeenCalledWith("Failed to get settings:", expect.any(Error));
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe("updateSettings", () => {
    it("should update settings in backend", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await updateSettings(mockSettings);

      expect(invoke).toHaveBeenCalledWith("update_settings", { settings: mockSettings });
      expect(result).toBe(true);
    });

    it("should return false when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await updateSettings(mockSettings);

      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle errors and return false", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValue(new Error("Update failed"));

      const result = await updateSettings(mockSettings);

      expect(consoleSpy).toHaveBeenCalledWith("Failed to update settings:", expect.any(Error));
      expect(result).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("setOpacity", () => {
    it("should set opacity value", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await setOpacity(0.85);

      expect(invoke).toHaveBeenCalledWith("set_opacity", { opacity: 0.85 });
      expect(result).toBe(true);
    });

    it("should return false when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await setOpacity(0.95);

      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle errors and return false", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValue(new Error("Set opacity failed"));

      const result = await setOpacity(0.9);

      expect(consoleSpy).toHaveBeenCalledWith("Failed to set opacity:", expect.any(Error));
      expect(result).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("setFontSize", () => {
    it("should set font size value", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await setFontSize(16);

      expect(invoke).toHaveBeenCalledWith("set_font_size", { fontSize: 16 });
      expect(result).toBe(true);
    });

    it("should return false when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await setFontSize(14);

      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle errors and return false", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValue(new Error("Set font size failed"));

      const result = await setFontSize(12);

      expect(consoleSpy).toHaveBeenCalledWith("Failed to set font size:", expect.any(Error));
      expect(result).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("setPinned", () => {
    it("should set pinned state to true", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await setPinned(true);

      expect(invoke).toHaveBeenCalledWith("set_pinned", { pinned: true });
      expect(result).toBe(true);
    });

    it("should set pinned state to false", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await setPinned(false);

      expect(invoke).toHaveBeenCalledWith("set_pinned", { pinned: false });
      expect(result).toBe(true);
    });

    it("should return false when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await setPinned(true);

      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle errors and return false", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValue(new Error("Set pinned failed"));

      const result = await setPinned(true);

      expect(consoleSpy).toHaveBeenCalledWith("Failed to set pinned:", expect.any(Error));
      expect(result).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("getPinned", () => {
    it("should get pinned state true", async () => {
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await getPinned();

      expect(invoke).toHaveBeenCalledWith("get_pinned");
      expect(result).toBe(true);
    });

    it("should get pinned state false", async () => {
      vi.mocked(invoke).mockResolvedValue(false);

      const result = await getPinned();

      expect(invoke).toHaveBeenCalledWith("get_pinned");
      expect(result).toBe(false);
    });

    it("should return false when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await getPinned();

      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle errors and return false", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValue(new Error("Get pinned failed"));

      const result = await getPinned();

      expect(consoleSpy).toHaveBeenCalledWith("Failed to get pinned:", expect.any(Error));
      expect(result).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("setOnboardingComplete", () => {
    it("should set onboarding complete to true", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await setOnboardingComplete(true);

      expect(invoke).toHaveBeenCalledWith("set_onboarding_complete", { complete: true });
      expect(result).toBe(true);
    });

    it("should set onboarding complete to false", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await setOnboardingComplete(false);

      expect(invoke).toHaveBeenCalledWith("set_onboarding_complete", { complete: false });
      expect(result).toBe(true);
    });

    it("should return false when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await setOnboardingComplete(true);

      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle errors and return false", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValue(new Error("Set onboarding failed"));

      const result = await setOnboardingComplete(true);

      expect(consoleSpy).toHaveBeenCalledWith("Failed to set onboarding complete:", expect.any(Error));
      expect(result).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
