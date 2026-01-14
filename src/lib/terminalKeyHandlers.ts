/**
 * Terminal keyboard event handlers
 */

import type { InvokeArgs } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";

/**
 * Moves cursor backward by one word (Option+Left implementation)
 */
async function moveBackwardWord(
  terminal: Terminal,
  sessionId: string,
  invoke: <T>(cmd: string, args?: InvokeArgs) => Promise<T>
): Promise<void> {
  const buffer = terminal.buffer.active;
  const cursorX = buffer.cursorX;
  const cursorY = buffer.cursorY;
  const line = buffer.getLine(cursorY);

  if (!line) return;

  const lineText = line.translateToString(false);
  let targetX = cursorX;

  // If in whitespace, skip to end of previous word
  // If in a word, move to beginning of current word
  if (cursorX > 0 && /\s/.test(lineText[cursorX - 1])) {
    // Skip backward over whitespace
    while (targetX > 0 && /\s/.test(lineText[targetX - 1])) {
      targetX--;
    }
  } else {
    // Skip backward through current word
    while (targetX > 0 && /\S/.test(lineText[targetX - 1])) {
      targetX--;
    }
  }

  const moveCount = cursorX - targetX;
  if (moveCount > 0) {
    const leftArrow = "\x1b[D";
    await invoke("write_to_pty", {
      sessionId,
      data: leftArrow.repeat(moveCount),
    });
  }
}

/**
 * Moves cursor forward by one word (Option+Right implementation)
 */
async function moveForwardWord(
  terminal: Terminal,
  sessionId: string,
  invoke: <T>(cmd: string, args?: InvokeArgs) => Promise<T>
): Promise<void> {
  const buffer = terminal.buffer.active;
  const cursorX = buffer.cursorX;
  const cursorY = buffer.cursorY;
  const line = buffer.getLine(cursorY);

  if (!line) return;

  const lineText = line.translateToString(false);
  let targetX = cursorX;

  // Skip to end of current word
  while (targetX < lineText.length && /\S/.test(lineText[targetX])) {
    targetX++;
  }

  // Skip whitespace to beginning of next word
  while (targetX < lineText.length && /\s/.test(lineText[targetX])) {
    targetX++;
  }

  const moveCount = targetX - cursorX;
  if (moveCount > 0) {
    const rightArrow = "\x1b[C";
    await invoke("write_to_pty", {
      sessionId,
      data: rightArrow.repeat(moveCount),
    });
  }
}

/**
 * Creates a custom key event handler for Option+Arrow word movement
 * Implements macOS-style word movement instead of readline's default behavior
 */
export function createWordMovementHandler(
  terminal: Terminal,
  getSessionId: () => string | null,
  invoke: <T>(cmd: string, args?: InvokeArgs) => Promise<T>
) {
  return (event: KeyboardEvent): boolean => {
    const sessionId = getSessionId();
    if (!sessionId) return true;

    // Allow Ctrl+Tab and Ctrl+Shift+Tab to pass through for tab navigation
    // These are handled by Tauri global shortcuts
    if (event.ctrlKey && event.key === "Tab") {
      return true;
    }

    // Allow Cmd/Ctrl+[, Cmd/Ctrl+] for tab navigation
    if ((event.metaKey || event.ctrlKey) && (event.key === "[" || event.key === "]")) {
      return true;
    }

    // Allow Cmd/Ctrl+1-9 for direct tab switching
    if ((event.metaKey || event.ctrlKey) && event.key >= "1" && event.key <= "9") {
      return true;
    }

    // Allow Cmd/Ctrl+W for pane/tab closing
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") {
      return true;
    }

    // Allow Cmd/Ctrl+D and Cmd/Ctrl+Shift+D for pane splitting
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
      return true;
    }

    // Option+Left: move backward by word
    if (
      event.altKey &&
      event.key === "ArrowLeft" &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      // Only handle keydown events to avoid duplicate movements
      if (event.type !== "keydown") {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      moveBackwardWord(terminal, sessionId, invoke).catch(console.error);
      return false;
    }

    // Option+Right: move forward by word
    if (
      event.altKey &&
      event.key === "ArrowRight" &&
      !event.shiftKey &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      // Only handle keydown events to avoid duplicate movements
      if (event.type !== "keydown") {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      moveForwardWord(terminal, sessionId, invoke).catch(console.error);
      return false;
    }

    return true; // Allow default behavior for other keys
  };
}
