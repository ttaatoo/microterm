import { useEffect, useCallback } from "react";
import { loadSettings, saveSettings, clampFontSize, type Settings } from "@/lib/settings";

interface UseFontSizeShortcutsOptions {
  disabled?: boolean;
  onSettingsChange: (settings: Settings) => void;
}

/**
 * Hook to handle font size keyboard shortcuts
 * Cmd+/Cmd= increases font size, Cmd- decreases font size
 */
export function useFontSizeShortcuts({ disabled, onSettingsChange }: UseFontSizeShortcutsOptions) {
  const handleFontSizeChange = useCallback(
    (delta: number) => {
      const settings = loadSettings();
      const currentSize = settings.fontSize ?? 13;
      const newSize = clampFontSize(currentSize + delta);

      // Only update if size actually changed
      if (newSize !== currentSize) {
        const newSettings: Settings = {
          ...settings,
          fontSize: newSize,
        };
        saveSettings(newSettings);
        onSettingsChange(newSettings);
      }
    },
    [onSettingsChange]
  );

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (macOS) or Ctrl (other platforms)
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (!isCmdOrCtrl) return;

      // Cmd+/Cmd= increases font size
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        handleFontSizeChange(1);
      }
      // Cmd- decreases font size
      else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleFontSizeChange(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, handleFontSizeChange]);
}
