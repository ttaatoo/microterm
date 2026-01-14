/**
 * Shell utilities for opening external resources
 */

import { isTauri } from "./preload";

/**
 * Open URL in system default browser
 * @param url - URL to open
 */
export async function openUrl(url: string): Promise<void> {
  if (!isTauri()) {
    // Fallback for browser environment
    window.open(url, "_blank");
    return;
  }

  const { open } = await import("@tauri-apps/plugin-shell");
  await open(url);
}
