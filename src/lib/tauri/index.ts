/**
 * Tauri IPC API
 *
 * Organized by concern for better maintainability.
 * Re-exports everything to maintain backwards compatibility.
 */

// Preload and utilities
export {
  isTauri,
  getInvoke,
  getListen,
  getEmit,
  ensurePreload,
  checkTauriAvailable,
  invoke,
  listen,
  emit,
} from "./preload";

// PTY operations
export type { PtyOutput, PtyExit } from "./pty";
export { createPtySession, writeToPty, resizePty, closePtySession } from "./pty";

// Command execution
export type { CommandResult, StreamChunk } from "./commands";
export { executeCommand, executeCommandStream, completeCommand } from "./commands";

// Global shortcuts
export {
  registerGlobalShortcut,
  registerGlobalShortcutNoToggle,
  registerLocalShortcut,
  unregisterGlobalShortcut,
  unregisterAllShortcuts,
  isShortcutRegistered,
} from "./shortcuts";

// Shell utilities
export { openUrl } from "./shell";

// Window management
export type { ScreenInfo } from "./window";
export { getScreenInfo, adjustWindowSize, ensureWindowVisible } from "./window";

// Settings management
export type { AppSettings } from "./settings";
export {
  getSettings,
  updateSettings,
  setOpacity,
  setFontSize,
  setPinned,
  getPinned,
  setOnboardingComplete,
} from "./settings";
