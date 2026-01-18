import {
  countPanes,
  createGridWithPane,
  findNextPaneAfterClose as findNextPaneAfterCloseGrid,
  getAllPanes as getAllPanesGrid,
  removePane as removePaneGrid,
  resizeColDivider,
  resizeRowDivider,
  splitPane as splitPaneGrid,
  updateColWidths,
  updatePaneSession as updatePaneSessionGrid,
  updateRowHeights,
  type GridPane,
  type PaneGrid,
  type SplitDirection,
} from "@/lib/paneGrid";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// ============== Types ==============

/** Pane state for a single tab */
export interface TabPaneState {
  grid: PaneGrid;
  activePaneId: string;
}

// Compatibility type: GridPane is compatible with PaneLeaf for API compatibility
export type PaneLeaf = GridPane;

interface PaneContextValue {
  /** Get pane state for a tab */
  getPaneState: (tabId: string) => TabPaneState | undefined;

  /** Get the pane grid for a tab (returns null for compatibility with old API) */
  getPaneTree: (tabId: string) => null; // Deprecated: kept for API compatibility

  /** Get the pane grid for a tab */
  getPaneGrid: (tabId: string) => PaneGrid | null;

  /** Get the active pane ID for a tab */
  getActivePaneId: (tabId: string) => string | null;

  /** Get all panes for a tab */
  getAllPanes: (tabId: string) => GridPane[];

  /** Get pane count for a tab */
  getPaneCount: (tabId: string) => number;

  /** Initialize panes for a new tab */
  initializeTabPanes: (tabId: string) => string;

  /** Clean up panes when a tab is closed */
  cleanupTabPanes: (tabId: string) => void;

  /** Split a pane in a direction */
  splitPane: (tabId: string, paneId: string, direction: SplitDirection) => string | null;

  /** Close a pane */
  closePane: (tabId: string, paneId: string) => boolean;

  /** Set the active pane for a tab */
  setActivePane: (tabId: string, paneId: string) => void;

  /** Update a pane's session ID */
  updatePaneSessionId: (tabId: string, paneId: string, sessionId: string) => void;

  /** Update row heights (for grid resizing) */
  updateRowHeights: (tabId: string, rowIndex: number, newHeight: number) => void;

  /** Update column widths (for grid resizing) */
  updateColWidths: (tabId: string, colIndex: number, newWidth: number) => void;

  /** Resize row divider (between two rows) */
  resizeRowDivider: (tabId: string, dividerIndex: number, newTotalRatio: number) => void;

  /** Resize column divider (between two columns) */
  resizeColDivider: (tabId: string, dividerIndex: number, newTotalRatio: number) => void;
}

// ============== Context ==============

const PaneContext = createContext<PaneContextValue | null>(null);

// ============== Provider ==============

export function PaneProvider({ children }: { children: ReactNode }) {
  // Map of tabId -> TabPaneState
  const [paneStates, setPaneStates] = useState<Map<string, TabPaneState>>(new Map());

  const getPaneState = useCallback((tabId: string) => paneStates.get(tabId), [paneStates]);

  const getPaneTree = useCallback(() => {
    // Deprecated: kept for API compatibility, always returns null
    return null;
  }, []);

  const getPaneGrid = useCallback(
    (tabId: string) => paneStates.get(tabId)?.grid ?? null,
    [paneStates]
  );

  const getActivePaneId = useCallback(
    (tabId: string) => paneStates.get(tabId)?.activePaneId ?? null,
    [paneStates]
  );

  const getAllPanes = useCallback(
    (tabId: string) => {
      const state = paneStates.get(tabId);
      return state ? getAllPanesGrid(state.grid) : [];
    },
    [paneStates]
  );

  const getPaneCount = useCallback(
    (tabId: string) => {
      const state = paneStates.get(tabId);
      return state ? countPanes(state.grid) : 0;
    },
    [paneStates]
  );

  const initializeTabPanes = useCallback((tabId: string) => {
    const grid = createGridWithPane();
    const initialPaneId = Array.from(grid.panes.values())[0].id;
    setPaneStates((prev) => {
      const next = new Map(prev);
      next.set(tabId, {
        grid,
        activePaneId: initialPaneId,
      });
      return next;
    });
    return initialPaneId;
  }, []);

  const cleanupTabPanes = useCallback((tabId: string) => {
    setPaneStates((prev) => {
      const next = new Map(prev);
      next.delete(tabId);
      return next;
    });
  }, []);

  const splitPaneAction = useCallback(
    (tabId: string, paneId: string, direction: SplitDirection) => {
      let newPaneId: string | null = null;

      setPaneStates((prev) => {
        const state = prev.get(tabId);
        if (!state) {
          console.warn(`[PaneContext] Cannot split pane: tab ${tabId} not found`);
          return prev;
        }

        const result = splitPaneGrid(state.grid, paneId, direction);
        if (!result) {
          console.warn(`[PaneContext] Failed to split pane ${paneId} in tab ${tabId}`);
          return prev;
        }

        newPaneId = result.newPaneId;
        const next = new Map(prev);
        next.set(tabId, {
          grid: result.grid,
          activePaneId: result.newPaneId, // Focus the new pane
        });
        return next;
      });

      return newPaneId;
    },
    []
  );

  const closePaneAction = useCallback((tabId: string, paneId: string) => {
    let success = false;

    setPaneStates((prev) => {
      const state = prev.get(tabId);
      if (!state) {
        console.warn(`[PaneContext] Cannot close pane: tab ${tabId} not found`);
        return prev;
      }

      // Find next pane to focus before removing
      const nextPaneId = findNextPaneAfterCloseGrid(state.grid, paneId);

      const newGrid = removePaneGrid(state.grid, paneId);
      if (newGrid === null) {
        console.warn(`[PaneContext] Cannot remove last pane ${paneId} in tab ${tabId}`);
        return prev;
      }

      if (newGrid === state.grid) {
        console.warn(`[PaneContext] Pane ${paneId} not found in tab ${tabId}`);
        return prev;
      }

      success = true;
      const next = new Map(prev);
      next.set(tabId, {
        grid: newGrid,
        activePaneId: nextPaneId ?? state.activePaneId,
      });
      return next;
    });

    return success;
  }, []);

  const setActivePane = useCallback((tabId: string, paneId: string) => {
    setPaneStates((prev) => {
      const state = prev.get(tabId);
      if (!state || state.activePaneId === paneId) return prev;

      const next = new Map(prev);
      next.set(tabId, {
        ...state,
        activePaneId: paneId,
      });
      return next;
    });
  }, []);

  const updatePaneSessionIdAction = useCallback(
    (tabId: string, paneId: string, sessionId: string) => {
      setPaneStates((prev) => {
        const state = prev.get(tabId);
        if (!state) return prev;

        const newGrid = updatePaneSessionGrid(state.grid, paneId, sessionId);
        if (newGrid === state.grid) return prev;

        const next = new Map(prev);
        next.set(tabId, {
          ...state,
          grid: newGrid,
        });
        return next;
      });
    },
    []
  );

  const updateRowHeightsAction = useCallback(
    (tabId: string, rowIndex: number, newHeight: number) => {
      setPaneStates((prev) => {
        const state = prev.get(tabId);
        if (!state) return prev;

        const newGrid = updateRowHeights(state.grid, rowIndex, newHeight);
        if (newGrid === state.grid) return prev;

        const next = new Map(prev);
        next.set(tabId, {
          ...state,
          grid: newGrid,
        });
        return next;
      });
    },
    []
  );

  const updateColWidthsAction = useCallback((tabId: string, colIndex: number, newWidth: number) => {
    setPaneStates((prev) => {
      const state = prev.get(tabId);
      if (!state) return prev;

      const newGrid = updateColWidths(state.grid, colIndex, newWidth);
      if (newGrid === state.grid) return prev;

      const next = new Map(prev);
      next.set(tabId, {
        ...state,
        grid: newGrid,
      });
      return next;
    });
  }, []);

  const resizeRowDividerAction = useCallback(
    (tabId: string, dividerIndex: number, newTotalRatio: number) => {
      setPaneStates((prev) => {
        const state = prev.get(tabId);
        if (!state) return prev;

        const newGrid = resizeRowDivider(state.grid, dividerIndex, newTotalRatio);
        if (newGrid === state.grid) return prev;

        const next = new Map(prev);
        next.set(tabId, {
          ...state,
          grid: newGrid,
        });
        return next;
      });
    },
    []
  );

  const resizeColDividerAction = useCallback(
    (tabId: string, dividerIndex: number, newTotalRatio: number) => {
      setPaneStates((prev) => {
        const state = prev.get(tabId);
        if (!state) return prev;

        const newGrid = resizeColDivider(state.grid, dividerIndex, newTotalRatio);
        if (newGrid === state.grid) return prev;

        const next = new Map(prev);
        next.set(tabId, {
          ...state,
          grid: newGrid,
        });
        return next;
      });
    },
    []
  );

  const value = useMemo<PaneContextValue>(
    () => ({
      getPaneState,
      getPaneTree,
      getPaneGrid,
      getActivePaneId,
      getAllPanes,
      getPaneCount,
      initializeTabPanes,
      cleanupTabPanes,
      splitPane: splitPaneAction,
      closePane: closePaneAction,
      setActivePane,
      updatePaneSessionId: updatePaneSessionIdAction,
      updateRowHeights: updateRowHeightsAction,
      updateColWidths: updateColWidthsAction,
      resizeRowDivider: resizeRowDividerAction,
      resizeColDivider: resizeColDividerAction,
    }),
    [
      getPaneState,
      getPaneTree,
      getPaneGrid,
      getActivePaneId,
      getAllPanes,
      getPaneCount,
      initializeTabPanes,
      cleanupTabPanes,
      splitPaneAction,
      closePaneAction,
      setActivePane,
      updatePaneSessionIdAction,
      updateRowHeightsAction,
      updateColWidthsAction,
      resizeRowDividerAction,
      resizeColDividerAction,
    ]
  );

  return <PaneContext.Provider value={value}>{children}</PaneContext.Provider>;
}

// ============== Hook ==============

export function usePaneContext(): PaneContextValue {
  const context = useContext(PaneContext);
  if (!context) {
    throw new Error("usePaneContext must be used within a PaneProvider");
  }
  return context;
}
