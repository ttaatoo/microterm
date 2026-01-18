import { usePaneContext } from "@/contexts/PaneContext";
import { type GridPane, type PaneGrid } from "@/lib/paneGrid";
import { memo, useCallback, useMemo } from "react";
import GridDivider from "./GridDivider";
import * as styles from "./GridPaneContainer.css";
import XTerminal, { type XTerminalHandle } from "./XTerminal";

interface GridPaneContainerProps {
  tabId: string;
  grid: PaneGrid;
  activePaneId: string;
  opacity: number;
  fontSize: number;
  isTabVisible: boolean;
  onTerminalRef: (paneId: string, handle: XTerminalHandle | null) => void;
  onSessionCreated: (paneId: string, sessionId: string) => void;
  onTitleChange: (paneId: string, title: string) => void;
  onPaneClick: (paneId: string) => void;
}

/** Component that renders panes in a CSS Grid layout */
function GridPaneContainerInner({
  tabId,
  grid,
  activePaneId,
  opacity,
  fontSize,
  isTabVisible,
  onTerminalRef,
  onSessionCreated,
  onTitleChange,
  onPaneClick,
}: GridPaneContainerProps) {
  const { resizeRowDivider, resizeColDivider } = usePaneContext();

  // Build 2D array of grid cells
  const gridCells = useMemo(() => {
    const cells: (GridPane | null)[][] = [];
    for (let row = 0; row < grid.rows; row++) {
      cells[row] = [];
      for (let col = 0; col < grid.cols; col++) {
        cells[row][col] = null;
      }
    }

    // Fill in panes at their grid positions
    for (const pane of grid.panes.values()) {
      cells[pane.row][pane.col] = pane;
    }

    return cells;
  }, [grid]);

  // Build CSS Grid template strings
  const gridTemplateRows = useMemo(
    () => grid.rowHeights.map((h) => `${h * 100}%`).join(" "),
    [grid.rowHeights]
  );

  const gridTemplateColumns = useMemo(
    () => grid.colWidths.map((w) => `${w * 100}%`).join(" "),
    [grid.colWidths]
  );

  const handleRowResize = useCallback(
    (dividerIndex: number) => (newTotalRatio: number) => {
      resizeRowDivider(tabId, dividerIndex, newTotalRatio);
    },
    [tabId, resizeRowDivider]
  );

  const handleColResize = useCallback(
    (dividerIndex: number) => (newTotalRatio: number) => {
      resizeColDivider(tabId, dividerIndex, newTotalRatio);
    },
    [tabId, resizeColDivider]
  );

  return (
    <div
      className={styles.gridContainer}
      style={{
        gridTemplateRows,
        gridTemplateColumns,
      }}
    >
      {/* Render grid cells */}
      {gridCells.map((row, rowIndex) =>
        row.map((pane, colIndex) => (
          <GridPaneCell
            key={pane?.id ?? `cell-${rowIndex}-${colIndex}`}
            pane={pane}
            tabId={tabId}
            isActive={pane?.id === activePaneId}
            opacity={opacity}
            fontSize={fontSize}
            isTabVisible={isTabVisible}
            onRef={onTerminalRef}
            onSessionCreated={onSessionCreated}
            onTitleChange={onTitleChange}
            onClick={onPaneClick}
          />
        ))
      )}

      {/* Render dividers for resizing */}
      {/* Horizontal dividers (between rows) */}
      {grid.rows > 1 &&
        Array.from({ length: grid.rows - 1 }, (_, i) => (
          <GridDivider
            key={`row-divider-${i}`}
            type="row"
            index={i}
            onResize={handleRowResize(i)}
            rowHeights={grid.rowHeights}
          />
        ))}

      {/* Vertical dividers (between columns) */}
      {grid.cols > 1 &&
        Array.from({ length: grid.cols - 1 }, (_, i) => (
          <GridDivider
            key={`col-divider-${i}`}
            type="column"
            index={i}
            onResize={handleColResize(i)}
            colWidths={grid.colWidths}
          />
        ))}
    </div>
  );
}

/** Individual grid cell component */
interface GridPaneCellProps {
  pane: GridPane | null;
  tabId: string;
  isActive: boolean;
  opacity: number;
  fontSize: number;
  isTabVisible: boolean;
  onRef: (paneId: string, handle: XTerminalHandle | null) => void;
  onSessionCreated: (paneId: string, sessionId: string) => void;
  onTitleChange: (paneId: string, title: string) => void;
  onClick: (paneId: string) => void;
}

const GridPaneCell = memo(function GridPaneCell({
  pane,
  tabId,
  isActive,
  opacity,
  fontSize,
  isTabVisible,
  onRef,
  onSessionCreated,
  onTitleChange,
  onClick,
}: GridPaneCellProps) {
  const handleRef = useCallback(
    (handle: XTerminalHandle | null) => {
      if (pane) {
        onRef(pane.id, handle);
      }
    },
    [pane, onRef]
  );

  const handleSessionCreated = useCallback(
    (sessionId: string) => {
      if (pane) {
        onSessionCreated(pane.id, sessionId);
      }
    },
    [pane, onSessionCreated]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (pane) {
        onTitleChange(pane.id, title);
      }
    },
    [pane, onTitleChange]
  );

  const handleClick = useCallback(() => {
    if (pane) {
      onClick(pane.id);
    }
  }, [pane, onClick]);

  // Empty cell - render transparent div
  if (!pane) {
    return <div className={styles.emptyCell} />;
  }

  // Pane cell - render terminal
  return (
    <div className={`${styles.paneCell} ${isActive ? styles.paneCellActive : ""}`}>
      <XTerminal
        key={pane.id}
        ref={handleRef}
        tabId={tabId}
        paneId={pane.id}
        existingSessionId={pane.sessionId}
        isVisible={isTabVisible}
        isActivePane={isActive}
        opacity={opacity}
        fontSize={fontSize}
        onSessionCreated={handleSessionCreated}
        onTitleChange={handleTitleChange}
        onClick={handleClick}
      />
    </div>
  );
});

const GridPaneContainer = memo(GridPaneContainerInner);

export default GridPaneContainer;
