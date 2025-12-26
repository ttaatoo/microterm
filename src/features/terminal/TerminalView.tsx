import { useRef, useCallback } from "react";
import {
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  MAX_WINDOW_WIDTH,
  MAX_WINDOW_HEIGHT,
} from "@/lib/settings";
import { ToastContainer } from "@/components/Toast";
import { useTabContext } from "@/contexts/TabContext";
import { useTabShortcuts, useToast, useSettings, useTerminalSearch } from "@/hooks";
import { GearIcon } from "@/components/icons";
import XTerminal, { type XTerminalHandle } from "@/components/XTerminal";
import SearchBar from "@/components/SearchBar";
import ResizeHandle from "@/components/ResizeHandle";
import SettingsPanel from "@/components/SettingsPanel";
import Onboarding from "@/components/Onboarding";
import TabBar from "@/components/TabBar";
import { useState } from "react";

export function TerminalView() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const terminalRefs = useRef<Map<string, XTerminalHandle>>(new Map());
  const { tabs, activeTabId, updateTabSessionId, updateTabTitle } = useTabContext();

  // Toast notifications
  const { toasts, addToast, removeToast } = useToast();

  // Settings management
  const {
    opacity,
    fontSize,
    showOnboarding,
    handleSettingsChange,
    handleResize,
    handleOnboardingComplete,
  } = useSettings({
    onShortcutError: (shortcut) => {
      addToast(`Shortcut "${shortcut}" may be in use by another app`, "warning");
    },
  });

  // Get the active terminal ref
  const getActiveTerminal = useCallback(() => {
    if (!activeTabId) return null;
    return terminalRefs.current.get(activeTabId) ?? null;
  }, [activeTabId]);

  // Search functionality
  const { searchOpen, handleSearch, handleSearchNext, handleSearchPrevious, handleSearchClose } =
    useTerminalSearch({
      getActiveTerminal,
      disabled: settingsOpen,
    });

  // Tab keyboard shortcuts (disabled when settings panel or search is open)
  useTabShortcuts(settingsOpen || searchOpen);

  // Dynamic background style based on opacity
  const containerStyle =
    opacity !== undefined
      ? {
          background: `rgba(0, 0, 0, ${opacity})`,
        }
      : undefined;

  const settingsButton = (
    <button className="settings-button" onClick={() => setSettingsOpen(true)} title="Settings">
      <GearIcon />
    </button>
  );

  return (
    <main className="main-container" style={containerStyle}>
      <TabBar settingsButton={settingsButton} />
      <SearchBar
        isOpen={searchOpen}
        onClose={handleSearchClose}
        onSearch={handleSearch}
        onSearchNext={handleSearchNext}
        onSearchPrevious={handleSearchPrevious}
      />
      <div className="terminal-area">
        {tabs.map((tab) => (
          <XTerminal
            key={tab.id}
            ref={(handle) => {
              if (handle) {
                terminalRefs.current.set(tab.id, handle);
              } else {
                terminalRefs.current.delete(tab.id);
              }
            }}
            tabId={tab.id}
            isVisible={tab.id === activeTabId}
            opacity={opacity}
            fontSize={fontSize}
            onSessionCreated={(sessionId) => updateTabSessionId(tab.id, sessionId)}
            onTitleChange={(title) => updateTabTitle(tab.id, title)}
          />
        ))}
      </div>
      <ResizeHandle
        position="bottom-left"
        minWidth={MIN_WINDOW_WIDTH}
        minHeight={MIN_WINDOW_HEIGHT}
        maxWidth={MAX_WINDOW_WIDTH}
        maxHeight={MAX_WINDOW_HEIGHT}
        onResize={handleResize}
      />
      <ResizeHandle
        position="bottom-right"
        minWidth={MIN_WINDOW_WIDTH}
        minHeight={MIN_WINDOW_HEIGHT}
        maxWidth={MAX_WINDOW_WIDTH}
        maxHeight={MAX_WINDOW_HEIGHT}
        onResize={handleResize}
      />
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
