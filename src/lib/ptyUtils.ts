/**
 * PTY utility functions for terminal dimension validation
 */

// Minimum PTY dimensions (matching Rust backend requirements)
export const MIN_PTY_COLS = 20;
export const MIN_PTY_ROWS = 5;

export interface PtyDimensions {
  cols: number;
  rows: number;
}

/**
 * Ensures terminal dimensions meet minimum PTY requirements
 * @param cols - Requested columns
 * @param rows - Requested rows
 * @returns Validated dimensions that meet minimum requirements
 */
export function ensureValidDimensions(cols: number, rows: number): PtyDimensions {
  const validCols = Math.max(cols, MIN_PTY_COLS);
  const validRows = Math.max(rows, MIN_PTY_ROWS);

  // Log warning if dimensions were adjusted
  if (validCols !== cols || validRows !== rows) {
    console.warn(`[PTY] Terminal size ${cols}x${rows} is too small, using minimum ${validCols}x${validRows}`);
  }

  return { cols: validCols, rows: validRows };
}
