"use client";

// Settings keys for localStorage
const SETTINGS_KEY = "microterm-settings";

// Default settings values
const DEFAULT_OPACITY = 0.9;
const MIN_OPACITY = 0.3;
const MAX_OPACITY = 1.0;

export interface Settings {
  opacity: number;
}

const defaultSettings: Settings = {
  opacity: DEFAULT_OPACITY,
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Settings>;
      return {
        opacity: clampOpacity(parsed.opacity ?? DEFAULT_OPACITY),
      };
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }

  return defaultSettings;
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

export function clampOpacity(value: number): number {
  return Math.max(MIN_OPACITY, Math.min(MAX_OPACITY, value));
}

export { DEFAULT_OPACITY, MIN_OPACITY, MAX_OPACITY };
