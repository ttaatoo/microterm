import { useEffect, useRef } from "react";
import { CWD_POLL_INTERVAL_MS } from "@/lib/constants";

/**
 * Extract directory name from full path
 * Returns the last component of the path (directory name)
 * Optimized to avoid array allocation
 */
function extractDirName(path: string): string {
  if (!path || path === "/") return "/";
  // Remove trailing slash if present
  const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;
  const lastSlash = cleanPath.lastIndexOf("/");
  return lastSlash === -1 ? cleanPath : cleanPath.slice(lastSlash + 1) || "/";
}

interface UseCwdPollingOptions {
  sessionId: string | null;
  isVisible: boolean;
  onTitleChange?: (title: string) => void;
}

/**
 * Hook for polling the current working directory of a PTY session
 * Updates the tab title when the CWD changes
 */
export function useCwdPolling({
  sessionId,
  isVisible,
  onTitleChange,
}: UseCwdPollingOptions): void {
  // Keep callback ref stable to avoid race conditions with stale callbacks
  const onTitleChangeRef = useRef(onTitleChange);

  useEffect(() => {
    onTitleChangeRef.current = onTitleChange;
  }, [onTitleChange]);

  useEffect(() => {
    // Skip polling entirely if not visible, no session, or no callback
    // This prevents unnecessary IPC calls when terminal is hidden
    if (!isVisible || !sessionId || !onTitleChange) return;

    let lastCwd = "";
    let isCancelled = false;

    const pollCwd = async () => {
      if (isCancelled) return;

      try {
        const { invoke } = await import("@tauri-apps/api/core");

        // Check again after async import
        if (isCancelled) return;

        const cwd = await invoke<string | null>("get_pty_cwd", {
          sessionId,
        });

        // Check again after async invoke
        if (isCancelled) return;

        if (cwd && cwd !== lastCwd) {
          lastCwd = cwd;
          const dirName = extractDirName(cwd);
          // Use ref to get latest callback and avoid calling stale references
          onTitleChangeRef.current?.(dirName);
        }
      } catch {
        // Session may have been closed, ignore errors
      }
    };

    // Poll immediately and then on interval
    pollCwd();
    const intervalId = setInterval(pollCwd, CWD_POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [sessionId, isVisible, onTitleChange]);
}
