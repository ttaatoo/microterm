// Pin state management utilities
import { loadSettings, saveSettings, type Settings } from "./settings";

/**
 * Sync pin state to Rust backend and notify frontend components.
 * This is the single source of truth for pin state synchronization.
 * Uses synchronous command instead of async event to prevent race conditions.
 */
async function syncPinState(pinned: boolean): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  // Use command for synchronous update
  // This command updates Rust state AND emits "pin-state-updated" to frontend components
  await invoke("set_pinned", { pinned });
}

/**
 * Toggle pin state and sync to Rust and other components.
 * Use this for global shortcuts where hooks cannot be used.
 */
export async function togglePinState(): Promise<void> {
  const settings = loadSettings();
  const oldPinned = settings.pinned ?? false;
  const newPinned = !oldPinned;

  // Save to settings
  const newSettings: Settings = { ...settings, pinned: newPinned };
  saveSettings(newSettings);

  // Sync to Rust and frontend
  try {
    await syncPinState(newPinned);
  } catch (error) {
    console.error("[Pin] Failed to toggle pin state:", error);
    // Revert to original state on failure
    saveSettings({ ...settings, pinned: oldPinned });
  }
}

/**
 * Set pin state to a specific value and sync.
 * Use this for explicit pin/unpin operations (e.g., Cmd+W on last tab).
 */
export async function setPinState(pinned: boolean): Promise<void> {
  const settings = loadSettings();

  // Skip if already in desired state
  if (settings.pinned === pinned) return;

  // Save to settings
  const newSettings: Settings = { ...settings, pinned };
  saveSettings(newSettings);

  // Sync to Rust and frontend
  try {
    await syncPinState(pinned);
  } catch (error) {
    console.error("[Pin] Failed to set pin state:", error);
    // Revert on failure
    saveSettings(settings);
  }
}

