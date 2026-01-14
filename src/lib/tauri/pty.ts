/**
 * PTY (Pseudo-Terminal) operations via Tauri IPC
 *
 * Handles creation, I/O, resizing, and cleanup of PTY sessions.
 */

import { getInvoke } from "./preload";

export interface PtyOutput {
  session_id: string;
  data: string;
}

export interface PtyExit {
  session_id: string;
  exit_code: number | null;
}

/**
 * Create a new PTY session
 * @param cols - Terminal columns
 * @param rows - Terminal rows
 * @returns Session ID for the created PTY
 */
export async function createPtySession(cols: number, rows: number): Promise<string> {
  const invoke = await getInvoke();
  return invoke<string>("create_pty_session", { cols, rows });
}

/**
 * Write data to a PTY session
 * @param sessionId - PTY session ID
 * @param data - Data to write
 */
export async function writeToPty(sessionId: string, data: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke("write_to_pty", { sessionId, data });
}

/**
 * Resize a PTY session
 * @param sessionId - PTY session ID
 * @param cols - New terminal columns
 * @param rows - New terminal rows
 */
export async function resizePty(sessionId: string, cols: number, rows: number): Promise<void> {
  const invoke = await getInvoke();
  await invoke("resize_pty", { sessionId, cols, rows });
}

/**
 * Close a PTY session
 * @param sessionId - PTY session ID
 */
export async function closePtySession(sessionId: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke("close_pty_session", { sessionId });
}
