/**
 * Pane Tree Utilities
 *
 * Binary tree data structure for managing split terminal panes.
 * - Leaf nodes contain actual terminal panes with PTY sessions
 * - Branch nodes represent split containers with direction and two children
 */

import { DEFAULT_SPLIT_RATIO } from "./constants";

// ============== Types ==============

/** Direction of the split */
export type SplitDirection = "horizontal" | "vertical";

/** Base pane node with common properties */
interface PaneNodeBase {
  id: string;
}

/** Leaf pane - contains actual terminal */
export interface PaneLeaf extends PaneNodeBase {
  type: "leaf";
  sessionId: string | null;
}

/** Branch pane - contains two children */
export interface PaneBranch extends PaneNodeBase {
  type: "branch";
  direction: SplitDirection;
  /** Ratio of first child (0.0 - 1.0), second child gets remainder */
  ratio: number;
  first: PaneNode;
  second: PaneNode;
}

/** Union type for all pane nodes */
export type PaneNode = PaneLeaf | PaneBranch;

// ============== ID Generation ==============

/** Generate a unique pane ID */
export function generatePaneId(): string {
  return `pane-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============== Node Creation ==============

/** Create a new leaf pane */
export function createLeafPane(id?: string): PaneLeaf {
  return {
    id: id ?? generatePaneId(),
    type: "leaf",
    sessionId: null,
  };
}

/** Create a new branch pane */
export function createBranchPane(
  direction: SplitDirection,
  first: PaneNode,
  second: PaneNode,
  ratio = DEFAULT_SPLIT_RATIO
): PaneBranch {
  return {
    id: generatePaneId(),
    type: "branch",
    direction,
    ratio,
    first,
    second,
  };
}

// ============== Tree Queries ==============

/** Type guard to check if a node is a leaf */
export function isLeaf(node: PaneNode): node is PaneLeaf {
  return node.type === "leaf";
}

/** Type guard to check if a node is a branch */
export function isBranch(node: PaneNode): node is PaneBranch {
  return node.type === "branch";
}

/** Find a pane by ID in the tree */
export function findPaneById(tree: PaneNode, paneId: string): PaneLeaf | null {
  if (isLeaf(tree)) {
    return tree.id === paneId ? tree : null;
  }

  return findPaneById(tree.first, paneId) ?? findPaneById(tree.second, paneId);
}

/** Find a branch by ID in the tree */
export function findBranchById(tree: PaneNode, branchId: string): PaneBranch | null {
  if (isLeaf(tree)) {
    return null;
  }

  if (tree.id === branchId) {
    return tree;
  }

  return findBranchById(tree.first, branchId) ?? findBranchById(tree.second, branchId);
}

/** Get all leaf panes in the tree */
export function getAllLeaves(tree: PaneNode): PaneLeaf[] {
  if (isLeaf(tree)) {
    return [tree];
  }

  return [...getAllLeaves(tree.first), ...getAllLeaves(tree.second)];
}

/** Count total leaves in the tree */
export function countLeaves(tree: PaneNode): number {
  if (isLeaf(tree)) {
    return 1;
  }

  return countLeaves(tree.first) + countLeaves(tree.second);
}

// ============== Tree Mutations ==============

/**
 * Split a pane into two panes.
 * The original pane becomes the first child, a new pane becomes the second.
 * Returns the new tree and the ID of the newly created pane.
 */
export function splitPane(
  tree: PaneNode,
  paneId: string,
  direction: SplitDirection
): { tree: PaneNode; newPaneId: string } | null {
  const newPane = createLeafPane();
  let newTree = splitPaneNode(tree, paneId, direction, newPane);

  if (!newTree) {
    return null;
  }

  // Rebalance ratios to distribute space evenly in the split direction
  newTree = rebalanceTree(newTree, direction);

  return { tree: newTree, newPaneId: newPane.id };
}

/** Internal recursive split implementation */
function splitPaneNode(
  node: PaneNode,
  paneId: string,
  direction: SplitDirection,
  newPane: PaneLeaf
): PaneNode | null {
  if (isLeaf(node)) {
    if (node.id === paneId) {
      // Found the pane to split - replace leaf with branch
      return createBranchPane(direction, node, newPane);
    }
    return null; // Not the pane we're looking for
  }

  // Try splitting in first child
  const newFirst = splitPaneNode(node.first, paneId, direction, newPane);
  if (newFirst) {
    return { ...node, first: newFirst };
  }

  // Try splitting in second child
  const newSecond = splitPaneNode(node.second, paneId, direction, newPane);
  if (newSecond) {
    return { ...node, second: newSecond };
  }

  return null;
}

/**
 * Remove a pane from the tree.
 * If the pane's sibling is the only remaining child, it replaces the parent branch.
 * Returns null if the pane is the root (can't remove the last pane).
 */
export function removePane(tree: PaneNode, paneId: string): PaneNode | null {
  // Can't remove if tree is a single leaf
  if (isLeaf(tree)) {
    return tree.id === paneId ? null : tree;
  }

  // Check if target is in first child
  if (isLeaf(tree.first) && tree.first.id === paneId) {
    // Remove first child, return second child (collapse the branch)
    return tree.second;
  }

  // Check if target is in second child
  if (isLeaf(tree.second) && tree.second.id === paneId) {
    // Remove second child, return first child (collapse the branch)
    return tree.first;
  }

  // Recurse into children
  if (isBranch(tree.first)) {
    const newFirst = removePane(tree.first, paneId);
    if (newFirst !== tree.first) {
      // Pane was removed from first subtree
      if (newFirst === null) {
        // First subtree is now empty, return second
        return tree.second;
      }
      return { ...tree, first: newFirst };
    }
  }

  if (isBranch(tree.second)) {
    const newSecond = removePane(tree.second, paneId);
    if (newSecond !== tree.second) {
      // Pane was removed from second subtree
      if (newSecond === null) {
        // Second subtree is now empty, return first
        return tree.first;
      }
      return { ...tree, second: newSecond };
    }
  }

  // Pane not found in this subtree
  return tree;
}

/**
 * Update the ratio of a branch node.
 * Returns a new tree with the updated ratio.
 */
export function updateBranchRatio(
  tree: PaneNode,
  branchId: string,
  newRatio: number
): PaneNode {
  if (isLeaf(tree)) {
    return tree;
  }

  if (tree.id === branchId) {
    return { ...tree, ratio: newRatio };
  }

  const newFirst = updateBranchRatio(tree.first, branchId, newRatio);
  const newSecond = updateBranchRatio(tree.second, branchId, newRatio);

  if (newFirst !== tree.first || newSecond !== tree.second) {
    return { ...tree, first: newFirst, second: newSecond };
  }

  return tree;
}

/**
 * Update a pane's session ID.
 * Returns a new tree with the updated session ID.
 */
export function updatePaneSession(
  tree: PaneNode,
  paneId: string,
  sessionId: string
): PaneNode {
  if (isLeaf(tree)) {
    if (tree.id === paneId) {
      return { ...tree, sessionId };
    }
    return tree;
  }

  const newFirst = updatePaneSession(tree.first, paneId, sessionId);
  const newSecond = updatePaneSession(tree.second, paneId, sessionId);

  if (newFirst !== tree.first || newSecond !== tree.second) {
    return { ...tree, first: newFirst, second: newSecond };
  }

  return tree;
}

/**
 * Find the next pane to focus after closing a pane.
 * Returns the sibling if available, otherwise the first leaf in the tree.
 */
export function findNextPaneAfterClose(
  tree: PaneNode,
  closedPaneId: string
): string | null {
  // Find the sibling of the pane being closed
  const sibling = findSibling(tree, closedPaneId);
  if (sibling) {
    // If sibling is a branch, get its first leaf
    if (isBranch(sibling)) {
      const leaves = getAllLeaves(sibling);
      return leaves[0]?.id ?? null;
    }
    return sibling.id;
  }

  // Fallback: get any remaining leaf
  const leaves = getAllLeaves(tree).filter((l) => l.id !== closedPaneId);
  return leaves[0]?.id ?? null;
}

/** Find the sibling of a pane (the other child of its parent branch) */
function findSibling(tree: PaneNode, paneId: string): PaneNode | null {
  if (isLeaf(tree)) {
    return null;
  }

  // Check if pane is a direct child
  if (isLeaf(tree.first) && tree.first.id === paneId) {
    return tree.second;
  }
  if (isLeaf(tree.second) && tree.second.id === paneId) {
    return tree.first;
  }

  // Recurse into children
  return findSibling(tree.first, paneId) ?? findSibling(tree.second, paneId);
}

/**
 * Rebalance the tree to distribute space evenly among panes in the same direction.
 * This ensures that when you have multiple splits in the same direction,
 * each pane gets an equal share of space.
 */
function rebalanceTree(node: PaneNode, direction: SplitDirection): PaneNode {
  if (isLeaf(node)) {
    return node;
  }

  // If this branch matches the target direction, calculate even distribution
  if (node.direction === direction) {
    // Count consecutive panes in this direction
    const paneCount = countConsecutivePanes(node, direction);

    if (paneCount > 1) {
      // Rebalance this subtree with even ratios
      return rebalanceSubtree(node, direction, paneCount);
    }
  }

  // Recursively rebalance children
  return {
    ...node,
    first: rebalanceTree(node.first, direction),
    second: rebalanceTree(node.second, direction),
  };
}

/**
 * Count consecutive panes in the same direction.
 * For example, if we have: (A | B) | C in horizontal direction, this returns 3.
 */
function countConsecutivePanes(node: PaneNode, direction: SplitDirection): number {
  if (isLeaf(node)) {
    return 1;
  }

  if (node.direction !== direction) {
    return 1; // Different direction, count as single unit
  }

  // Same direction, count both sides
  return (
    countConsecutivePanes(node.first, direction) +
    countConsecutivePanes(node.second, direction)
  );
}

/**
 * Rebalance a subtree with consecutive panes in the same direction.
 * Adjusts ratios so each pane gets equal space.
 */
function rebalanceSubtree(
  node: PaneBranch,
  direction: SplitDirection,
  totalPanes: number
): PaneNode {
  // Calculate how many panes are on the left side
  const leftPanes = countConsecutivePanes(node.first, direction);

  // The ratio should be leftPanes / totalPanes
  const newRatio = leftPanes / totalPanes;

  // Recursively rebalance children if they're also branches in the same direction
  let newFirst = node.first;
  let newSecond = node.second;

  if (isBranch(node.first) && node.first.direction === direction) {
    newFirst = rebalanceSubtree(node.first, direction, leftPanes);
  }

  if (isBranch(node.second) && node.second.direction === direction) {
    const rightPanes = totalPanes - leftPanes;
    newSecond = rebalanceSubtree(node.second, direction, rightPanes);
  }

  return {
    ...node,
    ratio: newRatio,
    first: newFirst,
    second: newSecond,
  };
}
