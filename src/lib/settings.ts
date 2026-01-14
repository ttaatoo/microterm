// Settings keys for localStorage
const SETTINGS_KEY = "microterm-settings";

// Default settings values
const DEFAULT_OPACITY = 0.9;
const MIN_OPACITY = 0.3;
const MAX_OPACITY = 1.0;

// Default window size (logical pixels)
const DEFAULT_WINDOW_WIDTH = 600;
const DEFAULT_WINDOW_HEIGHT = 400;
const MIN_WINDOW_WIDTH = 400;
const MIN_WINDOW_HEIGHT = 200;
const MAX_WINDOW_WIDTH = 1200;
const MAX_WINDOW_HEIGHT = 800;

// Font size settings
const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;

// Global shortcut settings
// Default: Cmd+Shift+T on macOS, Ctrl+Shift+T on other platforms
const DEFAULT_SHORTCUT = "CommandOrControl+Shift+T";
// Pin shortcut: Cmd+` on macOS, Ctrl+` on other platforms
const DEFAULT_PIN_SHORTCUT = "CommandOrControl+Backquote";

// Note: WindowSize interface removed - window size now managed by Rust backend (screen_config.rs)

export interface Settings {
  opacity: number;
  fontSize?: number;
  globalShortcut?: string;
  shortcutEnabled?: boolean;
  pinShortcut?: string; // Pin shortcut
  onboardingComplete?: boolean;
  pinned?: boolean; // Window pin state
}

const defaultSettings: Settings = {
  opacity: DEFAULT_OPACITY,
  // windowSize removed - now managed by Rust backend per screen
  fontSize: DEFAULT_FONT_SIZE,
  globalShortcut: DEFAULT_SHORTCUT,
  shortcutEnabled: true,
  pinShortcut: DEFAULT_PIN_SHORTCUT,
  onboardingComplete: false,
  pinned: false,
};

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Validate parsed data is an object
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        console.warn("Invalid settings data format, using defaults");
        return defaultSettings;
      }

      // Safely extract values with type checking
      const opacity =
        typeof parsed.opacity === "number" ? clampOpacity(parsed.opacity) : DEFAULT_OPACITY;
      const fontSize =
        typeof parsed.fontSize === "number" ? clampFontSize(parsed.fontSize) : DEFAULT_FONT_SIZE;
      // windowSize removed - now managed by Rust backend per screen
      const globalShortcut =
        typeof parsed.globalShortcut === "string" ? parsed.globalShortcut : DEFAULT_SHORTCUT;
      const shortcutEnabled =
        typeof parsed.shortcutEnabled === "boolean" ? parsed.shortcutEnabled : true;
      const pinShortcut =
        typeof parsed.pinShortcut === "string" ? parsed.pinShortcut : DEFAULT_PIN_SHORTCUT;
      const onboardingComplete =
        typeof parsed.onboardingComplete === "boolean" ? parsed.onboardingComplete : false;
      const pinned = typeof parsed.pinned === "boolean" ? parsed.pinned : false;

      return {
        opacity,
        fontSize,
        globalShortcut,
        shortcutEnabled,
        pinShortcut,
        onboardingComplete,
        pinned,
      };
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }

  return defaultSettings;
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

export function clampOpacity(value: number): number {
  // Validate number is finite to prevent NaN/Infinity bugs
  if (!Number.isFinite(value)) {
    console.warn(`Invalid opacity value: ${value}, using default`);
    return DEFAULT_OPACITY;
  }
  return Math.max(MIN_OPACITY, Math.min(MAX_OPACITY, value));
}

// Note: Window size utility functions removed
// Window sizing is now fully managed by Rust backend (screen_config.rs)
// - Per-screen size persistence
// - Dynamic sizing based on screen resolution
// - Position calculation (centered + near menubar)

export function clampFontSize(value: number): number {
  // Validate number is finite to prevent NaN/Infinity bugs
  if (!Number.isFinite(value)) {
    console.warn(`Invalid font size value: ${value}, using default`);
    return DEFAULT_FONT_SIZE;
  }
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, value));
}

export {
  DEFAULT_FONT_SIZE,
  DEFAULT_OPACITY,
  DEFAULT_PIN_SHORTCUT,
  DEFAULT_SHORTCUT,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  MAX_FONT_SIZE,
  MAX_OPACITY,
  MAX_WINDOW_HEIGHT,
  MAX_WINDOW_WIDTH,
  MIN_FONT_SIZE,
  MIN_OPACITY,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
};
