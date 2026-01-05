import { useRef, useCallback } from "react";
import { DOUBLE_ESC_INTERVAL_MS, ESC_KEY } from "@/lib/constants";

interface UseDoubleEscOptions {
  /** Whether double-ESC should be disabled (e.g., when pinned) */
  disabled?: boolean;
  /** Callback when double-ESC is detected */
  onDoubleEsc: () => void;
}

interface UseDoubleEscReturn {
  /**
   * Check if the input is a double-ESC sequence
   * @param data - The input data (single character or escape sequence)
   * @returns true if double-ESC was detected and handled, false if single ESC should pass through
   */
  checkDoubleEsc: (data: string) => boolean;
}

/**
 * Hook for detecting double-ESC key presses
 * Used to hide the terminal window (like vim's double-ESC to exit insert mode)
 */
export function useDoubleEsc({ disabled = false, onDoubleEsc }: UseDoubleEscOptions): UseDoubleEscReturn {
  const lastEscTimeRef = useRef<number>(0);

  const checkDoubleEsc = useCallback(
    (data: string): boolean => {
      if (data !== ESC_KEY) {
        return false;
      }

      const now = Date.now();
      const timeSinceLastEsc = now - lastEscTimeRef.current;
      lastEscTimeRef.current = now;

      if (timeSinceLastEsc < DOUBLE_ESC_INTERVAL_MS) {
        // Double ESC detected
        if (!disabled) {
          onDoubleEsc();
        }
        // Reset to prevent triple-ESC from triggering again
        lastEscTimeRef.current = 0;
        return true;
      }

      // Single ESC - let it pass through
      return false;
    },
    [disabled, onDoubleEsc]
  );

  return { checkDoubleEsc };
}
