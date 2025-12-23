"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTabContext } from "@/contexts/TabContext";

export function useTabShortcuts(disabled = false) {
  const { tabs, activeTabId, createTab, closeTab, setActiveTab, canCloseTab } =
    useTabContext();

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

    const registerShortcuts = async () => {
      if (isRegistered) return;
      try {
        const { registerLocalShortcut } = await import("@/lib/tauri");

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
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
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

        case "w":
          // Cmd+W: Close current tab, or hide window if last tab
          e.preventDefault();
          if (canCloseTab) {
            closeTab(activeTabId);
          } else {
            // Last tab - hide window instead
            try {
              const { invoke } = await import("@tauri-apps/api/core");
              await invoke("hide_window");
            } catch (error) {
              console.error("[Window] Failed to hide window:", error);
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
  }, [
    disabled,
    tabs,
    activeTabId,
    createTab,
    closeTab,
    setActiveTab,
    canCloseTab,
  ]);
}
