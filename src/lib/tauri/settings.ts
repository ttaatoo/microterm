/**
 * Settings management commands (Rust-backed)
 */

import { checkTauriAvailable, invoke } from "./preload";

// Note: WindowSize removed - window sizing now managed per-screen by Rust backend (screen_config.rs)

export interface AppSettings {
  opacity: number;
  fontSize: number;
  globalShortcut: string;
  shortcutEnabled: boolean;
  pinShortcut: string;
  onboardingComplete: boolean;
  pinned: boolean;
}

/**
 * Get current settings from Rust backend
 */
export async function getSettings(): Promise<AppSettings | null> {
  if (!checkTauriAvailable()) return null;

  try {
    return await invoke<AppSettings>("get_settings");
  } catch (error) {
    console.error("Failed to get settings:", error);
    return null;
  }
}

/**
 * Update all settings in Rust backend
 */
export async function updateSettings(settings: AppSettings): Promise<boolean> {
  if (!checkTauriAvailable()) return false;

  try {
    await invoke("update_settings", { settings });
    return true;
  } catch (error) {
    console.error("Failed to update settings:", error);
    return false;
  }
}

/**
 * Set opacity setting
 */
export async function setOpacity(opacity: number): Promise<boolean> {
  if (!checkTauriAvailable()) return false;

  try {
    await invoke("set_opacity", { opacity });
    return true;
  } catch (error) {
    console.error("Failed to set opacity:", error);
    return false;
  }
}

/**
 * Set font size setting
 */
export async function setFontSize(fontSize: number): Promise<boolean> {
  if (!checkTauriAvailable()) return false;

  try {
    await invoke("set_font_size", { fontSize });
    return true;
  } catch (error) {
    console.error("Failed to set font size:", error);
    return false;
  }
}

/**
 * Set pinned state
 */
export async function setPinned(pinned: boolean): Promise<boolean> {
  if (!checkTauriAvailable()) return false;

  try {
    await invoke("set_pinned", { pinned });
    return true;
  } catch (error) {
    console.error("Failed to set pinned:", error);
    return false;
  }
}

/**
 * Get pinned state
 */
export async function getPinned(): Promise<boolean> {
  if (!checkTauriAvailable()) return false;

  try {
    return await invoke<boolean>("get_pinned");
  } catch (error) {
    console.error("Failed to get pinned:", error);
    return false;
  }
}

/**
 * Set onboarding complete
 */
export async function setOnboardingComplete(complete: boolean): Promise<boolean> {
  if (!checkTauriAvailable()) return false;

  try {
    await invoke("set_onboarding_complete", { complete });
    return true;
  } catch (error) {
    console.error("Failed to set onboarding complete:", error);
    return false;
  }
}
