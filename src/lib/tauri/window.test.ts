import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getScreenInfo, adjustWindowSize, ensureWindowVisible } from "./window";

// Mock the preload module
vi.mock("./preload", () => ({
  checkTauriAvailable: vi.fn(),
  invoke: vi.fn(),
}));

import { checkTauriAvailable, invoke } from "./preload";

describe("window.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getScreenInfo", () => {
    it("should return screen info when Tauri is available", async () => {
      const mockScreenInfo = {
        width: 1920,
        height: 1080,
        scale_factor: 2,
        available_width: 1920,
        available_height: 1055,
      };

      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue(mockScreenInfo);

      const result = await getScreenInfo();

      expect(checkTauriAvailable).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("get_screen_info");
      expect(result).toEqual(mockScreenInfo);
    });

    it("should return null when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await getScreenInfo();

      expect(checkTauriAvailable).toHaveBeenCalled();
      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should return null on error and log error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockRejectedValue(new Error("Failed to get screen"));

      const result = await getScreenInfo();

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to get screen info:",
        expect.any(Error)
      );
    });

    it("should handle different screen configurations", async () => {
      // Test ultra-wide screen
      const ultraWideScreen = {
        width: 3440,
        height: 1440,
        scale_factor: 1,
        available_width: 3440,
        available_height: 1400,
      };

      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue(ultraWideScreen);

      const result = await getScreenInfo();

      expect(result).toEqual(ultraWideScreen);
    });

    it("should handle retina display scale factors", async () => {
      const retinaScreen = {
        width: 2880,
        height: 1800,
        scale_factor: 2,
        available_width: 2880,
        available_height: 1750,
      };

      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue(retinaScreen);

      const result = await getScreenInfo();

      expect(result).toEqual(retinaScreen);
    });

    it("should handle fractional scale factors", async () => {
      const fractionalScreen = {
        width: 1920,
        height: 1080,
        scale_factor: 1.5,
        available_width: 1920,
        available_height: 1050,
      };

      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue(fractionalScreen);

      const result = await getScreenInfo();

      expect(result).toEqual(fractionalScreen);
    });
  });

  describe("adjustWindowSize", () => {
    it("should adjust window size when Tauri is available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue([1920, 1080]);

      const result = await adjustWindowSize(2560, 1440);

      expect(checkTauriAvailable).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("adjust_window_size", {
        maxWidth: 2560,
        maxHeight: 1440,
      });
      expect(result).toEqual([1920, 1080]);
    });

    it("should return null when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await adjustWindowSize(1920, 1080);

      expect(checkTauriAvailable).toHaveBeenCalled();
      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should return null on error and log error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockRejectedValue(new Error("Failed to adjust size"));

      const result = await adjustWindowSize(1920, 1080);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to adjust window size:",
        expect.any(Error)
      );
    });

    it("should handle small window sizes", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue([800, 600]);

      const result = await adjustWindowSize(800, 600);

      expect(invoke).toHaveBeenCalledWith("adjust_window_size", {
        maxWidth: 800,
        maxHeight: 600,
      });
      expect(result).toEqual([800, 600]);
    });

    it("should handle very large window sizes", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue([3840, 2160]);

      const result = await adjustWindowSize(3840, 2160);

      expect(invoke).toHaveBeenCalledWith("adjust_window_size", {
        maxWidth: 3840,
        maxHeight: 2160,
      });
      expect(result).toEqual([3840, 2160]);
    });

    it("should handle zero dimensions", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue([0, 0]);

      const result = await adjustWindowSize(0, 0);

      expect(invoke).toHaveBeenCalledWith("adjust_window_size", {
        maxWidth: 0,
        maxHeight: 0,
      });
      expect(result).toEqual([0, 0]);
    });

    it("should handle negative dimensions", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue([1920, 1080]);

      const result = await adjustWindowSize(-100, -100);

      expect(invoke).toHaveBeenCalledWith("adjust_window_size", {
        maxWidth: -100,
        maxHeight: -100,
      });
      expect(result).toEqual([1920, 1080]);
    });

    it("should handle fractional dimensions", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue([1920, 1080]);

      const result = await adjustWindowSize(1920.5, 1080.7);

      expect(invoke).toHaveBeenCalledWith("adjust_window_size", {
        maxWidth: 1920.5,
        maxHeight: 1080.7,
      });
      expect(result).toEqual([1920, 1080]);
    });
  });

  describe("ensureWindowVisible", () => {
    it("should ensure window is visible when Tauri is available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await ensureWindowVisible();

      expect(checkTauriAvailable).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith("ensure_window_visible");
      expect(result).toBe(true);
    });

    it("should return false when Tauri is not available", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(false);

      const result = await ensureWindowVisible();

      expect(checkTauriAvailable).toHaveBeenCalled();
      expect(invoke).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should return false on error and log error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockRejectedValue(
        new Error("Failed to ensure visible")
      );

      const result = await ensureWindowVisible();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to ensure window visible:",
        expect.any(Error)
      );
    });

    it("should handle invoke returning true", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await ensureWindowVisible();

      expect(result).toBe(true);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle sequential calls to different functions", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);

      // First call: get screen info
      const mockScreenInfo = {
        width: 1920,
        height: 1080,
        scale_factor: 2,
        available_width: 1920,
        available_height: 1055,
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockScreenInfo);

      const screenInfo = await getScreenInfo();
      expect(screenInfo).toEqual(mockScreenInfo);

      // Second call: adjust window size
      vi.mocked(invoke).mockResolvedValueOnce([1920, 1080]);

      const adjusted = await adjustWindowSize(2560, 1440);
      expect(adjusted).toEqual([1920, 1080]);

      // Third call: ensure visible
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const visible = await ensureWindowVisible();
      expect(visible).toBe(true);

      // Verify all calls were made
      expect(invoke).toHaveBeenCalledTimes(3);
    });

    it("should handle partial failures gracefully", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);

      // Success
      vi.mocked(invoke).mockResolvedValueOnce({
        width: 1920,
        height: 1080,
        scale_factor: 1,
        available_width: 1920,
        available_height: 1050,
      });

      const screenInfo = await getScreenInfo();
      expect(screenInfo).not.toBeNull();

      // Failure
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Adjust failed"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const adjusted = await adjustWindowSize(1920, 1080);
      expect(adjusted).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Success again
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const visible = await ensureWindowVisible();
      expect(visible).toBe(true);
    });
  });

  describe("Type safety", () => {
    it("should accept ScreenInfo with all required fields", async () => {
      const mockInfo = {
        width: 1920,
        height: 1080,
        scale_factor: 2,
        available_width: 1920,
        available_height: 1055,
      };

      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue(mockInfo);

      const result = await getScreenInfo();

      expect(result).toEqual(mockInfo);
      expect(result?.width).toBe(1920);
      expect(result?.scale_factor).toBe(2);
    });

    it("should handle tuple return type for adjustWindowSize", async () => {
      vi.mocked(checkTauriAvailable).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue([1920, 1080]);

      const result = await adjustWindowSize(2560, 1440);

      expect(Array.isArray(result)).toBe(true);
      expect(result?.length).toBe(2);
      expect(result?.[0]).toBe(1920);
      expect(result?.[1]).toBe(1080);
    });
  });
});
