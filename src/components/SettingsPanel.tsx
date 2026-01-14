import {
  clampFontSize,
  clampOpacity,
  DEFAULT_PIN_SHORTCUT,
  DEFAULT_SHORTCUT,
  loadSettings,
  MAX_FONT_SIZE,
  MAX_OPACITY,
  MIN_FONT_SIZE,
  MIN_OPACITY,
  saveSettings,
  type Settings,
} from "@/lib/settings";
import { useCallback, useEffect, useState } from "react";
import * as styles from "./SettingsPanel.css";

// Autostart functions - dynamically imported to ensure Tauri runtime is available
async function getAutostart() {
  if (!(window as Window & { __TAURI__?: unknown }).__TAURI__) return null;
  const { enable, disable, isEnabled } = await import("@tauri-apps/plugin-autostart");
  return { enable, disable, isEnabled };
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: Settings) => void;
}

// Convert keyboard event to shortcut string format
function eventToShortcutString(e: KeyboardEvent): string | null {
  // Need at least one modifier key
  if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    return null;
  }

  // Need a non-modifier key
  const key = e.key;
  if (["Meta", "Control", "Alt", "Shift"].includes(key)) {
    return null;
  }

  const parts: string[] = [];

  // Use CommandOrControl for cross-platform compatibility
  if (e.metaKey || e.ctrlKey) {
    parts.push("CommandOrControl");
  }
  if (e.altKey) {
    parts.push("Alt");
  }
  if (e.shiftKey) {
    parts.push("Shift");
  }

  // Normalize key name
  let normalizedKey = key;
  if (key.length === 1) {
    normalizedKey = key.toUpperCase();
  } else if (key === " ") {
    normalizedKey = "Space";
  } else if (key === "`" || key === "Backquote") {
    normalizedKey = "Backquote";
  } else if (key.startsWith("Arrow")) {
    normalizedKey = key.replace("Arrow", "");
  }

  parts.push(normalizedKey);

  return parts.join("+");
}

// Format shortcut for display (make it more readable)
function formatShortcutDisplay(shortcut: string): string {
  return shortcut
    .replace("CommandOrControl", "⌘/Ctrl")
    .replace("Shift", "⇧")
    .replace("Alt", "⌥")
    .replace(/\+/g, " ");
}

export default function SettingsPanel({ isOpen, onClose, onSettingsChange }: SettingsPanelProps) {
  const [opacity, setOpacity] = useState(0.9);
  const [fontSize, setFontSize] = useState(13);
  const [shortcut, setShortcut] = useState(DEFAULT_SHORTCUT);
  const [shortcutEnabled, setShortcutEnabled] = useState(true);
  const [pinShortcut, setPinShortcut] = useState(DEFAULT_PIN_SHORTCUT);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPin, setIsRecordingPin] = useState(false);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [launchAtLoginLoading, setLaunchAtLoginLoading] = useState(true);

  // Initialize state from localStorage on mount and when panel opens
  useEffect(() => {
    if (!isOpen) return;

    const settings = loadSettings();
    setOpacity(settings.opacity);
    setFontSize(settings.fontSize ?? 13);
    setShortcut(settings.globalShortcut ?? DEFAULT_SHORTCUT);
    setShortcutEnabled(settings.shortcutEnabled ?? true);
    setPinShortcut(settings.pinShortcut ?? DEFAULT_PIN_SHORTCUT);

    // Check autostart status only if not already loaded
    if (launchAtLoginLoading) {
      (async () => {
        try {
          const autostart = await getAutostart();
          if (autostart) {
            const enabled = await autostart.isEnabled();
            setLaunchAtLogin(enabled);
          }
        } catch (error) {
          console.error("Failed to check autostart status:", error);
        } finally {
          setLaunchAtLoginLoading(false);
        }
      })();
    }
  }, [isOpen, launchAtLoginLoading]);

  // Close on ESC key press (but not when recording shortcut)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isRecording && !isRecordingPin) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isRecording, isRecordingPin]);

  // Handle shortcut recording
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // ESC cancels recording
      if (e.key === "Escape") {
        setIsRecording(false);
        return;
      }

      const newShortcut = eventToShortcutString(e);
      if (newShortcut) {
        setShortcut(newShortcut);
        setIsRecording(false);

        // Save the new shortcut
        const currentSettings = loadSettings();
        const newSettings: Settings = { ...currentSettings, globalShortcut: newShortcut };
        saveSettings(newSettings);
        onSettingsChange(newSettings);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, onSettingsChange]);

  // Handle pin shortcut recording
  useEffect(() => {
    if (!isRecordingPin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // ESC cancels recording
      if (e.key === "Escape") {
        setIsRecordingPin(false);
        return;
      }

      const newShortcut = eventToShortcutString(e);
      if (newShortcut) {
        setPinShortcut(newShortcut);
        setIsRecordingPin(false);

        // Save the new shortcut
        const currentSettings = loadSettings();
        const newSettings: Settings = { ...currentSettings, pinShortcut: newShortcut };
        saveSettings(newSettings);
        onSettingsChange(newSettings);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isRecordingPin, onSettingsChange]);

  const handleOpacityChange = useCallback(
    (value: number) => {
      const clamped = clampOpacity(value);
      setOpacity(clamped);
      const currentSettings = loadSettings();
      const newSettings: Settings = { ...currentSettings, opacity: clamped };
      saveSettings(newSettings);
      onSettingsChange(newSettings);
    },
    [onSettingsChange]
  );

  const handleFontSizeChange = useCallback(
    (value: number) => {
      const clamped = clampFontSize(value);
      setFontSize(clamped);
      const currentSettings = loadSettings();
      const newSettings: Settings = { ...currentSettings, fontSize: clamped };
      saveSettings(newSettings);
      onSettingsChange(newSettings);
    },
    [onSettingsChange]
  );

  const handleOpacitySliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleOpacityChange(parseFloat(e.target.value));
  };

  const handleFontSizeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFontSizeChange(parseInt(e.target.value, 10));
  };

  const handleShortcutEnabledChange = useCallback(
    (enabled: boolean) => {
      setShortcutEnabled(enabled);
      const currentSettings = loadSettings();
      const newSettings: Settings = { ...currentSettings, shortcutEnabled: enabled };
      saveSettings(newSettings);
      onSettingsChange(newSettings);
    },
    [onSettingsChange]
  );

  const startRecording = () => {
    setIsRecording(true);
  };

  const startRecordingPin = () => {
    setIsRecordingPin(true);
  };

  const handleLaunchAtLoginChange = useCallback(async (enabled: boolean) => {
    try {
      const autostart = await getAutostart();
      if (!autostart) return;

      if (enabled) {
        await autostart.enable();
      } else {
        await autostart.disable();
      }
      setLaunchAtLogin(enabled);
    } catch (error) {
      console.error("Failed to change autostart setting:", error);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className={styles.settingsOverlay} onClick={onClose} data-testid="settings-overlay">
      <div className={styles.settingsPanel} onClick={(e) => e.stopPropagation()} data-testid="settings-panel">
        <div className={styles.settingsHeader}>
          <span className={styles.settingsTitle}>Settings</span>
          <button className={styles.settingsClose} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.settingsContent}>
          <div className={styles.settingsItem}>
            <label className={styles.settingsLabel}>
              Background Opacity
              <span className={styles.settingsValue}>{Math.round(opacity * 100)}%</span>
            </label>
            <input
              type="range"
              min={MIN_OPACITY}
              max={MAX_OPACITY}
              step={0.05}
              value={opacity}
              onChange={handleOpacitySliderChange}
              className={styles.settingsSlider}
            />
            <div className={styles.settingsHint}>Adjust the terminal background transparency</div>
          </div>

          <div className={styles.settingsItem}>
            <label className={styles.settingsLabel}>
              Font Size
              <span className={styles.settingsValue}>{fontSize}px</span>
            </label>
            <input
              type="range"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              value={fontSize}
              onChange={handleFontSizeSliderChange}
              className={styles.settingsSlider}
            />
            <div className={styles.settingsHint}>
              Adjust the terminal font size ({MIN_FONT_SIZE}-{MAX_FONT_SIZE}px)
            </div>
          </div>

          <div className={styles.settingsDivider} />

          <div className={styles.settingsItem}>
            <label className={styles.settingsLabel}>
              Global Shortcut
              <label className={styles.settingsToggle}>
                <input
                  type="checkbox"
                  checked={shortcutEnabled}
                  onChange={(e) => handleShortcutEnabledChange(e.target.checked)}
                />
                <span className={styles.toggleSlider} />
              </label>
            </label>
            <div className={styles.shortcutRecorder}>
              <button
                className={`${styles.shortcutButton} ${
                  isRecording ? styles.shortcutButtonRecording : ""
                }`}
                onClick={startRecording}
                disabled={!shortcutEnabled}
              >
                {isRecording ? (
                  <span className={styles.recordingText}>Press keys...</span>
                ) : (
                  <span className={styles.shortcutDisplay}>{formatShortcutDisplay(shortcut)}</span>
                )}
              </button>
            </div>
            <div className={styles.settingsHint}>
              {shortcutEnabled
                ? "Click to change the shortcut. Press ESC to cancel."
                : "Enable to set a global shortcut for quick access"}
            </div>
          </div>

          <div className={styles.settingsDivider} />

          <div className={styles.settingsItem}>
            <label className={styles.settingsLabel}>Pin Shortcut</label>
            <div className={styles.shortcutRecorder}>
              <button
                className={`${styles.shortcutButton} ${
                  isRecordingPin ? styles.shortcutButtonRecording : ""
                }`}
                onClick={startRecordingPin}
              >
                {isRecordingPin ? (
                  <span className={styles.recordingText}>Press keys...</span>
                ) : (
                  <span className={styles.shortcutDisplay}>
                    {formatShortcutDisplay(pinShortcut)}
                  </span>
                )}
              </button>
            </div>
            <div className={styles.settingsHint}>
              Click to change the shortcut for toggling pin state. Press ESC to cancel.
            </div>
          </div>

          <div className={styles.settingsDivider} />

          <div className={styles.settingsItem}>
            <label className={styles.settingsLabel}>
              Launch at Login
              <label className={styles.settingsToggle}>
                <input
                  type="checkbox"
                  checked={launchAtLogin}
                  disabled={launchAtLoginLoading}
                  onChange={(e) => handleLaunchAtLoginChange(e.target.checked)}
                />
                <span className={styles.toggleSlider} />
              </label>
            </label>
            <div className={styles.settingsHint}>
              Automatically start µTerm when you log in to your Mac
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
