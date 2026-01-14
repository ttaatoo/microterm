/**
 * Window management commands for screen size adaptation
 */

import { checkTauriAvailable, invoke } from "./preload";

export interface ScreenInfo {
  width: number;
  height: number;
  scale_factor: number;
  available_width: number;
  available_height: number;
}

/**
 * Get screen information for the current monitor
 */
export async function getScreenInfo(): Promise<ScreenInfo | null> {
  if (!checkTauriAvailable()) return null;

  try {
    const info = await invoke<ScreenInfo>("get_screen_info");
    return info;
  } catch (error) {
    console.error("Failed to get screen info:", error);
    return null;
  }
}

/**
 * Adjust window size to fit within screen bounds
 * @param maxWidth - Maximum desired width in logical pixels
 * @param maxHeight - Maximum desired height in logical pixels
 * @returns The actual window size that was set [width, height] in physical pixels
 */
export async function adjustWindowSize(
  maxWidth: number,
  maxHeight: number
): Promise<[number, number] | null> {
  if (!checkTauriAvailable()) return null;

  try {
    const result = await invoke<[number, number]>("adjust_window_size", {
      maxWidth,
      maxHeight,
    });
    return result;
  } catch (error) {
    console.error("Failed to adjust window size:", error);
    return null;
  }
}

/**
 * Ensure window is positioned within visible screen bounds
 */
export async function ensureWindowVisible(): Promise<boolean> {
  if (!checkTauriAvailable()) return false;

  try {
    await invoke("ensure_window_visible");
    return true;
  } catch (error) {
    console.error("Failed to ensure window visible:", error);
    return false;
  }
}
