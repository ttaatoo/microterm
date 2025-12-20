"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizeHandleProps {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  onResize?: (width: number, height: number) => void;
}

export default function ResizeHandle({
  minWidth = 400,
  minHeight = 200,
  maxWidth = 1200,
  maxHeight = 800,
  onResize,
}: ResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });
  const tauriApisRef = useRef<{
    getCurrentWindow: typeof import("@tauri-apps/api/window").getCurrentWindow;
    PhysicalSize: typeof import("@tauri-apps/api/dpi").PhysicalSize;
  } | null>(null);

  // Pre-load Tauri APIs
  useEffect(() => {
    const loadApis = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const { PhysicalSize } = await import("@tauri-apps/api/dpi");
        tauriApisRef.current = { getCurrentWindow, PhysicalSize };
      } catch (error) {
        console.error("Failed to load Tauri APIs:", error);
      }
    };
    loadApis();
  }, []);

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!tauriApisRef.current) return;

    try {
      const { getCurrentWindow } = tauriApisRef.current;
      const currentWindow = getCurrentWindow();
      const size = await currentWindow.innerSize();

      // Store physical pixels
      startPosRef.current = { x: e.screenX, y: e.screenY };
      startSizeRef.current = { width: size.width, height: size.height };
      setIsResizing(true);
    } catch (error) {
      console.error("Failed to get window size:", error);
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = async (e: MouseEvent) => {
      if (!tauriApisRef.current) return;

      const deltaX = e.screenX - startPosRef.current.x;
      const deltaY = e.screenY - startPosRef.current.y;

      // Calculate new size in physical pixels
      let newWidth = startSizeRef.current.width + deltaX;
      let newHeight = startSizeRef.current.height + deltaY;

      // Apply constraints (using physical pixels, approximate for Retina)
      const scaleFactor = window.devicePixelRatio || 1;
      const minW = minWidth * scaleFactor;
      const maxW = maxWidth * scaleFactor;
      const minH = minHeight * scaleFactor;
      const maxH = maxHeight * scaleFactor;

      newWidth = Math.max(minW, Math.min(maxW, newWidth));
      newHeight = Math.max(minH, Math.min(maxH, newHeight));

      try {
        const { getCurrentWindow, PhysicalSize } = tauriApisRef.current;
        const currentWindow = getCurrentWindow();

        // Use PhysicalSize to match innerSize() return type
        await currentWindow.setSize(new PhysicalSize(Math.round(newWidth), Math.round(newHeight)));
        onResize?.(newWidth / scaleFactor, newHeight / scaleFactor);
      } catch (error) {
        console.error("Failed to resize window:", error);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, minWidth, minHeight, maxWidth, maxHeight, onResize]);

  return (
    <div
      className={`resize-handle ${isResizing ? "resize-handle-active" : ""}`}
      onMouseDown={handleMouseDown}
      title="Drag to resize"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Diagonal lines pattern like iTerm2/macOS */}
        <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="10" y1="6" x2="6" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="10" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );
}
