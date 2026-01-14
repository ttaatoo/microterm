import { useEffect } from "react";
import { Terminal } from "@xterm/xterm";
import { PtyManager } from "@/lib/ptyManager";
import { createWordMovementHandler } from "@/lib/terminalKeyHandlers";

export interface UseTerminalKeyboardOptions {
  terminal: Terminal | null;
  ptyManager: PtyManager | null;
}

/**
 * Hook for setting up terminal keyboard handlers
 * Currently handles word movement shortcuts (Option+Arrow keys on macOS)
 */
export function useTerminalKeyboard({ terminal, ptyManager }: UseTerminalKeyboardOptions) {
  useEffect(() => {
    if (!terminal || !ptyManager) return;

    const setupHandler = async () => {
      const { invoke } = await import("@tauri-apps/api/core");

      const wordMovementHandler = createWordMovementHandler(
        terminal,
        () => ptyManager.getSessionId(),
        invoke
      );

      terminal.attachCustomKeyEventHandler(wordMovementHandler);
    };

    setupHandler();
  }, [terminal, ptyManager]);
}
