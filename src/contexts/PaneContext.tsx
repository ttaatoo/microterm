import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  createLeafPane,
  splitPane,
  removePane,
  updateBranchRatio,
  updatePaneSession,
  findNextPaneAfterClose,
  getAllLeaves,
  countLeaves,
  type PaneNode,
  type PaneLeaf,
  type SplitDirection,
} from "@/lib/paneTree";

// ============== Types ==============

/** Pane state for a single tab */
export interface TabPaneState {
  root: PaneNode;
  activePaneId: string;
}

interface PaneContextValue {
  /** Get pane state for a tab */
  getPaneState: (tabId: string) => TabPaneState | undefined;

  /** Get the pane tree for a tab */
  getPaneTree: (tabId: string) => PaneNode | null;

  /** Get the active pane ID for a tab */
  getActivePaneId: (tabId: string) => string | null;

  /** Get all leaf panes for a tab */
  getAllPanes: (tabId: string) => PaneLeaf[];

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

  /** Update a branch's split ratio */
  resizeSplit: (tabId: string, branchId: string, newRatio: number) => void;

  /**
   * Register a callback to control terminal layout during split operations.
   * The callback receives pane IDs and should disable/enable layout on those terminals.
   */
  registerLayoutController: (controller: (tabId: string, paneIds: string[], disable: boolean) => void) => void;
}

// ============== Context ==============

const PaneContext = createContext<PaneContextValue | null>(null);

// ============== Provider ==============

export function PaneProvider({ children }: { children: ReactNode }) {
  // Map of tabId -> TabPaneState
  const [paneStates, setPaneStates] = useState<Map<string, TabPaneState>>(new Map());

  // Layout controller callback (provided by TerminalView)
  const layoutControllerRef = useRef<((tabId: string, paneIds: string[], disable: boolean) => void) | null>(null);

  const getPaneState = useCallback(
    (tabId: string) => paneStates.get(tabId),
    [paneStates]
  );

  const getPaneTree = useCallback(
    (tabId: string) => paneStates.get(tabId)?.root ?? null,
    [paneStates]
  );

  const getActivePaneId = useCallback(
    (tabId: string) => paneStates.get(tabId)?.activePaneId ?? null,
    [paneStates]
  );

  const getAllPanes = useCallback(
    (tabId: string) => {
      const state = paneStates.get(tabId);
      return state ? getAllLeaves(state.root) : [];
    },
    [paneStates]
  );

  const getPaneCount = useCallback(
    (tabId: string) => {
      const state = paneStates.get(tabId);
      return state ? countLeaves(state.root) : 0;
    },
    [paneStates]
  );

  const initializeTabPanes = useCallback((tabId: string) => {
    const initialPane = createLeafPane();
    setPaneStates((prev) => {
      const next = new Map(prev);
      next.set(tabId, {
        root: initialPane,
        activePaneId: initialPane.id,
      });
      return next;
    });
    return initialPane.id;
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

      // Get existing pane IDs before split
      const state = paneStates.get(tabId);
      if (!state) {
        console.warn(`[PaneContext] Cannot split pane: tab ${tabId} not found`);
        return null;
      }

      const existingPanes = getAllLeaves(state.root);
      const existingPaneIds = existingPanes.map(p => p.id);

      // Disable layout for existing terminals during split operation
      // This prevents scroll position jumps caused by resize operations
      if (layoutControllerRef.current) {
        layoutControllerRef.current(tabId, existingPaneIds, true);
      }

      setPaneStates((prev) => {
        const state = prev.get(tabId);
        if (!state) {
          console.warn(`[PaneContext] Cannot split pane: tab ${tabId} not found`);
          return prev;
        }

        const result = splitPane(state.root, paneId, direction);
        if (!result) {
          console.warn(`[PaneContext] Failed to split pane ${paneId} in tab ${tabId}`);
          return prev;
        }

        newPaneId = result.newPaneId;
        const next = new Map(prev);
        next.set(tabId, {
          root: result.tree,
          activePaneId: result.newPaneId, // Focus the new pane
        });
        return next;
      });

      // Re-enable layout after split operation completes
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (layoutControllerRef.current) {
          layoutControllerRef.current(tabId, existingPaneIds, false);
        }
      });

      return newPaneId;
    },
    [paneStates]
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
      const nextPaneId = findNextPaneAfterClose(state.root, paneId);

      const newTree = removePane(state.root, paneId);
      if (newTree === null) {
        console.warn(`[PaneContext] Cannot remove last pane ${paneId} in tab ${tabId}`);
        return prev;
      }

      if (newTree === state.root) {
        console.warn(`[PaneContext] Pane ${paneId} not found in tab ${tabId}`);
        return prev;
      }

      success = true;
      const next = new Map(prev);
      next.set(tabId, {
        root: newTree,
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

        const newTree = updatePaneSession(state.root, paneId, sessionId);
        if (newTree === state.root) return prev;

        const next = new Map(prev);
        next.set(tabId, {
          ...state,
          root: newTree,
        });
        return next;
      });
    },
    []
  );

  const resizeSplit = useCallback((tabId: string, branchId: string, newRatio: number) => {
    setPaneStates((prev) => {
      const state = prev.get(tabId);
      if (!state) return prev;

      const newTree = updateBranchRatio(state.root, branchId, newRatio);
      if (newTree === state.root) return prev;

      const next = new Map(prev);
      next.set(tabId, {
        ...state,
        root: newTree,
      });
      return next;
    });
  }, []);

  const registerLayoutController = useCallback(
    (controller: (tabId: string, paneIds: string[], disable: boolean) => void) => {
      layoutControllerRef.current = controller;
    },
    []
  );

  const value = useMemo<PaneContextValue>(
    () => ({
      getPaneState,
      getPaneTree,
      getActivePaneId,
      getAllPanes,
      getPaneCount,
      initializeTabPanes,
      cleanupTabPanes,
      splitPane: splitPaneAction,
      closePane: closePaneAction,
      setActivePane,
      updatePaneSessionId: updatePaneSessionIdAction,
      resizeSplit,
      registerLayoutController,
    }),
    [
      getPaneState,
      getPaneTree,
      getActivePaneId,
      getAllPanes,
      getPaneCount,
      initializeTabPanes,
      cleanupTabPanes,
      splitPaneAction,
      closePaneAction,
      setActivePane,
      updatePaneSessionIdAction,
      resizeSplit,
      registerLayoutController,
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
