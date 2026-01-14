import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import * as styles from "./ResizeHandle.css";

type ResizePosition = "bottom-left" | "bottom-right";

interface ResizeHandleProps {
  position: ResizePosition;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  onResize?: (width: number, height: number) => void;
}

export default function ResizeHandle({
  position,
  minWidth = 400,
  minHeight = 200,
  maxWidth = 1200,
  maxHeight = 800,
  onResize,
}: ResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });
  const startWindowPosRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const currentWindow = getCurrentWindow();
      const size = await currentWindow.innerSize();
      const windowPos = await currentWindow.outerPosition();

      // Store physical pixels
      startPosRef.current = { x: e.screenX, y: e.screenY };
      startSizeRef.current = { width: size.width, height: size.height };
      startWindowPosRef.current = { x: windowPos.x, y: windowPos.y };
      setIsResizing(true);
    } catch (error) {
      console.error("Failed to get window size:", error);
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = async (e: MouseEvent) => {
      const deltaX = e.screenX - startPosRef.current.x;
      const deltaY = e.screenY - startPosRef.current.y;

      // Calculate new size based on position
      let newWidth: number;
      let newHeight: number;
      let newX: number | null = null;

      if (position === "bottom-right") {
        // Right corner: expand width to the right, height down
        newWidth = startSizeRef.current.width + deltaX;
        newHeight = startSizeRef.current.height + deltaY;
      } else {
        // Left corner: expand width to the left (inverse deltaX), height down
        newWidth = startSizeRef.current.width - deltaX;
        newHeight = startSizeRef.current.height + deltaY;
        // Window position needs to move left as width increases
        newX = startWindowPosRef.current.x + deltaX;
      }

      // Apply constraints (using physical pixels, approximate for Retina)
      const scaleFactor = window.devicePixelRatio || 1;
      const minW = minWidth * scaleFactor;
      const maxW = maxWidth * scaleFactor;
      const minH = minHeight * scaleFactor;
      const maxH = maxHeight * scaleFactor;

      // Clamp width and adjust X position accordingly for left resize
      const clampedWidth = Math.max(minW, Math.min(maxW, newWidth));
      newHeight = Math.max(minH, Math.min(maxH, newHeight));

      if (position === "bottom-left" && newX !== null) {
        // Adjust X based on clamped width difference
        const widthDiff = newWidth - clampedWidth;
        newX = newX + widthDiff;
      }

      newWidth = clampedWidth;

      try {
        const currentWindow = getCurrentWindow();

        // For left resize, set position first to avoid flicker
        if (position === "bottom-left" && newX !== null) {
          await currentWindow.setPosition(new PhysicalPosition(Math.round(newX), startWindowPosRef.current.y));
        }

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

    const cursor = position === "bottom-right" ? "nwse-resize" : "nesw-resize";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, position, minWidth, minHeight, maxWidth, maxHeight, onResize]);

  const isLeft = position === "bottom-left";

  const positionClass = position === "bottom-right" ? styles.resizeHandleBottomRight : styles.resizeHandleBottomLeft;

  return (
    <div
      className={`${styles.resizeHandle} ${positionClass}`}
      onMouseDown={handleMouseDown}
      title="Drag to resize"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={isLeft ? { transform: "scaleX(-1)" } : undefined}
      >
        {/* Diagonal lines pattern like iTerm2/macOS */}
        <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="10" y1="6" x2="6" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="10" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );
}
