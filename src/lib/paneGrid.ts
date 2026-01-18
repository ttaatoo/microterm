/**
 * Pane Grid Utilities
 *
 * Grid-based data structure for managing split terminal panes.
 * - Panes are stored in a 2D grid (rows × columns)
 * - Flat Map storage for O(1) lookup by pane ID
 * - Supports complex layouts (2x2, 3x1, etc.) without deep nesting
 * - Similar to VSCode's terminal pane architecture
 */

// ============== Types ==============

/** Direction of the split */
export type SplitDirection = "horizontal" | "vertical";

/** A pane in the grid */
export interface GridPane {
  id: string;
  sessionId: string | null;
  row: number; // Grid row position (0-indexed)
  col: number; // Grid column position (0-indexed)
}

/** Grid structure with panes, dimensions, and ratios */
export interface PaneGrid {
  panes: Map<string, GridPane>; // Flat storage of pane data by ID
  rows: number; // Number of rows in the grid
  cols: number; // Number of columns in the grid
  rowHeights: number[]; // Row height ratios (0.0-1.0, sum to 1.0)
  colWidths: number[]; // Column width ratios (0.0-1.0, sum to 1.0)
}

// ============== ID Generation ==============

/** Generate a unique pane ID */
export function generatePaneId(): string {
  return `pane-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============== Grid Creation ==============

/** Create an empty grid */
export function createEmptyGrid(): PaneGrid {
  return {
    panes: new Map(),
    rows: 0,
    cols: 0,
    rowHeights: [],
    colWidths: [],
  };
}

/** Create a grid with a single pane */
export function createGridWithPane(paneId?: string): PaneGrid {
  const id = paneId ?? generatePaneId();
  const pane: GridPane = {
    id,
    sessionId: null,
    row: 0,
    col: 0,
  };

  return {
    panes: new Map([[id, pane]]),
    rows: 1,
    cols: 1,
    rowHeights: [1.0],
    colWidths: [1.0],
  };
}

// ============== Grid Queries ==============

/** Get a pane by ID */
export function getPaneById(grid: PaneGrid, paneId: string): GridPane | null {
  return grid.panes.get(paneId) ?? null;
}

/** Get all panes in the grid */
export function getAllPanes(grid: PaneGrid): GridPane[] {
  return Array.from(grid.panes.values());
}

/** Count total panes in the grid */
export function countPanes(grid: PaneGrid): number {
  return grid.panes.size;
}

/** Check if grid is empty */
export function isEmptyGrid(grid: PaneGrid): boolean {
  return grid.panes.size === 0;
}

// ============== Grid Mutations ==============

/**
 * Split a pane in a direction.
 * - Horizontal split: adds a new row below the pane
 * - Vertical split: adds a new column to the right of the pane
 * Returns the new grid and the ID of the newly created pane.
 */
export function splitPane(
  grid: PaneGrid,
  paneId: string,
  direction: SplitDirection
): { grid: PaneGrid; newPaneId: string } | null {
  const pane = grid.panes.get(paneId);
  if (!pane) {
    return null;
  }

  const newPaneId = generatePaneId();
  const newPane: GridPane = {
    id: newPaneId,
    sessionId: null,
    row: pane.row,
    col: pane.col,
  };

  if (direction === "horizontal") {
    // Horizontal split: add new row below
    return splitPaneHorizontal(grid, pane, newPane);
  } else {
    // Vertical split: add new column to the right
    return splitPaneVertical(grid, pane, newPane);
  }
}

/** Split pane horizontally (add new row) */
function splitPaneHorizontal(
  grid: PaneGrid,
  pane: GridPane,
  newPane: GridPane
): { grid: PaneGrid; newPaneId: string } {
  const newPanes = new Map(grid.panes);

  // Move all panes in rows below this pane down by 1
  const panesToMove: GridPane[] = [];
  for (const existingPane of newPanes.values()) {
    if (existingPane.row > pane.row) {
      panesToMove.push(existingPane);
    }
  }

  // Update moved panes
  for (const movedPane of panesToMove) {
    const updated = { ...movedPane, row: movedPane.row + 1 };
    newPanes.set(movedPane.id, updated);
  }

  // Add new pane in the row below
  newPane.row = pane.row + 1;
  newPane.col = pane.col;
  newPanes.set(newPane.id, newPane);

  // Update grid dimensions
  const newRows = grid.rows + 1;
  const newRowHeights = [...grid.rowHeights];

  // Split the current row's height in half
  const currentRowHeight = newRowHeights[pane.row];
  newRowHeights[pane.row] = currentRowHeight / 2;
  newRowHeights.splice(pane.row + 1, 0, currentRowHeight / 2);

  // Normalize row heights to sum to 1.0
  const sum = newRowHeights.reduce((a, b) => a + b, 0);
  const normalizedRowHeights = newRowHeights.map((h) => h / sum);

  return {
    grid: {
      panes: newPanes,
      rows: newRows,
      cols: grid.cols,
      rowHeights: normalizedRowHeights,
      colWidths: grid.colWidths,
    },
    newPaneId: newPane.id,
  };
}

/** Split pane vertically (add new column) */
function splitPaneVertical(
  grid: PaneGrid,
  pane: GridPane,
  newPane: GridPane
): { grid: PaneGrid; newPaneId: string } {
  const newPanes = new Map(grid.panes);

  // Move all panes in columns to the right of this pane right by 1
  const panesToMove: GridPane[] = [];
  for (const existingPane of newPanes.values()) {
    if (existingPane.row === pane.row && existingPane.col > pane.col) {
      panesToMove.push(existingPane);
    }
  }

  // Update moved panes
  for (const movedPane of panesToMove) {
    const updated = { ...movedPane, col: movedPane.col + 1 };
    newPanes.set(movedPane.id, updated);
  }

  // Add new pane in the column to the right
  newPane.row = pane.row;
  newPane.col = pane.col + 1;
  newPanes.set(newPane.id, newPane);

  // Update grid dimensions
  const newCols = grid.cols + 1;
  const newColWidths = [...grid.colWidths];

  // Split the current column's width in half
  const currentColWidth = newColWidths[pane.col];
  newColWidths[pane.col] = currentColWidth / 2;
  newColWidths.splice(pane.col + 1, 0, currentColWidth / 2);

  // Normalize column widths to sum to 1.0
  const sum = newColWidths.reduce((a, b) => a + b, 0);
  const normalizedColWidths = newColWidths.map((w) => w / sum);

  return {
    grid: {
      panes: newPanes,
      rows: grid.rows,
      cols: newCols,
      rowHeights: grid.rowHeights,
      colWidths: normalizedColWidths,
    },
    newPaneId: newPane.id,
  };
}

/**
 * Remove a pane from the grid.
 * Collapses empty rows/columns after removal.
 * Returns null if the pane is the last one (can't remove the last pane).
 */
export function removePane(grid: PaneGrid, paneId: string): PaneGrid | null {
  const pane = grid.panes.get(paneId);
  if (!pane) {
    return grid; // Pane not found, return unchanged
  }

  // Can't remove if it's the only pane
  if (grid.panes.size === 1) {
    return null;
  }

  const newPanes = new Map(grid.panes);
  newPanes.delete(paneId);

  // Collapse empty rows and columns
  let newGrid = {
    panes: newPanes,
    rows: grid.rows,
    cols: grid.cols,
    rowHeights: [...grid.rowHeights],
    colWidths: [...grid.colWidths],
  };

  // Remove empty rows (columns first to avoid index conflicts)
  newGrid = collapseEmptyColumns(newGrid);
  newGrid = collapseEmptyRows(newGrid);

  // Normalize ratios
  const rowSum = newGrid.rowHeights.reduce((a, b) => a + b, 0);
  const colSum = newGrid.colWidths.reduce((a, b) => a + b, 0);
  newGrid.rowHeights = newGrid.rowHeights.map((h) => h / rowSum);
  newGrid.colWidths = newGrid.colWidths.map((w) => w / colSum);

  return newGrid;
}

/** Collapse empty rows in the grid */
function collapseEmptyRows(grid: PaneGrid): PaneGrid {
  // Find rows that have no panes
  const rowsWithPanes = new Set<number>();
  for (const pane of grid.panes.values()) {
    rowsWithPanes.add(pane.row);
  }

  // Build mapping: oldRow -> newRow
  const rowMap = new Map<number, number>();
  let newRowIndex = 0;
  for (let oldRow = 0; oldRow < grid.rows; oldRow++) {
    if (rowsWithPanes.has(oldRow)) {
      rowMap.set(oldRow, newRowIndex);
      newRowIndex++;
    }
  }

  // Update pane positions and rebuild grid
  const newPanes = new Map<string, GridPane>();
  const newRowHeights: number[] = [];

  for (const pane of grid.panes.values()) {
    const newRow = rowMap.get(pane.row);
    if (newRow !== undefined) {
      newPanes.set(pane.id, { ...pane, row: newRow });
      if (newRowHeights[newRow] === undefined) {
        newRowHeights[newRow] = grid.rowHeights[pane.row];
      } else {
        newRowHeights[newRow] += grid.rowHeights[pane.row];
      }
    }
  }

  return {
    ...grid,
    panes: newPanes,
    rows: newRowIndex,
    rowHeights: newRowHeights,
  };
}

/** Collapse empty columns in the grid */
function collapseEmptyColumns(grid: PaneGrid): PaneGrid {
  // Find columns that have no panes
  const colsWithPanes = new Set<number>();
  for (const pane of grid.panes.values()) {
    colsWithPanes.add(pane.col);
  }

  // Build mapping: oldCol -> newCol
  const colMap = new Map<number, number>();
  let newColIndex = 0;
  for (let oldCol = 0; oldCol < grid.cols; oldCol++) {
    if (colsWithPanes.has(oldCol)) {
      colMap.set(oldCol, newColIndex);
      newColIndex++;
    }
  }

  // Update pane positions and rebuild grid
  const newPanes = new Map<string, GridPane>();
  const newColWidths: number[] = [];

  for (const pane of grid.panes.values()) {
    const newCol = colMap.get(pane.col);
    if (newCol !== undefined) {
      newPanes.set(pane.id, { ...pane, col: newCol });
      if (newColWidths[newCol] === undefined) {
        newColWidths[newCol] = grid.colWidths[pane.col];
      } else {
        newColWidths[newCol] += grid.colWidths[pane.col];
      }
    }
  }

  return {
    ...grid,
    panes: newPanes,
    cols: newColIndex,
    colWidths: newColWidths,
  };
}

/**
 * Find the next pane to focus after closing a pane.
 * Returns the pane ID to focus, or null if no pane remains.
 *
 * Priority:
 * 1. Same row, adjacent column (prefer left, then right)
 * 2. Same column, adjacent row (prefer above, then below)
 * 3. Same row, any column
 * 4. Same column, any row
 * 5. Any remaining pane
 */
export function findNextPaneAfterClose(grid: PaneGrid, closedPaneId: string): string | null {
  const closedPane = grid.panes.get(closedPaneId);
  if (!closedPane) {
    return null;
  }

  // Collect all panes except the closed one
  const candidates: GridPane[] = [];
  for (const pane of grid.panes.values()) {
    if (pane.id !== closedPaneId) {
      candidates.push(pane);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Priority 1: Same row, adjacent column (prefer left, then right)
  // Left neighbor (col - 1)
  const leftNeighbor = candidates.find(
    (p) => p.row === closedPane.row && p.col === closedPane.col - 1
  );
  if (leftNeighbor) {
    return leftNeighbor.id;
  }

  // Right neighbor (col + 1)
  const rightNeighbor = candidates.find(
    (p) => p.row === closedPane.row && p.col === closedPane.col + 1
  );
  if (rightNeighbor) {
    return rightNeighbor.id;
  }

  // Priority 2: Same column, adjacent row (prefer above, then below)
  // Above neighbor (row - 1)
  const aboveNeighbor = candidates.find(
    (p) => p.col === closedPane.col && p.row === closedPane.row - 1
  );
  if (aboveNeighbor) {
    return aboveNeighbor.id;
  }

  // Below neighbor (row + 1)
  const belowNeighbor = candidates.find(
    (p) => p.col === closedPane.col && p.row === closedPane.row + 1
  );
  if (belowNeighbor) {
    return belowNeighbor.id;
  }

  // Priority 3: Same row, any column (prefer closest column)
  const sameRowPanes = candidates.filter((p) => p.row === closedPane.row);
  if (sameRowPanes.length > 0) {
    // Sort by column distance and return closest
    sameRowPanes.sort((a, b) => {
      const distA = Math.abs(a.col - closedPane.col);
      const distB = Math.abs(b.col - closedPane.col);
      return distA - distB;
    });
    return sameRowPanes[0].id;
  }

  // Priority 4: Same column, any row (prefer closest row)
  const sameColPanes = candidates.filter((p) => p.col === closedPane.col);
  if (sameColPanes.length > 0) {
    // Sort by row distance and return closest
    sameColPanes.sort((a, b) => {
      const distA = Math.abs(a.row - closedPane.row);
      const distB = Math.abs(b.row - closedPane.row);
      return distA - distB;
    });
    return sameColPanes[0].id;
  }

  // Priority 5: Any remaining pane
  return candidates[0].id;
}

/**
 * Update a pane's session ID.
 * Returns a new grid with the updated session ID.
 */
export function updatePaneSession(grid: PaneGrid, paneId: string, sessionId: string): PaneGrid {
  const pane = grid.panes.get(paneId);
  if (!pane) {
    return grid;
  }

  const newPanes = new Map(grid.panes);
  newPanes.set(paneId, { ...pane, sessionId });

  return {
    ...grid,
    panes: newPanes,
  };
}

/**
 * Update row heights (for resizing).
 * Heights are normalized to sum to 1.0.
 */
export function updateRowHeights(grid: PaneGrid, rowIndex: number, newHeight: number): PaneGrid {
  if (rowIndex < 0 || rowIndex >= grid.rows) {
    return grid;
  }

  const newRowHeights = [...grid.rowHeights];
  newRowHeights[rowIndex] = Math.max(0.01, Math.min(0.99, newHeight)); // Clamp

  // Normalize to sum to 1.0
  const sum = newRowHeights.reduce((a, b) => a + b, 0);
  const normalized = newRowHeights.map((h) => h / sum);

  return {
    ...grid,
    rowHeights: normalized,
  };
}

/**
 * Resize rows by adjusting the divider between two rows.
 * dividerIndex is the index of the divider (0 = between row 0 and row 1).
 * newTotalRatio is the cumulative ratio up to and including the row before the divider.
 */
export function resizeRowDivider(
  grid: PaneGrid,
  dividerIndex: number,
  newTotalRatio: number
): PaneGrid {
  if (dividerIndex < 0 || dividerIndex >= grid.rows - 1) {
    return grid;
  }

  const currentRowHeights = [...grid.rowHeights];
  const currentTotalBefore = currentRowHeights
    .slice(0, dividerIndex + 1)
    .reduce((a, b) => a + b, 0);

  const delta = newTotalRatio - currentTotalBefore;
  const newRowHeights = [...currentRowHeights];

  // Adjust the row before the divider
  const newHeight = Math.max(0.01, Math.min(0.99, newRowHeights[dividerIndex] + delta));
  newRowHeights[dividerIndex] = newHeight;

  // Normalize to sum to 1.0
  const sum = newRowHeights.reduce((a, b) => a + b, 0);
  const normalized = newRowHeights.map((h) => h / sum);

  return {
    ...grid,
    rowHeights: normalized,
  };
}

/**
 * Update column widths (for resizing).
 * Widths are normalized to sum to 1.0.
 */
export function updateColWidths(grid: PaneGrid, colIndex: number, newWidth: number): PaneGrid {
  if (colIndex < 0 || colIndex >= grid.cols) {
    return grid;
  }

  const newColWidths = [...grid.colWidths];
  newColWidths[colIndex] = Math.max(0.01, Math.min(0.99, newWidth)); // Clamp

  // Normalize to sum to 1.0
  const sum = newColWidths.reduce((a, b) => a + b, 0);
  const normalized = newColWidths.map((w) => w / sum);

  return {
    ...grid,
    colWidths: normalized,
  };
}

/**
 * Resize columns by adjusting the divider between two columns.
 * dividerIndex is the index of the divider (0 = between col 0 and col 1).
 * newTotalRatio is the cumulative ratio up to and including the col before the divider.
 */
export function resizeColDivider(
  grid: PaneGrid,
  dividerIndex: number,
  newTotalRatio: number
): PaneGrid {
  if (dividerIndex < 0 || dividerIndex >= grid.cols - 1) {
    return grid;
  }

  const currentColWidths = [...grid.colWidths];
  const currentTotalBefore = currentColWidths.slice(0, dividerIndex + 1).reduce((a, b) => a + b, 0);

  const delta = newTotalRatio - currentTotalBefore;
  const newColWidths = [...currentColWidths];

  // Adjust the col before the divider
  const newWidth = Math.max(0.01, Math.min(0.99, newColWidths[dividerIndex] + delta));
  newColWidths[dividerIndex] = newWidth;

  // Normalize to sum to 1.0
  const sum = newColWidths.reduce((a, b) => a + b, 0);
  const normalized = newColWidths.map((w) => w / sum);

  return {
    ...grid,
    colWidths: normalized,
  };
}

/**
 * Validate grid consistency.
 * Checks that:
 * - All panes have valid row/col indices
 * - Row heights sum to 1.0
 * - Column widths sum to 1.0
 * - No duplicate pane IDs
 * - All referenced rows/cols exist
 */
export function validateGrid(grid: PaneGrid): boolean {
  // Check row heights sum
  const rowSum = grid.rowHeights.reduce((a, b) => a + b, 0);
  if (Math.abs(rowSum - 1.0) > 0.001) {
    console.warn(`[paneGrid] Row heights sum to ${rowSum}, expected 1.0`);
    return false;
  }

  // Check column widths sum
  const colSum = grid.colWidths.reduce((a, b) => a + b, 0);
  if (Math.abs(colSum - 1.0) > 0.001) {
    console.warn(`[paneGrid] Column widths sum to ${colSum}, expected 1.0`);
    return false;
  }

  // Check pane positions are valid
  for (const pane of grid.panes.values()) {
    if (pane.row < 0 || pane.row >= grid.rows) {
      console.warn(`[paneGrid] Pane ${pane.id} has invalid row ${pane.row}`);
      return false;
    }
    if (pane.col < 0 || pane.col >= grid.cols) {
      console.warn(`[paneGrid] Pane ${pane.id} has invalid col ${pane.col}`);
      return false;
    }
  }

  // Check for duplicate IDs
  const ids = new Set<string>();
  for (const pane of grid.panes.values()) {
    if (ids.has(pane.id)) {
      console.warn(`[paneGrid] Duplicate pane ID: ${pane.id}`);
      return false;
    }
    ids.add(pane.id);
  }

  // Check row/col counts match arrays
  if (grid.rowHeights.length !== grid.rows) {
    console.warn(
      `[paneGrid] Row heights array length (${grid.rowHeights.length}) doesn't match rows (${grid.rows})`
    );
    return false;
  }

  if (grid.colWidths.length !== grid.cols) {
    console.warn(
      `[paneGrid] Column widths array length (${grid.colWidths.length}) doesn't match cols (${grid.cols})`
    );
    return false;
  }

  return true;
}
