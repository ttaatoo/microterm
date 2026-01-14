import { useEffect, useRef, useCallback } from "react";
import { useTabContext } from "@/contexts/TabContext";
import { usePaneContext } from "@/contexts/PaneContext";
import { loadSettings } from "@/lib/settings";
import { togglePinState, setPinState } from "@/lib/pin";

export function useTabShortcuts(disabled = false) {
  const { tabs, activeTabId, createTab, closeTab, setActiveTab } =
    useTabContext();
  const { getPaneCount } = usePaneContext();
  // Compute locally instead of from context to reduce re-renders
  const canCloseTab = tabs.length > 1;

  // Store refs for the current tab state to use in global shortcuts
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);

  // Keep refs updated
  useEffect(() => {
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
  }, [tabs, activeTabId]);

  // Navigate tabs function using refs (for global shortcuts)
  const navigateTabsGlobal = useCallback((direction: number) => {
    const currentTabs = tabsRef.current;
    const currentActiveId = activeTabIdRef.current;
    const currentIndex = currentTabs.findIndex((t) => t.id === currentActiveId);
    if (currentIndex === -1) return;

    let newIndex = currentIndex + direction;
    // Wrap around
    if (newIndex < 0) newIndex = currentTabs.length - 1;
    if (newIndex >= currentTabs.length) newIndex = 0;

    setActiveTab(currentTabs[newIndex].id);
  }, [setActiveTab]);

  // Register Ctrl+Tab and Ctrl+Shift+Tab as global shortcuts
  // These keys are intercepted by webview before reaching DOM, so we use Tauri global shortcuts
  // We only register them when the window is focused to avoid interfering with other apps
  useEffect(() => {
    if (disabled) return;

    let unregisterCtrlTab: (() => Promise<void>) | null = null;
    let unregisterCtrlShiftTab: (() => Promise<void>) | null = null;
    let isRegistered = false;
    let isMounted = true;

    const registerShortcuts = async () => {
      if (isRegistered || !isMounted) return;
      try {
        const { registerLocalShortcut } = await import("@/lib/tauri");

        // Check if still mounted after async import
        if (!isMounted) return;

        // Register Ctrl+Tab for next tab
        unregisterCtrlTab = await registerLocalShortcut("Ctrl+Tab", () => {
          navigateTabsGlobal(1);
        });

        // Register Ctrl+Shift+Tab for previous tab
        unregisterCtrlShiftTab = await registerLocalShortcut("Ctrl+Shift+Tab", () => {
          navigateTabsGlobal(-1);
        });

        isRegistered = true;
      } catch (error) {
        console.error("[Shortcuts] Failed to register Ctrl+Tab shortcuts:", error);
      }
    };

    const unregisterShortcuts = async () => {
      if (!isRegistered) return;
      try {
        await unregisterCtrlTab?.();
        await unregisterCtrlShiftTab?.();
        unregisterCtrlTab = null;
        unregisterCtrlShiftTab = null;
        isRegistered = false;
      } catch (error) {
        console.error("[Shortcuts] Failed to unregister Ctrl+Tab shortcuts:", error);
      }
    };

    const handleFocus = () => {
      registerShortcuts();
    };

    const handleBlur = () => {
      unregisterShortcuts();
    };

    // Register shortcuts if window is already focused
    if (document.hasFocus()) {
      registerShortcuts();
    }

    // Listen for window focus/blur events
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      // Await cleanup to prevent listener accumulation
      unregisterShortcuts();
    };
  }, [disabled, navigateTabsGlobal]);

  useEffect(() => {
    if (disabled) return;

    const navigateTabs = (direction: number) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      if (currentIndex === -1) return;

      let newIndex = currentIndex + direction;
      // Wrap around
      if (newIndex < 0) newIndex = tabs.length - 1;
      if (newIndex >= tabs.length) newIndex = 0;

      setActiveTab(tabs[newIndex].id);
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Note: Ctrl+Tab and Ctrl+Shift+Tab are handled via Tauri global shortcuts
      // because webview intercepts them before they reach DOM

      // Only handle Cmd/Ctrl + key combinations
      if (!e.metaKey && !e.ctrlKey) return;

      switch (e.key.toLowerCase()) {
        case "t":
          // Cmd+T: New tab
          e.preventDefault();
          createTab();
          break;

        case "f4":
          // Cmd+F4: Toggle pin state (fallback, global shortcut is preferred)
          e.preventDefault();
          await togglePinState();
          break;

        case "w":
          // Cmd+W: Close pane if multiple panes exist, otherwise close tab
          // Check if current tab has multiple panes
          const paneCount = activeTabId ? getPaneCount(activeTabId) : 0;
          if (paneCount > 1) {
            // Multiple panes: let pane shortcuts handle it (don't prevent default here)
            // The pane shortcut handler will prevent default
            return; // Don't handle, let usePaneShortcuts handle it
          }
          // Single pane: close tab or handle pin state
          e.preventDefault();
          if (canCloseTab) {
            // Multiple tabs: close tab, pin state remains unchanged
            closeTab(activeTabId);
          } else {
            // Last tab: if pinned, unpin; otherwise hide window (M3 fix - extracted logic)
            const currentSettings = loadSettings();
            if (currentSettings.pinned) {
              await setPinState(false);
            } else {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke("hide_window");
              } catch (error) {
                console.error("[Window] Failed to hide window:", error);
              }
            }
          }
          break;

        case "[":
          // Cmd+[: Previous tab
          e.preventDefault();
          navigateTabs(-1);
          break;

        case "]":
          // Cmd+]: Next tab
          e.preventDefault();
          navigateTabs(1);
          break;

        default:
          // Cmd+1 through Cmd+9: Switch to specific tab
          if (e.key >= "1" && e.key <= "9") {
            const index = parseInt(e.key) - 1;
            if (index < tabs.length) {
              e.preventDefault();
              setActiveTab(tabs[index].id);
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Note: canCloseTab is derived from tabs.length, so it's implicitly covered by 'tabs' dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    disabled,
    tabs,
    activeTabId,
    createTab,
    closeTab,
    setActiveTab,
    getPaneCount,
  ]);
}
