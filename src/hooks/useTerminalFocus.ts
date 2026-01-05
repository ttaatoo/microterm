import { useEffect } from "react";
import type { Terminal } from "@xterm/xterm";
import { WINDOW_FOCUS_DELAY_MS, WINDOW_VISIBLE_FOCUS_DELAY_MS } from "@/lib/constants";

interface UseTerminalFocusOptions {
  terminal: Terminal | null;
  isVisible?: boolean;
}

/**
 * Hook for managing terminal focus across different window events
 * Handles browser focus, Tauri window focus, and toggle-window events
 */
export function useTerminalFocus({ terminal, isVisible = true }: UseTerminalFocusOptions): void {
  // Handle browser window focus
  useEffect(() => {
    const handleFocus = () => {
      terminal?.focus();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [terminal]);

  // Listen for Tauri window focus event
  useEffect(() => {
    if (!terminal) return;

    let unlistenFocus: (() => void) | undefined;

    const setupWindowListener = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const currentWindow = getCurrentWindow();

        unlistenFocus = await currentWindow.onFocusChanged(({ payload: focused }) => {
          if (focused && terminal) {
            setTimeout(() => {
              terminal?.focus();
            }, WINDOW_FOCUS_DELAY_MS);
          }
        });
      } catch (error) {
        console.error("Failed to setup window focus listener:", error);
      }
    };

    setupWindowListener();

    return () => {
      unlistenFocus?.();
    };
  }, [terminal]);

  // Listen for toggle-window event (global shortcut)
  useEffect(() => {
    if (!terminal) return;

    let unlistenToggle: (() => void) | undefined;

    const setupToggleListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        unlistenToggle = await listen("toggle-window", () => {
          setTimeout(() => {
            terminal?.focus();
          }, WINDOW_VISIBLE_FOCUS_DELAY_MS);
        });
      } catch (error) {
        console.error("Failed to setup toggle-window listener:", error);
      }
    };

    setupToggleListener();

    return () => {
      unlistenToggle?.();
    };
  }, [terminal]);

  // Focus terminal when becoming visible
  useEffect(() => {
    if (isVisible && terminal) {
      // Use RAF to ensure visibility change has taken effect
      requestAnimationFrame(() => {
        terminal?.focus();
      });
    }
  }, [isVisible, terminal]);
}
