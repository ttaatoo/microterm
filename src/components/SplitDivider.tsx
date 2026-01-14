import { DEFAULT_SPLIT_RATIO, MAX_PANE_RATIO, MIN_PANE_RATIO } from "@/lib/constants";
import type { SplitDirection } from "@/lib/paneTree";
import { useCallback, useEffect, useRef, useState } from "react";
import * as styles from "./SplitDivider.css";

interface SplitDividerProps {
  direction: SplitDirection;
  branchId: string;
  onResize: (newRatio: number) => void;
}

export default function SplitDivider({ direction, branchId, onResize }: SplitDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const startPosRef = useRef(0);
  const startRatioRef = useRef(0);
  const containerSizeRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Get the parent container size for ratio calculation
      const dividerEl = e.currentTarget as HTMLDivElement;
      const container = dividerEl.parentElement;
      if (!container) return;

      containerRef.current = container;

      if (direction === "vertical") {
        containerSizeRef.current = container.clientWidth;
        startPosRef.current = e.clientX;
      } else {
        containerSizeRef.current = container.clientHeight;
        startPosRef.current = e.clientY;
      }

      // Calculate current ratio from first child's size
      const firstChild = container.firstElementChild;
      if (firstChild && firstChild instanceof HTMLElement) {
        const firstChildSize =
          direction === "vertical" ? firstChild.clientWidth : firstChild.clientHeight;
        startRatioRef.current = firstChildSize / containerSizeRef.current;
      } else {
        startRatioRef.current = DEFAULT_SPLIT_RATIO;
      }

      setIsDragging(true);
    },
    [direction]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const containerSize = containerSizeRef.current;
      if (containerSize === 0) return;

      const currentPos = direction === "vertical" ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      const deltaRatio = delta / containerSize;
      const newRatio = startRatioRef.current + deltaRatio;

      // Clamp to min/max
      const clampedRatio = Math.max(MIN_PANE_RATIO, Math.min(MAX_PANE_RATIO, newRatio));
      onResize(clampedRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Save original styles before modifying
    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = direction === "vertical" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Restore original styles
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
    };
  }, [isDragging, direction, onResize]);

  // Double-click to reset to 50/50
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onResize(DEFAULT_SPLIT_RATIO);
    },
    [onResize]
  );

  const directionClass =
    direction === "vertical" ? styles.dividerVertical : styles.dividerHorizontal;

  return (
    <div
      data-branch-id={branchId}
      className={`${styles.divider} ${directionClass} ${isDragging ? styles.dividerActive : ""}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    />
  );
}
