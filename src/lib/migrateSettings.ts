/**
 * Migrate settings from localStorage to Rust backend
 * This is a one-time migration that runs on app startup
 */

import { loadSettings as loadLocalStorageSettings } from "./settings";
import { getSettings, updateSettings, type AppSettings } from "./tauri";

const MIGRATION_KEY = "microterm-settings-migrated";

/**
 * Check if settings have already been migrated
 */
function isMigrated(): boolean {
  return localStorage.getItem(MIGRATION_KEY) === "true";
}

/**
 * Mark settings as migrated
 */
function markMigrated(): void {
  localStorage.setItem(MIGRATION_KEY, "true");
}

/**
 * Migrate settings from localStorage to Rust backend
 * Only runs once on first app launch after update
 */
export async function migrateSettingsIfNeeded(): Promise<void> {
  // Skip if already migrated
  if (isMigrated()) {
    console.log("[Migration] Settings already migrated");
    return;
  }

  console.log("[Migration] Starting settings migration from localStorage to Rust...");

  try {
    // Check if Rust backend has settings
    const rustSettings = await getSettings();

    // If Rust settings exist and are not default, skip migration
    // (user may have already configured settings in Rust)
    if (rustSettings && rustSettings.onboardingComplete) {
      console.log("[Migration] Rust settings already configured, skipping migration");
      markMigrated();
      return;
    }

    // Load settings from localStorage
    const localSettings = loadLocalStorageSettings();

    // Convert to Rust format
    // Note: windowSize removed - now managed per-screen by screen_config.rs
    const migratedSettings: AppSettings = {
      opacity: localSettings.opacity,
      fontSize: localSettings.fontSize ?? 13,
      globalShortcut: localSettings.globalShortcut ?? "CommandOrControl+Shift+T",
      shortcutEnabled: localSettings.shortcutEnabled !== false,
      pinShortcut: localSettings.pinShortcut ?? "CommandOrControl+Backquote",
      onboardingComplete: localSettings.onboardingComplete ?? false,
      pinned: localSettings.pinned ?? false,
    };

    // Save to Rust backend
    const success = await updateSettings(migratedSettings);

    if (success) {
      console.log("[Migration] Successfully migrated settings to Rust backend");
      markMigrated();
    } else {
      console.error("[Migration] Failed to migrate settings");
    }
  } catch (error) {
    console.error("[Migration] Error during settings migration:", error);
    // Don't mark as migrated on error, will retry next time
  }
}
