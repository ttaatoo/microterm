"use client";

import dynamic from "next/dynamic";

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

export default function Home() {
  return (
    <main className="main-container">
      <XTerminal />
      <ResizeHandle
        minWidth={400}
        minHeight={200}
        maxWidth={1400}
        maxHeight={900}
      />
    </main>
  );
}
