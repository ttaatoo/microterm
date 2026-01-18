import GridPaneContainer from "@/components/GridPaneContainer";
import { GearIcon } from "@/components/icons";
import Onboarding from "@/components/Onboarding";
import SearchBar from "@/components/SearchBar";
import SettingsPanel from "@/components/SettingsPanel";
import TabBar from "@/components/TabBar";
import { ToastContainer } from "@/components/Toast";
import { type XTerminalHandle } from "@/components/XTerminal";
import { PaneProvider, usePaneContext } from "@/contexts/PaneContext";
import { useTabContext } from "@/contexts/TabContext";
import {
  useFontSizeShortcuts,
  usePaneShortcuts,
  useSettings,
  useTabShortcuts,
  useTerminalSearch,
  useToast,
} from "@/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as styles from "./styles.css";

function TerminalViewInner() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Map<tabId, Map<paneId, XTerminalHandle>>
  const terminalRefs = useRef<Map<string, Map<string, XTerminalHandle>>>(new Map());
  const { tabs, activeTabId, updateTabTitle } = useTabContext();
  const {
    getPaneGrid,
    getActivePaneId,
    getAllPanes,
    initializeTabPanes,
    cleanupTabPanes,
    setActivePane,
    updatePaneSessionId,
  } = usePaneContext();

  // Toast notifications
  const { toasts, addToast, removeToast } = useToast();

  // Settings management
  const { opacity, fontSize, showOnboarding, handleSettingsChange, handleOnboardingComplete } =
    useSettings({
      onShortcutError: (shortcut) => {
        addToast(`Shortcut "${shortcut}" may be in use by another app`, "warning");
      },
    });
  // NOTE: handleResize removed - window resize now handled automatically by Rust backend

  // Initialize pane state for each tab
  useEffect(() => {
    for (const tab of tabs) {
      const paneGrid = getPaneGrid(tab.id);
      if (!paneGrid) {
        initializeTabPanes(tab.id);
      }
    }
  }, [tabs, getPaneGrid, initializeTabPanes]);

  // Clean up pane state when tabs are closed
  const prevTabIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentTabIds = new Set(tabs.map((t) => t.id));
    for (const tabId of prevTabIds.current) {
      if (!currentTabIds.has(tabId)) {
        cleanupTabPanes(tabId);
        terminalRefs.current.delete(tabId);
      }
    }
    prevTabIds.current = currentTabIds;
  }, [tabs, cleanupTabPanes]);

  // Track pane removals and close their PTY sessions
  const prevPaneSessionsRef = useRef<Map<string, Map<string, string | null>>>(new Map());
  useEffect(() => {
    const closePtySession = async (sessionId: string) => {
      try {
        const { getInvoke } = await import("@/lib/tauri");
        const invoke = await getInvoke();
        await invoke("close_pty_session", { sessionId });
      } catch (error) {
        console.error("[TerminalView] Failed to close PTY session:", error);
      }
    };

    const disposeTerminalInstance = async (paneId: string) => {
      try {
        const { disposeCachedTerminal } = await import("@/hooks/useTerminalInstance");
        disposeCachedTerminal(paneId);
      } catch (error) {
        console.error("[TerminalView] Failed to dispose terminal instance:", error);
      }
    };

    // Build current pane sessions map
    const currentPaneSessions = new Map<string, Map<string, string | null>>();
    for (const tab of tabs) {
      const paneGrid = getPaneGrid(tab.id);
      if (paneGrid) {
        const panes = getAllPanes(tab.id);
        const paneMap = new Map<string, string | null>();
        for (const pane of panes) {
          if (pane.sessionId) {
            paneMap.set(pane.id, pane.sessionId);
          }
        }
        currentPaneSessions.set(tab.id, paneMap);
      }
    }

    // Check for removed panes and close their sessions
    // Skip cleanup on first render when prevPaneSessionsRef is empty
    if (prevPaneSessionsRef.current.size === 0) {
      prevPaneSessionsRef.current = currentPaneSessions;
      return;
    }

    for (const [tabId, prevPanes] of prevPaneSessionsRef.current.entries()) {
      const currentPanes = currentPaneSessions.get(tabId);
      if (!currentPanes) {
        // Tab was removed, close all its pane sessions and dispose terminals
        for (const [paneId, sessionId] of prevPanes.entries()) {
          if (sessionId) {
            closePtySession(sessionId);
          }
          disposeTerminalInstance(paneId);
        }
      } else {
        // Check for removed panes within this tab
        for (const [paneId, sessionId] of prevPanes.entries()) {
          if (!currentPanes.has(paneId)) {
            // Pane was removed, close its session and dispose terminal
            if (sessionId) {
              closePtySession(sessionId);
            }
            disposeTerminalInstance(paneId);
          }
        }
      }
    }

    prevPaneSessionsRef.current = currentPaneSessions;
  }, [tabs, getPaneGrid, getAllPanes]);

  // Get the active terminal ref (for search)
  const getActiveTerminal = useCallback(() => {
    if (!activeTabId) return null;
    const activePaneId = getActivePaneId(activeTabId);
    if (!activePaneId) return null;
    const tabRefs = terminalRefs.current.get(activeTabId);
    return tabRefs?.get(activePaneId) ?? null;
  }, [activeTabId, getActivePaneId]);

  // Search functionality
  const { searchOpen, handleSearch, handleSearchNext, handleSearchPrevious, handleSearchClose } =
    useTerminalSearch({
      getActiveTerminal,
      disabled: settingsOpen,
    });

  // Tab keyboard shortcuts (disabled when settings panel or search is open)
  useTabShortcuts(settingsOpen || searchOpen);

  // Pane keyboard shortcuts (Cmd+D, Cmd+Shift+D)
  usePaneShortcuts({ disabled: settingsOpen || searchOpen });

  // Font size keyboard shortcuts (Cmd+/Cmd-, Cmd-/Cmd_)
  useFontSizeShortcuts({
    disabled: settingsOpen || searchOpen,
    onSettingsChange: handleSettingsChange,
  });

  // NOTE: Multi-screen window size management is now handled by Rust backend
  // in src-tauri/src/lib.rs (toggle_window, apply_window_config, save_window_config)
  // This provides better performance (~2-4ms vs ~23-80ms) and eliminates visual flash
  //
  // Window resize constraints (min/max) are also handled by Rust backend via tauri.conf.json
  // User can resize window using native macOS resize functionality (enabled via resizable: true)
  // Window size is automatically saved per screen when user manually resizes

  // Container should be transparent - terminal background handles opacity
  const containerStyle = useMemo(
    () => ({
      background: "transparent",
    }),
    []
  );

  // Handle terminal ref updates
  const handleTerminalRef = useCallback(
    (tabId: string) => (paneId: string, handle: XTerminalHandle | null) => {
      if (!terminalRefs.current.has(tabId)) {
        terminalRefs.current.set(tabId, new Map());
      }
      const tabRefs = terminalRefs.current.get(tabId)!;
      if (handle) {
        tabRefs.set(paneId, handle);
      } else {
        tabRefs.delete(paneId);
      }
    },
    []
  );

  // Handle session creation - update pane context
  const handleSessionCreated = useCallback(
    (tabId: string) => (paneId: string, sessionId: string) => {
      updatePaneSessionId(tabId, paneId, sessionId);
    },
    [updatePaneSessionId]
  );

  // Handle title change - update active pane's title as tab title
  const handleTitleChange = useCallback(
    (tabId: string) => (paneId: string, title: string) => {
      // Only update tab title if this is the active pane
      const activePaneId = getActivePaneId(tabId);
      if (paneId === activePaneId) {
        updateTabTitle(tabId, title);
      }
    },
    [getActivePaneId, updateTabTitle]
  );

  // Handle pane click - set active pane
  const handlePaneClick = useCallback(
    (tabId: string) => (paneId: string) => {
      setActivePane(tabId, paneId);
    },
    [setActivePane]
  );

  const settingsButton = (
    <button
      className={styles.settingsButton}
      onClick={() => setSettingsOpen(true)}
      title="Settings"
    >
      <GearIcon />
    </button>
  );

  return (
    <main className={styles.mainContainer} style={containerStyle}>
      <TabBar settingsButton={settingsButton} />
      <SearchBar
        isOpen={searchOpen}
        onClose={handleSearchClose}
        onSearch={handleSearch}
        onSearchNext={handleSearchNext}
        onSearchPrevious={handleSearchPrevious}
      />
      <div className={styles.terminalArea}>
        {tabs.map((tab) => {
          const paneGrid = getPaneGrid(tab.id);
          const activePaneId = getActivePaneId(tab.id);
          const isTabVisible = tab.id === activeTabId;

          if (!paneGrid || !activePaneId) {
            // Pane state not yet initialized
            return null;
          }

          return (
            <div key={tab.id} className={isTabVisible ? styles.tabContainer : styles.tabHidden}>
              <GridPaneContainer
                tabId={tab.id}
                grid={paneGrid}
                activePaneId={activePaneId}
                opacity={opacity ?? 0.95}
                fontSize={fontSize ?? 13}
                isTabVisible={isTabVisible}
                onTerminalRef={handleTerminalRef(tab.id)}
                onSessionCreated={handleSessionCreated(tab.id)}
                onTitleChange={handleTitleChange(tab.id)}
                onPaneClick={handlePaneClick(tab.id)}
              />
            </div>
          );
        })}
      </div>
      {/* NOTE: ResizeHandle components removed - using native window resize now (resizable: true in tauri.conf.json) */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={handleSettingsChange}
      />
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </main>
  );
}

export function TerminalView() {
  return (
    <PaneProvider>
      <TerminalViewInner />
    </PaneProvider>
  );
}
