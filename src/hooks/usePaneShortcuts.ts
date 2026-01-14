import { usePaneContext } from "@/contexts/PaneContext";
import { useTabContext } from "@/contexts/TabContext";
import type { SplitDirection } from "@/lib/paneTree";
import { useCallback, useEffect, useRef } from "react";

interface UsePaneShortcutsOptions {
  disabled?: boolean;
}

/**
 * Hook for pane-related keyboard shortcuts:
 * - Cmd+D: Split pane vertically (new pane to the right)
 * - Cmd+Shift+D: Split pane horizontally (new pane below)
 * - Cmd+W: Close active pane (only if more than one pane exists)
 */
export function usePaneShortcuts({ disabled = false }: UsePaneShortcutsOptions = {}) {
  const { activeTabId } = useTabContext();
  const { getActivePaneId, splitPane, closePane, getPaneCount } = usePaneContext();

  // Debouncing ref to prevent concurrent close attempts
  const isClosingRef = useRef(false);
  const debounceTimeoutRef = useRef<number | null>(null);

  const handleSplit = useCallback(
    (direction: SplitDirection) => {
      if (!activeTabId) return;

      const activePaneId = getActivePaneId(activeTabId);
      if (!activePaneId) return;

      splitPane(activeTabId, activePaneId, direction);
    },
    [activeTabId, getActivePaneId, splitPane]
  );

  const handleClosePane = useCallback(() => {
    // Prevent concurrent close attempts
    if (isClosingRef.current) return false;

    if (!activeTabId) return false;

    const paneCount = getPaneCount(activeTabId);
    if (paneCount <= 1) {
      // Only one pane - don't close it (let tab close logic handle it)
      return false;
    }

    const activePaneId = getActivePaneId(activeTabId);
    if (!activePaneId) return false;

    // Set debounce flag
    isClosingRef.current = true;
    const result = closePane(activeTabId, activePaneId);

    // Clear existing timeout if any
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Reset after a short delay
    debounceTimeoutRef.current = window.setTimeout(() => {
      isClosingRef.current = false;
      debounceTimeoutRef.current = null;
    }, 100);

    return result;
  }, [activeTabId, getActivePaneId, getPaneCount, closePane]);

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Cmd/Ctrl + key combinations
      const hasModifier = e.metaKey || e.ctrlKey;
      if (!hasModifier) return;

      const key = e.key.toLowerCase();

      if (key === "d") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          // Cmd+Shift+D or Ctrl+Shift+D: Split horizontally (new pane below)
          handleSplit("horizontal");
        } else {
          // Cmd+D or Ctrl+D: Split vertically (new pane to the right)
          handleSplit("vertical");
        }
      } else if (key === "w" && !e.shiftKey) {
        // Cmd+W or Ctrl+W: Close active pane (only if multiple panes exist)
        if (activeTabId) {
          const paneCount = getPaneCount(activeTabId);
          if (paneCount > 1) {
            // Multiple panes: close the active pane
            e.preventDefault();
            e.stopPropagation();
            handleClosePane();
          }
          // If only one pane, let the event propagate to useTabShortcuts
        }
      }
    };

    // Use capture phase to handle before useTabShortcuts
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      // Clean up debounce timeout and reset flag on unmount/re-render
      if (debounceTimeoutRef.current !== null) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      isClosingRef.current = false;
    };
  }, [disabled, activeTabId, handleSplit, handleClosePane, getPaneCount]);

  return {
    splitVertical: () => handleSplit("vertical"),
    splitHorizontal: () => handleSplit("horizontal"),
    closeActivePane: handleClosePane,
  };
}
