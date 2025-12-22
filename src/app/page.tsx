"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  loadSettings,
  saveSettings,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  MAX_WINDOW_WIDTH,
  MAX_WINDOW_HEIGHT,
  DEFAULT_SHORTCUT,
  type Settings,
} from "@/lib/settings";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer, type ToastType } from "@/components/Toast";
import {
  registerGlobalShortcut,
  unregisterGlobalShortcut,
} from "@/lib/tauri";

// Dynamically import XTerminal to avoid SSR issues with xterm.js
const XTerminal = dynamic(() => import("@/components/XTerminal"), {
  ssr: false,
  loading: () => (
    <div className="terminal-loading">
      <span>Loading terminal...</span>
    </div>
  ),
});

// Dynamically import ResizeHandle to avoid SSR issues with Tauri APIs
const ResizeHandle = dynamic(() => import("@/components/ResizeHandle"), {
  ssr: false,
});

// Dynamically import SettingsPanel
const SettingsPanel = dynamic(() => import("@/components/SettingsPanel"), {
  ssr: false,
});

// Dynamically import Onboarding
const Onboarding = dynamic(() => import("@/components/Onboarding"), {
  ssr: false,
});

// Gear icon SVG component
function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// Toast state type
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [opacity, setOpacity] = useState<number | undefined>(undefined);
  const [fontSize, setFontSize] = useState<number | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const settingsRef = useRef<Settings | null>(null);
  const currentShortcutRef = useRef<string | null>(null);

  // Add toast notification
  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  // Remove toast notification
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load settings and restore window size on mount
  useEffect(() => {
    const initSettings = async () => {
      const settings = loadSettings();
      settingsRef.current = settings;
      setOpacity(settings.opacity);
      setFontSize(settings.fontSize);

      // Show onboarding for first-time users
      if (!settings.onboardingComplete) {
        setShowOnboarding(true);
      }

      // Restore window size from settings
      if (settings.windowSize) {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const { LogicalSize } = await import("@tauri-apps/api/dpi");
          const currentWindow = getCurrentWindow();
          await currentWindow.setSize(
            new LogicalSize(settings.windowSize.width, settings.windowSize.height)
          );
        } catch (error) {
          console.error("Failed to restore window size:", error);
        }
      }

      // Register global shortcut if enabled
      if (settings.shortcutEnabled !== false && settings.globalShortcut) {
        try {
          await registerGlobalShortcut(settings.globalShortcut, () => {
            // Callback when shortcut is triggered (window toggle is handled by Rust)
          });
          currentShortcutRef.current = settings.globalShortcut;
        } catch (error) {
          console.error("Failed to register global shortcut:", error);
          addToast(
            `Shortcut "${settings.globalShortcut}" may be in use by another app`,
            "warning"
          );
        }
      }
    };
    initSettings();

    // Cleanup on unmount
    return () => {
      if (currentShortcutRef.current) {
        unregisterGlobalShortcut(currentShortcutRef.current).catch(console.error);
      }
    };
    // addToast is stable (useCallback with no deps), safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSettingsChange = useCallback(async (settings: Settings) => {
    settingsRef.current = settings;
    setOpacity(settings.opacity);
    setFontSize(settings.fontSize);

    // Handle shortcut changes
    const newShortcut = settings.globalShortcut ?? DEFAULT_SHORTCUT;
    const shortcutEnabled = settings.shortcutEnabled !== false;

    // Unregister old shortcut if it changed or was disabled
    if (currentShortcutRef.current &&
        (currentShortcutRef.current !== newShortcut || !shortcutEnabled)) {
      try {
        await unregisterGlobalShortcut(currentShortcutRef.current);
        currentShortcutRef.current = null;
      } catch (error) {
        console.error("Failed to unregister shortcut:", error);
      }
    }

    // Register new shortcut if enabled and not already registered
    if (shortcutEnabled && currentShortcutRef.current !== newShortcut) {
      try {
        await registerGlobalShortcut(newShortcut, () => {
          // Callback when shortcut is triggered
        });
        currentShortcutRef.current = newShortcut;
      } catch (error) {
        console.error("Failed to register shortcut:", error);
        addToast(
          `Shortcut "${newShortcut}" may be in use by another app`,
          "warning"
        );
      }
    }
  }, [addToast]);

  // Handle window resize - save new size to settings
  const handleResize = useCallback((width: number, height: number) => {
    const currentSettings = settingsRef.current ?? loadSettings();
    const newSettings: Settings = {
      ...currentSettings,
      windowSize: { width: Math.round(width), height: Math.round(height) },
    };
    settingsRef.current = newSettings;
    saveSettings(newSettings);
  }, []);

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    const currentSettings = settingsRef.current ?? loadSettings();
    const newSettings: Settings = {
      ...currentSettings,
      onboardingComplete: true,
    };
    settingsRef.current = newSettings;
    saveSettings(newSettings);
  }, []);

  // Generate dynamic background style based on opacity
  const containerStyle = opacity !== undefined ? {
    background: `rgba(40, 44, 52, ${opacity})`,
  } : undefined;

  return (
    <ErrorBoundary>
      <main className="main-container" style={containerStyle}>
        <XTerminal opacity={opacity} fontSize={fontSize} />
        <button
          className="settings-button"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <GearIcon />
        </button>
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
    </ErrorBoundary>
  );
}
