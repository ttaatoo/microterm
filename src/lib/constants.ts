/**
 * Application-wide timing constants
 *
 * Centralizes all timing-related values for consistency and easy tuning.
 */

// ============== PTY Session Timing ==============

/** Delay before restarting PTY session after process exit (ms) */
export const PTY_RESTART_DELAY_MS = 1000;

/** Maximum retry attempts for PTY session creation */
export const MAX_PTY_RETRIES = 3;

/** Delay between PTY retry attempts (ms) - multiplied by retry count */
export const PTY_RETRY_DELAY_MS = 500;

// ============== Window Focus Timing ==============

/** Delay before focusing terminal after window focus - allows window to fully render (ms) */
export const WINDOW_FOCUS_DELAY_MS = 50;

/** Delay before focusing terminal after window becomes visible (ms) */
export const WINDOW_VISIBLE_FOCUS_DELAY_MS = 100;

// ============== User Interaction Timing ==============

/** Maximum interval between double-ESC presses to trigger hide window (ms) */
export const DOUBLE_ESC_INTERVAL_MS = 300;

// ============== Polling Intervals ==============

/** Interval for polling current working directory (ms) */
export const CWD_POLL_INTERVAL_MS = 1000;

// ============== Key Codes ==============

/** ESC key escape sequence */
export const ESC_KEY = "\x1b";

// ============== Pane Split Constants ==============

/** Minimum pane size as ratio (0.0-1.0) */
export const MIN_PANE_RATIO = 0.1;

/** Maximum pane size as ratio (0.0-1.0) */
export const MAX_PANE_RATIO = 0.9;

/** Default split ratio (50/50) */
export const DEFAULT_SPLIT_RATIO = 0.5;

/** Divider width in pixels */
export const SPLIT_DIVIDER_SIZE = 2;
