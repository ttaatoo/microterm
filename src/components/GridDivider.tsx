import {
  DEFAULT_SPLIT_RATIO,
  MAX_PANE_RATIO,
  MIN_PANE_RATIO,
  SPLIT_DIVIDER_SIZE,
} from "@/lib/constants";
import { useCallback, useEffect, useRef, useState } from "react";
import * as styles from "./GridDivider.css";

interface GridDividerProps {
  type: "row" | "column"; // Row divider (horizontal) or column divider (vertical)
  index: number; // Index of the divider (0 = between first and second row/col)
  onResize: (newRatio: number) => void;
  // For absolute positioning in grid
  rowHeights?: number[]; // Row height ratios (for horizontal dividers)
  colWidths?: number[]; // Column width ratios (for vertical dividers)
}

export default function GridDivider({
  type,
  index,
  onResize,
  rowHeights = [],
  colWidths = [],
}: GridDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const startPosRef = useRef(0);
  const startRatioRef = useRef(0);
  const containerSizeRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Get the parent container (grid container)
      const dividerEl = e.currentTarget as HTMLDivElement;
      const container = dividerEl.parentElement;
      if (!container) return;

      containerRef.current = container;

      if (type === "column") {
        // Vertical divider - resize columns
        containerSizeRef.current = container.clientWidth;
        startPosRef.current = e.clientX;
      } else {
        // Horizontal divider - resize rows
        containerSizeRef.current = container.clientHeight;
        startPosRef.current = e.clientY;
      }

      // Calculate current ratio from grid template
      // For column divider: ratio is width of first column / total width
      // For row divider: ratio is height of first row / total height
      const computedStyle = window.getComputedStyle(container);
      const gridTemplate =
        type === "column"
          ? computedStyle.gridTemplateColumns.split(" ")
          : computedStyle.gridTemplateRows.split(" ");

      // Sum up sizes before the divider
      let totalBefore = 0;
      for (let i = 0; i <= index; i++) {
        const size = gridTemplate[i];
        if (size.endsWith("%")) {
          totalBefore += parseFloat(size) / 100;
        } else if (size.endsWith("px")) {
          totalBefore += parseFloat(size) / containerSizeRef.current;
        } else if (size.endsWith("fr")) {
          // Fractional unit - approximate
          totalBefore += parseFloat(size) / gridTemplate.length;
        }
      }

      startRatioRef.current = totalBefore;
      setIsDragging(true);
    },
    [type, index]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const containerSize = containerSizeRef.current;
      if (containerSize === 0) return;

      const currentPos = type === "column" ? e.clientX : e.clientY;
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
    document.body.style.cursor = type === "column" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Restore original styles
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
    };
  }, [isDragging, type, onResize]);

  // Double-click to reset to 50/50
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onResize(DEFAULT_SPLIT_RATIO);
    },
    [onResize]
  );

  const directionClass = type === "column" ? styles.dividerVertical : styles.dividerHorizontal;

  // Calculate absolute position based on cumulative ratios
  const dividerStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 10,
  };

  if (type === "column") {
    // Vertical divider: position at the boundary between column index and index+1
    // Calculate cumulative width up to column index
    const cumulativeWidth = colWidths.slice(0, index + 1).reduce((sum, width) => sum + width, 0);
    dividerStyle.left = `${cumulativeWidth * 100}%`;
    // Center the divider on the boundary (divider is 2px wide, so offset by 1px)
    dividerStyle.marginLeft = `-${SPLIT_DIVIDER_SIZE / 2}px`;
    dividerStyle.top = "0";
    dividerStyle.bottom = "0";
  } else {
    // Horizontal divider: position at the boundary between row index and index+1
    // Calculate cumulative height up to row index
    const cumulativeHeight = rowHeights.slice(0, index + 1).reduce((sum, height) => sum + height, 0);
    dividerStyle.top = `${cumulativeHeight * 100}%`;
    // Center the divider on the boundary (divider is 2px tall, so offset by 1px)
    dividerStyle.marginTop = `-${SPLIT_DIVIDER_SIZE / 2}px`;
    dividerStyle.left = "0";
    dividerStyle.right = "0";
  }

  return (
    <div
      className={`${styles.divider} ${directionClass} ${isDragging ? styles.dividerActive : ""}`}
      style={dividerStyle}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    />
  );
}
