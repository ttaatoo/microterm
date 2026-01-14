import { describe, it, expect } from "vitest";
import {
  createLeafPane,
  createBranchPane,
  isLeaf,
  isBranch,
  findPaneById,
  findBranchById,
  getAllLeaves,
  countLeaves,
  splitPane,
  removePane,
  updateBranchRatio,
  updatePaneSession,
  findNextPaneAfterClose,
  type PaneLeaf,
  type PaneBranch,
  type PaneNode,
} from "./paneTree";

describe("paneTree", () => {
  describe("createLeafPane", () => {
    it("should create a leaf with generated id", () => {
      const leaf = createLeafPane();
      expect(leaf.type).toBe("leaf");
      expect(leaf.id).toMatch(/^pane-/);
      expect(leaf.sessionId).toBeNull();
    });

    it("should create a leaf with custom id", () => {
      const leaf = createLeafPane("custom-id");
      expect(leaf.id).toBe("custom-id");
    });
  });

  describe("createBranchPane", () => {
    it("should create a branch with two children", () => {
      const first = createLeafPane("first");
      const second = createLeafPane("second");
      const branch = createBranchPane("vertical", first, second);

      expect(branch.type).toBe("branch");
      expect(branch.direction).toBe("vertical");
      expect(branch.ratio).toBe(0.5);
      expect(branch.first).toBe(first);
      expect(branch.second).toBe(second);
    });

    it("should accept custom ratio", () => {
      const first = createLeafPane("first");
      const second = createLeafPane("second");
      const branch = createBranchPane("horizontal", first, second, 0.3);

      expect(branch.ratio).toBe(0.3);
    });
  });

  describe("isLeaf / isBranch", () => {
    it("should identify leaf nodes", () => {
      const leaf = createLeafPane();
      expect(isLeaf(leaf)).toBe(true);
      expect(isBranch(leaf)).toBe(false);
    });

    it("should identify branch nodes", () => {
      const branch = createBranchPane(
        "vertical",
        createLeafPane(),
        createLeafPane()
      );
      expect(isLeaf(branch)).toBe(false);
      expect(isBranch(branch)).toBe(true);
    });
  });

  describe("findPaneById", () => {
    it("should find a leaf in a single-node tree", () => {
      const leaf = createLeafPane("target");
      const found = findPaneById(leaf, "target");
      expect(found).toBe(leaf);
    });

    it("should find a leaf in the first child", () => {
      const target = createLeafPane("target");
      const tree = createBranchPane("vertical", target, createLeafPane("other"));
      const found = findPaneById(tree, "target");
      expect(found).toBe(target);
    });

    it("should find a leaf in the second child", () => {
      const target = createLeafPane("target");
      const tree = createBranchPane("vertical", createLeafPane("other"), target);
      const found = findPaneById(tree, "target");
      expect(found).toBe(target);
    });

    it("should find a leaf in nested branches", () => {
      const target = createLeafPane("target");
      const innerBranch = createBranchPane("horizontal", createLeafPane("a"), target);
      const tree = createBranchPane("vertical", createLeafPane("b"), innerBranch);
      const found = findPaneById(tree, "target");
      expect(found).toBe(target);
    });

    it("should return null for non-existent id", () => {
      const tree = createBranchPane(
        "vertical",
        createLeafPane("a"),
        createLeafPane("b")
      );
      expect(findPaneById(tree, "non-existent")).toBeNull();
    });
  });

  describe("findBranchById", () => {
    it("should return null for a leaf tree", () => {
      const leaf = createLeafPane();
      expect(findBranchById(leaf, "any-id")).toBeNull();
    });

    it("should find root branch", () => {
      const branch = createBranchPane(
        "vertical",
        createLeafPane(),
        createLeafPane()
      );
      const found = findBranchById(branch, branch.id);
      expect(found).toBe(branch);
    });

    it("should find nested branch", () => {
      const innerBranch = createBranchPane(
        "horizontal",
        createLeafPane(),
        createLeafPane()
      );
      const tree = createBranchPane("vertical", createLeafPane(), innerBranch);
      const found = findBranchById(tree, innerBranch.id);
      expect(found).toBe(innerBranch);
    });
  });

  describe("getAllLeaves", () => {
    it("should return single leaf", () => {
      const leaf = createLeafPane("only");
      const leaves = getAllLeaves(leaf);
      expect(leaves).toHaveLength(1);
      expect(leaves[0]).toBe(leaf);
    });

    it("should return all leaves from a branch", () => {
      const first = createLeafPane("first");
      const second = createLeafPane("second");
      const tree = createBranchPane("vertical", first, second);
      const leaves = getAllLeaves(tree);
      expect(leaves).toHaveLength(2);
      expect(leaves).toContain(first);
      expect(leaves).toContain(second);
    });

    it("should return all leaves from nested structure", () => {
      const a = createLeafPane("a");
      const b = createLeafPane("b");
      const c = createLeafPane("c");
      const d = createLeafPane("d");
      const inner1 = createBranchPane("horizontal", a, b);
      const inner2 = createBranchPane("horizontal", c, d);
      const tree = createBranchPane("vertical", inner1, inner2);
      const leaves = getAllLeaves(tree);
      expect(leaves).toHaveLength(4);
      expect(leaves.map((l) => l.id).sort()).toEqual(["a", "b", "c", "d"]);
    });
  });

  describe("countLeaves", () => {
    it("should count 1 for single leaf", () => {
      expect(countLeaves(createLeafPane())).toBe(1);
    });

    it("should count leaves in branch", () => {
      const tree = createBranchPane(
        "vertical",
        createLeafPane(),
        createLeafPane()
      );
      expect(countLeaves(tree)).toBe(2);
    });

    it("should count leaves in nested structure", () => {
      const inner = createBranchPane("horizontal", createLeafPane(), createLeafPane());
      const tree = createBranchPane("vertical", inner, createLeafPane());
      expect(countLeaves(tree)).toBe(3);
    });
  });

  describe("splitPane", () => {
    it("should split a single leaf into a branch", () => {
      const original = createLeafPane("original");
      const result = splitPane(original, "original", "vertical");

      expect(result).not.toBeNull();
      expect(isBranch(result!.tree)).toBe(true);

      const branch = result!.tree as PaneBranch;
      expect(branch.direction).toBe("vertical");
      expect((branch.first as PaneLeaf).id).toBe("original");
      expect(branch.second.type).toBe("leaf");
      expect(result!.newPaneId).toBe((branch.second as PaneLeaf).id);
    });

    it("should split a pane within a branch", () => {
      const target = createLeafPane("target");
      const tree = createBranchPane("vertical", target, createLeafPane("other"));
      const result = splitPane(tree, "target", "horizontal");

      expect(result).not.toBeNull();
      const newTree = result!.tree as PaneBranch;

      // Root should still be vertical
      expect(newTree.direction).toBe("vertical");

      // First child should now be a horizontal branch
      expect(isBranch(newTree.first)).toBe(true);
      const innerBranch = newTree.first as PaneBranch;
      expect(innerBranch.direction).toBe("horizontal");
    });

    it("should return null for non-existent pane", () => {
      const tree = createLeafPane("only");
      const result = splitPane(tree, "non-existent", "vertical");
      expect(result).toBeNull();
    });
  });

  describe("removePane", () => {
    it("should return null when removing the only pane", () => {
      const leaf = createLeafPane("only");
      const result = removePane(leaf, "only");
      expect(result).toBeNull();
    });

    it("should return tree unchanged for non-existent pane", () => {
      const leaf = createLeafPane("only");
      const result = removePane(leaf, "non-existent");
      expect(result).toBe(leaf);
    });

    it("should collapse branch when removing first child", () => {
      const first = createLeafPane("first");
      const second = createLeafPane("second");
      const tree = createBranchPane("vertical", first, second);
      const result = removePane(tree, "first");

      expect(result).not.toBeNull();
      expect(isLeaf(result!)).toBe(true);
      expect((result as PaneLeaf).id).toBe("second");
    });

    it("should collapse branch when removing second child", () => {
      const first = createLeafPane("first");
      const second = createLeafPane("second");
      const tree = createBranchPane("vertical", first, second);
      const result = removePane(tree, "second");

      expect(result).not.toBeNull();
      expect(isLeaf(result!)).toBe(true);
      expect((result as PaneLeaf).id).toBe("first");
    });

    it("should handle nested removal", () => {
      // Structure: root(vertical) -> [inner(horizontal) -> [a, b], c]
      const a = createLeafPane("a");
      const b = createLeafPane("b");
      const c = createLeafPane("c");
      const inner = createBranchPane("horizontal", a, b);
      const tree = createBranchPane("vertical", inner, c);

      // Remove 'a', inner should collapse to 'b'
      const result = removePane(tree, "a");

      expect(result).not.toBeNull();
      expect(isBranch(result!)).toBe(true);
      const newRoot = result as PaneBranch;
      expect(isLeaf(newRoot.first)).toBe(true);
      expect((newRoot.first as PaneLeaf).id).toBe("b");
    });
  });

  describe("updateBranchRatio", () => {
    it("should update the ratio of a branch", () => {
      const branch = createBranchPane(
        "vertical",
        createLeafPane(),
        createLeafPane()
      );
      const updated = updateBranchRatio(branch, branch.id, 0.7);

      expect(isBranch(updated)).toBe(true);
      expect((updated as PaneBranch).ratio).toBe(0.7);
    });

    it("should return unchanged tree for non-existent branch", () => {
      const tree = createLeafPane();
      const result = updateBranchRatio(tree, "non-existent", 0.5);
      expect(result).toBe(tree);
    });

    it("should update nested branch ratio", () => {
      const inner = createBranchPane("horizontal", createLeafPane(), createLeafPane());
      const tree = createBranchPane("vertical", createLeafPane(), inner);
      const updated = updateBranchRatio(tree, inner.id, 0.3);

      const newTree = updated as PaneBranch;
      const newInner = newTree.second as PaneBranch;
      expect(newInner.ratio).toBe(0.3);
    });
  });

  describe("updatePaneSession", () => {
    it("should update session id of a leaf", () => {
      const leaf = createLeafPane("target");
      const updated = updatePaneSession(leaf, "target", "session-123");

      expect(isLeaf(updated)).toBe(true);
      expect((updated as PaneLeaf).sessionId).toBe("session-123");
    });

    it("should return unchanged for non-existent pane", () => {
      const leaf = createLeafPane("target");
      const result = updatePaneSession(leaf, "non-existent", "session-123");
      expect(result).toBe(leaf);
    });

    it("should update nested pane session", () => {
      const target = createLeafPane("target");
      const tree = createBranchPane("vertical", target, createLeafPane("other"));
      const updated = updatePaneSession(tree, "target", "session-456");

      const newTree = updated as PaneBranch;
      expect((newTree.first as PaneLeaf).sessionId).toBe("session-456");
    });
  });

  describe("findNextPaneAfterClose", () => {
    it("should return sibling when closing one of two panes", () => {
      const a = createLeafPane("a");
      const b = createLeafPane("b");
      const tree = createBranchPane("vertical", a, b);

      expect(findNextPaneAfterClose(tree, "a")).toBe("b");
      expect(findNextPaneAfterClose(tree, "b")).toBe("a");
    });

    it("should return first leaf of sibling branch", () => {
      const a = createLeafPane("a");
      const b = createLeafPane("b");
      const c = createLeafPane("c");
      const inner = createBranchPane("horizontal", b, c);
      const tree = createBranchPane("vertical", a, inner);

      // When closing 'a', should return first leaf of inner branch ('b')
      expect(findNextPaneAfterClose(tree, "a")).toBe("b");
    });

    it("should return any remaining leaf when nested", () => {
      const a = createLeafPane("a");
      const b = createLeafPane("b");
      const c = createLeafPane("c");
      const inner = createBranchPane("horizontal", a, b);
      const tree = createBranchPane("vertical", inner, c);

      // When closing 'a', inner branch will collapse to 'b', so 'b' should be returned
      expect(findNextPaneAfterClose(tree, "a")).toBe("b");
    });

    it("should return null for single pane tree", () => {
      const leaf = createLeafPane("only");
      expect(findNextPaneAfterClose(leaf, "only")).toBeNull();
    });
  });

  describe("even distribution in same direction", () => {
    it("should split two horizontal panes evenly (33% / 33% / 33%)", () => {
      // Start: A
      const a = createLeafPane("a");

      // Split horizontally: A | B
      const step1 = splitPane(a, "a", "horizontal");
      expect(step1).not.toBeNull();

      const tree1 = step1!.tree as PaneBranch;
      expect(tree1.ratio).toBeCloseTo(0.5, 5); // 50/50

      // Split B horizontally: A | B | C
      const step2 = splitPane(tree1, step1!.newPaneId, "horizontal");
      expect(step2).not.toBeNull();

      const tree2 = step2!.tree as PaneBranch;

      // Root should have ratio ≈0.333 (1/3) for left side
      expect(tree2.ratio).toBeCloseTo(1/3, 5);

      // Right side should have ratio ≈0.5 (1/2) for its two panes
      expect((tree2.second as PaneBranch).ratio).toBeCloseTo(0.5, 5);
    });

    it("should split three horizontal panes evenly (25% each)", () => {
      // Build: A | B | C
      const a = createLeafPane("a");
      const step1 = splitPane(a, "a", "horizontal");
      const step2 = splitPane(step1!.tree, step1!.newPaneId, "horizontal");

      // Split C horizontally: A | B | C | D
      const step3 = splitPane(step2!.tree, step2!.newPaneId, "horizontal");
      expect(step3).not.toBeNull();

      const tree3 = step3!.tree as PaneBranch;

      // Root should have ratio 0.25 (1/4) for left side
      expect(tree3.ratio).toBeCloseTo(0.25, 5);

      // The right subtree should distribute the remaining 3 panes
      const rightBranch = tree3.second as PaneBranch;
      expect(rightBranch.ratio).toBeCloseTo(1/3, 5); // 1 of 3 remaining
    });

    it("should preserve ratios in perpendicular direction", () => {
      // Build: A | B (horizontal)
      const a = createLeafPane("a");
      const step1 = splitPane(a, "a", "horizontal");
      const tree1 = step1!.tree as PaneBranch;

      expect(tree1.ratio).toBeCloseTo(0.5, 5);

      // Split A vertically: (A1 / A2) | B
      const step2 = splitPane(tree1, "a", "vertical");
      const tree2 = step2!.tree as PaneBranch;

      // Root horizontal ratio should remain 0.5
      expect(tree2.ratio).toBeCloseTo(0.5, 5);

      // Inner vertical split should be 0.5
      const innerBranch = tree2.first as PaneBranch;
      expect(innerBranch.ratio).toBeCloseTo(0.5, 5);
    });

    it("should handle mixed directions correctly", () => {
      // Build: (A / B) horizontally then split A vertically
      const a = createLeafPane("a");

      // Split horizontally: A | B
      const step1 = splitPane(a, "a", "horizontal");
      const tree1 = step1!.tree as PaneBranch;
      expect(tree1.direction).toBe("horizontal");

      // Split A vertically: (A1 / A2) | B
      const step2 = splitPane(tree1, "a", "vertical");
      const tree2 = step2!.tree as PaneBranch;

      // Root should remain horizontal with 0.5 ratio (perpendicular to new split)
      expect(tree2.direction).toBe("horizontal");
      expect(tree2.ratio).toBeCloseTo(0.5, 5);

      // First child should be vertical with 0.5 ratio
      const leftBranch = tree2.first as PaneBranch;
      expect(leftBranch.direction).toBe("vertical");
      expect(leftBranch.ratio).toBeCloseTo(0.5, 5);
    });

    it("should split 5 horizontal panes evenly (20% each)", () => {
      // Build: A | B | C | D | E
      let tree: PaneNode = createLeafPane("a");

      for (let i = 0; i < 4; i++) {
        const leaves = getAllLeaves(tree);
        const lastLeaf = leaves[leaves.length - 1];
        const result = splitPane(tree, lastLeaf.id, "horizontal");
        expect(result).not.toBeNull();
        tree = result!.tree;
      }

      // Verify 5 leaves
      expect(countLeaves(tree)).toBe(5);

      // Root should allocate 20% (1/5) to the left
      const root = tree as PaneBranch;
      expect(root.ratio).toBeCloseTo(0.2, 5);
    });
  });
});
