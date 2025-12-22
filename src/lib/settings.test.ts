import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadSettings,
  saveSettings,
  clampOpacity,
  clampWindowSize,
  clampFontSize,
  MIN_OPACITY,
  MAX_OPACITY,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  MAX_WINDOW_WIDTH,
  MAX_WINDOW_HEIGHT,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_OPACITY,
  DEFAULT_FONT_SIZE,
  type Settings,
} from "./settings";

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("clampOpacity", () => {
    it("should return value within range", () => {
      expect(clampOpacity(0.5)).toBe(0.5);
      expect(clampOpacity(0.7)).toBe(0.7);
    });

    it("should clamp value below minimum", () => {
      expect(clampOpacity(0.1)).toBe(MIN_OPACITY);
      expect(clampOpacity(0)).toBe(MIN_OPACITY);
      expect(clampOpacity(-1)).toBe(MIN_OPACITY);
    });

    it("should clamp value above maximum", () => {
      expect(clampOpacity(1.5)).toBe(MAX_OPACITY);
      expect(clampOpacity(2)).toBe(MAX_OPACITY);
    });

    it("should handle edge values", () => {
      expect(clampOpacity(MIN_OPACITY)).toBe(MIN_OPACITY);
      expect(clampOpacity(MAX_OPACITY)).toBe(MAX_OPACITY);
    });
  });

  describe("clampFontSize", () => {
    it("should return value within range", () => {
      expect(clampFontSize(13)).toBe(13);
      expect(clampFontSize(16)).toBe(16);
    });

    it("should clamp value below minimum", () => {
      expect(clampFontSize(5)).toBe(MIN_FONT_SIZE);
      expect(clampFontSize(0)).toBe(MIN_FONT_SIZE);
      expect(clampFontSize(-10)).toBe(MIN_FONT_SIZE);
    });

    it("should clamp value above maximum", () => {
      expect(clampFontSize(30)).toBe(MAX_FONT_SIZE);
      expect(clampFontSize(100)).toBe(MAX_FONT_SIZE);
    });

    it("should handle edge values", () => {
      expect(clampFontSize(MIN_FONT_SIZE)).toBe(MIN_FONT_SIZE);
      expect(clampFontSize(MAX_FONT_SIZE)).toBe(MAX_FONT_SIZE);
    });
  });

  describe("clampWindowSize", () => {
    it("should return size within range", () => {
      const size = { width: 600, height: 400 };
      expect(clampWindowSize(size)).toEqual(size);
    });

    it("should clamp width below minimum", () => {
      const result = clampWindowSize({ width: 100, height: 400 });
      expect(result.width).toBe(MIN_WINDOW_WIDTH);
      expect(result.height).toBe(400);
    });

    it("should clamp height below minimum", () => {
      const result = clampWindowSize({ width: 600, height: 50 });
      expect(result.width).toBe(600);
      expect(result.height).toBe(MIN_WINDOW_HEIGHT);
    });

    it("should clamp width above maximum", () => {
      const result = clampWindowSize({ width: 2000, height: 400 });
      expect(result.width).toBe(MAX_WINDOW_WIDTH);
      expect(result.height).toBe(400);
    });

    it("should clamp height above maximum", () => {
      const result = clampWindowSize({ width: 600, height: 1500 });
      expect(result.width).toBe(600);
      expect(result.height).toBe(MAX_WINDOW_HEIGHT);
    });

    it("should clamp both dimensions", () => {
      const result = clampWindowSize({ width: 100, height: 50 });
      expect(result.width).toBe(MIN_WINDOW_WIDTH);
      expect(result.height).toBe(MIN_WINDOW_HEIGHT);
    });
  });

  describe("loadSettings", () => {
    it("should return default settings when localStorage is empty", () => {
      const settings = loadSettings();
      expect(settings.opacity).toBe(DEFAULT_OPACITY);
      expect(settings.fontSize).toBe(DEFAULT_FONT_SIZE);
      expect(settings.windowSize).toBeDefined();
    });

    it("should load saved settings from localStorage", () => {
      const savedSettings: Settings = {
        opacity: 0.7,
        fontSize: 16,
        windowSize: { width: 800, height: 500 },
      };
      localStorage.setItem("microterm-settings", JSON.stringify(savedSettings));

      const settings = loadSettings();
      expect(settings.opacity).toBe(0.7);
      expect(settings.fontSize).toBe(16);
      expect(settings.windowSize).toEqual({ width: 800, height: 500 });
    });

    it("should clamp invalid opacity values", () => {
      localStorage.setItem(
        "microterm-settings",
        JSON.stringify({ opacity: 2.0 })
      );
      const settings = loadSettings();
      expect(settings.opacity).toBe(MAX_OPACITY);
    });

    it("should clamp invalid fontSize values", () => {
      localStorage.setItem(
        "microterm-settings",
        JSON.stringify({ fontSize: 50 })
      );
      const settings = loadSettings();
      expect(settings.fontSize).toBe(MAX_FONT_SIZE);
    });

    it("should clamp invalid windowSize values", () => {
      localStorage.setItem(
        "microterm-settings",
        JSON.stringify({ windowSize: { width: 100, height: 50 } })
      );
      const settings = loadSettings();
      expect(settings.windowSize?.width).toBe(MIN_WINDOW_WIDTH);
      expect(settings.windowSize?.height).toBe(MIN_WINDOW_HEIGHT);
    });

    it("should use defaults for missing properties", () => {
      localStorage.setItem("microterm-settings", JSON.stringify({}));
      const settings = loadSettings();
      expect(settings.opacity).toBe(DEFAULT_OPACITY);
      expect(settings.fontSize).toBe(DEFAULT_FONT_SIZE);
    });

    it("should default onboardingComplete to false", () => {
      const settings = loadSettings();
      expect(settings.onboardingComplete).toBe(false);
    });

    it("should load saved onboardingComplete value", () => {
      localStorage.setItem(
        "microterm-settings",
        JSON.stringify({ onboardingComplete: true })
      );
      const settings = loadSettings();
      expect(settings.onboardingComplete).toBe(true);
    });

    it("should load global shortcut settings", () => {
      localStorage.setItem(
        "microterm-settings",
        JSON.stringify({
          globalShortcut: "CommandOrControl+Shift+Space",
          shortcutEnabled: false
        })
      );
      const settings = loadSettings();
      expect(settings.globalShortcut).toBe("CommandOrControl+Shift+Space");
      expect(settings.shortcutEnabled).toBe(false);
    });

    it("should handle corrupted JSON gracefully", () => {
      localStorage.setItem("microterm-settings", "invalid json");
      const settings = loadSettings();
      expect(settings.opacity).toBe(DEFAULT_OPACITY);
      expect(settings.fontSize).toBe(DEFAULT_FONT_SIZE);
    });
  });

  describe("saveSettings", () => {
    it("should save settings to localStorage", () => {
      const settings: Settings = {
        opacity: 0.8,
        fontSize: 14,
        windowSize: { width: 700, height: 450 },
      };
      saveSettings(settings);

      const saved = JSON.parse(localStorage.getItem("microterm-settings")!);
      expect(saved.opacity).toBe(0.8);
      expect(saved.fontSize).toBe(14);
      expect(saved.windowSize).toEqual({ width: 700, height: 450 });
    });

    it("should overwrite existing settings", () => {
      saveSettings({ opacity: 0.5, fontSize: 12 });
      saveSettings({ opacity: 0.9, fontSize: 18 });

      const saved = JSON.parse(localStorage.getItem("microterm-settings")!);
      expect(saved.opacity).toBe(0.9);
      expect(saved.fontSize).toBe(18);
    });

    it("should save onboardingComplete value", () => {
      saveSettings({ opacity: 0.9, onboardingComplete: true });

      const saved = JSON.parse(localStorage.getItem("microterm-settings")!);
      expect(saved.onboardingComplete).toBe(true);
    });

    it("should save global shortcut settings", () => {
      saveSettings({
        opacity: 0.9,
        globalShortcut: "CommandOrControl+Shift+Space",
        shortcutEnabled: true
      });

      const saved = JSON.parse(localStorage.getItem("microterm-settings")!);
      expect(saved.globalShortcut).toBe("CommandOrControl+Shift+Space");
      expect(saved.shortcutEnabled).toBe(true);
    });
  });
});
