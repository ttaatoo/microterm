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
  const [opacity, setOpacity] = useState<number | undefined>(undefined);
  const [fontSize, setFontSize] = useState<number | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const settingsRef = useRef<Settings | null>(null);
  const currentShortcutRef = useRef<string | null>(null);
  const currentPinShortcutRef = useRef<string | null>(null);

  // Initialize settings on mount
  useEffect(() => {
    const initSettings = async () => {
      const settings = loadSettings();
      settingsRef.current = settings;
      setOpacity(settings.opacity);
      setFontSize(settings.fontSize);

      // Show onboarding for first-time users
      if (!settings.onboardingComplete) {
        setShowOnboarding(true);
      }

      // Restore window size from settings
      if (settings.windowSize) {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const { LogicalSize } = await import("@tauri-apps/api/dpi");
          const currentWindow = getCurrentWindow();
          await currentWindow.setSize(
            new LogicalSize(settings.windowSize.width, settings.windowSize.height)
          );
        } catch (error) {
          console.error("Failed to restore window size:", error);
        }
      }

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

  const handleResize = useCallback((width: number, height: number) => {
    const currentSettings = settingsRef.current ?? loadSettings();
    const newSettings: Settings = {
      ...currentSettings,
      windowSize: { width: Math.round(width), height: Math.round(height) },
    };
    settingsRef.current = newSettings;
    saveSettings(newSettings);
  }, []);

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
    handleResize,
    handleOnboardingComplete,
  };
}
