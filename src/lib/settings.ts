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

export interface WindowSize {
  width: number;
  height: number;
}

export interface Settings {
  opacity: number;
  windowSize?: WindowSize;
  fontSize?: number;
  globalShortcut?: string;
  shortcutEnabled?: boolean;
  pinShortcut?: string; // Pin shortcut
  onboardingComplete?: boolean;
  pinned?: boolean; // Window pin state
}

const defaultSettings: Settings = {
  opacity: DEFAULT_OPACITY,
  windowSize: { width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT },
  fontSize: DEFAULT_FONT_SIZE,
  globalShortcut: DEFAULT_SHORTCUT,
  shortcutEnabled: true,
  pinShortcut: DEFAULT_PIN_SHORTCUT,
  onboardingComplete: false,
  pinned: false, // Default: not pinned
};

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Settings>;
      return {
        opacity: clampOpacity(parsed.opacity ?? DEFAULT_OPACITY),
        windowSize: parsed.windowSize
          ? clampWindowSize(parsed.windowSize)
          : defaultSettings.windowSize,
        fontSize: clampFontSize(parsed.fontSize ?? DEFAULT_FONT_SIZE),
        globalShortcut: parsed.globalShortcut ?? DEFAULT_SHORTCUT,
        shortcutEnabled: parsed.shortcutEnabled ?? true,
        pinShortcut: parsed.pinShortcut ?? DEFAULT_PIN_SHORTCUT,
        onboardingComplete: parsed.onboardingComplete ?? false,
        pinned: parsed.pinned ?? false,
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
  return Math.max(MIN_OPACITY, Math.min(MAX_OPACITY, value));
}

export function clampWindowSize(size: WindowSize): WindowSize {
  return {
    width: Math.max(MIN_WINDOW_WIDTH, Math.min(MAX_WINDOW_WIDTH, size.width)),
    height: Math.max(MIN_WINDOW_HEIGHT, Math.min(MAX_WINDOW_HEIGHT, size.height)),
  };
}

export function clampFontSize(value: number): number {
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
