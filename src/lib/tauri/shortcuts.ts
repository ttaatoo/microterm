/**
 * Global shortcut registration via Tauri
 *
 * Handles registration and management of system-wide keyboard shortcuts.
 */

import { getEmit, isTauri } from "./preload";

/**
 * Register a global shortcut with window toggle
 * @param shortcut - Shortcut string (e.g., "CommandOrControl+F4")
 * @param onTrigger - Callback when shortcut is triggered
 * @returns Unregister function
 */
export async function registerGlobalShortcut(
  shortcut: string,
  onTrigger: () => void
): Promise<() => Promise<void>> {
  if (!isTauri()) {
    console.warn("Global shortcuts only work in Tauri environment");
    return async () => {};
  }

  const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");
  const emit = await getEmit();

  await register(shortcut, async (event) => {
    if (event.state === "Pressed") {
      // Emit event to Rust backend to toggle window
      await emit("toggle-window", {});
      onTrigger();
    }
  });

  // Return unregister function
  return async () => {
    await unregister(shortcut);
  };
}

/**
 * Register a global shortcut without window toggle
 * @param shortcut - Shortcut string
 * @param onTrigger - Callback when shortcut is triggered
 * @returns Unregister function
 */
export async function registerGlobalShortcutNoToggle(
  shortcut: string,
  onTrigger: () => void | Promise<void>
): Promise<() => Promise<void>> {
  if (!isTauri()) {
    console.warn("Global shortcuts only work in Tauri environment");
    return async () => {};
  }

  const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");

  await register(shortcut, async (event) => {
    if (event.state === "Pressed") {
      await onTrigger();
    }
  });

  // Return unregister function
  return async () => {
    await unregister(shortcut);
  };
}

/**
 * Unregister a specific global shortcut
 * @param shortcut - Shortcut string to unregister
 */
export async function unregisterGlobalShortcut(shortcut: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const { unregister } = await import("@tauri-apps/plugin-global-shortcut");
  await unregister(shortcut);
}

/**
 * Unregister all global shortcuts
 */
export async function unregisterAllShortcuts(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const { unregisterAll } = await import("@tauri-apps/plugin-global-shortcut");
  await unregisterAll();
}

/**
 * Check if a shortcut is registered
 * @param shortcut - Shortcut string to check
 * @returns True if registered
 */
export async function isShortcutRegistered(shortcut: string): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }

  const { isRegistered } = await import("@tauri-apps/plugin-global-shortcut");
  return isRegistered(shortcut);
}

/**
 * Register a local shortcut that only works when app window is focused
 * @param shortcut - Shortcut string
 * @param onTrigger - Callback when shortcut is triggered
 * @returns Unregister function
 */
export async function registerLocalShortcut(
  shortcut: string,
  onTrigger: () => void
): Promise<() => Promise<void>> {
  if (!isTauri()) {
    console.warn("Local shortcuts only work in Tauri environment");
    return async () => {};
  }

  const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");

  await register(shortcut, async (event) => {
    if (event.state === "Pressed") {
      onTrigger();
    }
  });

  return async () => {
    await unregister(shortcut);
  };
}
