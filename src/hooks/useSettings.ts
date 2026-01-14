import { useState, useEffect, useCallback, useRef } from "react";
import {
  loadSettings,
  saveSettings,
  DEFAULT_SHORTCUT,
  DEFAULT_PIN_SHORTCUT,
  type Settings,
} from "@/lib/settings";
import {
  registerGlobalShortcut,
  registerGlobalShortcutNoToggle,
  unregisterGlobalShortcut,
} from "@/lib/tauri";
import { togglePinState } from "@/lib/pin";

interface UseSettingsOptions {
  onShortcutError?: (shortcut: string) => void;
}

export function useSettings(options: UseSettingsOptions = {}) {
  const { onShortcutError } = options;
  // Initialize with values from loadSettings to prevent flash on first render
  const initialSettings = loadSettings();
  const [opacity, setOpacity] = useState<number | undefined>(initialSettings.opacity);
  const [fontSize, setFontSize] = useState<number | undefined>(initialSettings.fontSize);
  const [showOnboarding, setShowOnboarding] = useState(!initialSettings.onboardingComplete);
  const settingsRef = useRef<Settings>(initialSettings);
  const currentShortcutRef = useRef<string | null>(null);
  const currentPinShortcutRef = useRef<string | null>(null);

  // Initialize settings on mount
  useEffect(() => {
    const initSettings = async () => {
      const settings = loadSettings();
      settingsRef.current = settings;
      // Note: opacity and fontSize already initialized in useState
      // Only update if values changed (shouldn't happen in practice)

      // Note: Settings migration from localStorage to Rust backend happens
      // automatically on app startup via migrateSettingsIfNeeded()
      // After migration, localStorage settings are preserved for backward compatibility

      // Note: onboarding state already initialized in useState
      // Note: Window size is now managed by Rust backend per-screen (screen_config.rs)
      // No need to restore here - it's handled automatically when window is shown

      // Register global shortcut if enabled
      if (settings.shortcutEnabled !== false && settings.globalShortcut) {
        try {
          await registerGlobalShortcut(settings.globalShortcut, () => {
            // Callback when shortcut is triggered (window toggle is handled by Rust)
          });
          currentShortcutRef.current = settings.globalShortcut;
        } catch (error) {
          console.error("Failed to register global shortcut:", error);
          onShortcutError?.(settings.globalShortcut);
        }
      }

      // Register pin shortcut (without toggling window)
      const pinShortcut = settings.pinShortcut ?? DEFAULT_PIN_SHORTCUT;
      try {
        await registerGlobalShortcutNoToggle(pinShortcut, async () => {
          await togglePinState();
        });
        currentPinShortcutRef.current = pinShortcut;
      } catch (error) {
        console.error("Failed to register pin shortcut:", error);
      }
    };
    initSettings();

    // Cleanup on unmount
    return () => {
      if (currentShortcutRef.current) {
        unregisterGlobalShortcut(currentShortcutRef.current).catch(console.error);
      }
      if (currentPinShortcutRef.current) {
        unregisterGlobalShortcut(currentPinShortcutRef.current).catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSettingsChange = useCallback(async (settings: Settings) => {
    settingsRef.current = settings;
    setOpacity(settings.opacity);
    setFontSize(settings.fontSize);

    // Handle global shortcut changes
    const newShortcut = settings.globalShortcut ?? DEFAULT_SHORTCUT;
    const shortcutEnabled = settings.shortcutEnabled !== false;

    // Unregister old shortcut if it changed or was disabled
    if (currentShortcutRef.current &&
        (currentShortcutRef.current !== newShortcut || !shortcutEnabled)) {
      try {
        await unregisterGlobalShortcut(currentShortcutRef.current);
        currentShortcutRef.current = null;
      } catch (error) {
        console.error("Failed to unregister shortcut:", error);
      }
    }

    // Register new shortcut if enabled and not already registered
    if (shortcutEnabled && currentShortcutRef.current !== newShortcut) {
      try {
        await registerGlobalShortcut(newShortcut, () => {
          // Callback when shortcut is triggered
        });
        currentShortcutRef.current = newShortcut;
      } catch (error) {
        console.error("Failed to register shortcut:", error);
        onShortcutError?.(newShortcut);
      }
    }

    // Handle pin shortcut changes
    const newPinShortcut = settings.pinShortcut ?? DEFAULT_PIN_SHORTCUT;
    if (currentPinShortcutRef.current && currentPinShortcutRef.current !== newPinShortcut) {
      try {
        await unregisterGlobalShortcut(currentPinShortcutRef.current);
        currentPinShortcutRef.current = null;
      } catch (error) {
        console.error("Failed to unregister pin shortcut:", error);
      }
    }

    if (currentPinShortcutRef.current !== newPinShortcut) {
      try {
        await registerGlobalShortcutNoToggle(newPinShortcut, async () => {
          await togglePinState();
        });
        currentPinShortcutRef.current = newPinShortcut;
      } catch (error) {
        console.error("Failed to register pin shortcut:", error);
      }
    }
  }, [onShortcutError]);

  // Note: Window size is now managed by Rust backend (screen_config.rs)
  // handleResize removed - size is saved automatically by backend per screen

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    const currentSettings = settingsRef.current ?? loadSettings();
    const newSettings: Settings = {
      ...currentSettings,
      onboardingComplete: true,
    };
    settingsRef.current = newSettings;
    saveSettings(newSettings);
  }, []);

  return {
    opacity,
    fontSize,
    showOnboarding,
    handleSettingsChange,
    handleOnboardingComplete,
  };
}
