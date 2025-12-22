"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadSettings,
  saveSettings,
  clampOpacity,
  clampFontSize,
  MIN_OPACITY,
  MAX_OPACITY,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_SHORTCUT,
  type Settings,
} from "@/lib/settings";

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

export default function SettingsPanel({
  isOpen,
  onClose,
  onSettingsChange,
}: SettingsPanelProps) {
  const [opacity, setOpacity] = useState(0.9);
  const [fontSize, setFontSize] = useState(13);
  const [shortcut, setShortcut] = useState(DEFAULT_SHORTCUT);
  const [shortcutEnabled, setShortcutEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const settings = loadSettings();
    setOpacity(settings.opacity);
    setFontSize(settings.fontSize ?? 13);
    setShortcut(settings.globalShortcut ?? DEFAULT_SHORTCUT);
    setShortcutEnabled(settings.shortcutEnabled ?? true);
  }, []);

  // Close on ESC key press (but not when recording shortcut)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isRecording) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isRecording]);

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

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-item">
            <label className="settings-label">
              Background Opacity
              <span className="settings-value">{Math.round(opacity * 100)}%</span>
            </label>
            <input
              type="range"
              min={MIN_OPACITY}
              max={MAX_OPACITY}
              step={0.05}
              value={opacity}
              onChange={handleOpacitySliderChange}
              className="settings-slider"
            />
            <div className="settings-hint">
              Adjust the terminal background transparency
            </div>
          </div>

          <div className="settings-item">
            <label className="settings-label">
              Font Size
              <span className="settings-value">{fontSize}px</span>
            </label>
            <input
              type="range"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              value={fontSize}
              onChange={handleFontSizeSliderChange}
              className="settings-slider"
            />
            <div className="settings-hint">
              Adjust the terminal font size ({MIN_FONT_SIZE}-{MAX_FONT_SIZE}px)
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-item">
            <label className="settings-label">
              Global Shortcut
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={shortcutEnabled}
                  onChange={(e) => handleShortcutEnabledChange(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </label>
            <div className="shortcut-recorder">
              <button
                className={`shortcut-button ${isRecording ? "recording" : ""}`}
                onClick={startRecording}
                disabled={!shortcutEnabled}
              >
                {isRecording ? (
                  <span className="recording-text">Press keys...</span>
                ) : (
                  <span className="shortcut-display">
                    {formatShortcutDisplay(shortcut)}
                  </span>
                )}
              </button>
            </div>
            <div className="settings-hint">
              {shortcutEnabled
                ? "Click to change the shortcut. Press ESC to cancel."
                : "Enable to set a global shortcut for quick access"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
