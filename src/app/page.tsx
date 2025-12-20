"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { loadSettings, type Settings } from "@/lib/settings";

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

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [opacity, setOpacity] = useState(0.9);

  // Load settings on mount
  useEffect(() => {
    const settings = loadSettings();
    setOpacity(settings.opacity);
  }, []);

  const handleSettingsChange = useCallback((settings: Settings) => {
    setOpacity(settings.opacity);
  }, []);

  return (
    <main className="main-container">
      <XTerminal opacity={opacity} />
      <button
        className="settings-button"
        onClick={() => setSettingsOpen(true)}
        title="Settings"
      >
        <GearIcon />
      </button>
      <ResizeHandle
        position="bottom-left"
        minWidth={400}
        minHeight={200}
        maxWidth={1400}
        maxHeight={900}
      />
      <ResizeHandle
        position="bottom-right"
        minWidth={400}
        minHeight={200}
        maxWidth={1400}
        maxHeight={900}
      />
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={handleSettingsChange}
      />
    </main>
  );
}
