import { Tree } from "./asts";
import {
  replaceNode,
  insertChild,
  removeChild,
  removeNode,
  swapChildrenAtParent,
  findParentAndIndex,
  findAllHoles,
  allInsertionPoints,
  arityOk,
  treeSize,
  cloneTreeWithFreshIds,
  allInsertionPointsInTrees,
  findAllHolesInTrees,
  replaceInTrees,
  insertInTrees,
  removeInTrees,
  isOp,
  expectedArity,
  T_GAP,
  T_PADDING,
  T_LABEL_WIDTH,
  T_LABEL_MIN_HEIGHT,
  T_EMPTY_CHILD_W,
  T_EMPTY_CHILD_H,
} from "./nool-tree";
import { describe, it, expect } from "vitest";

// # Test trees

const leaf = (id: string, label: string): Tree => ({
  id,
  label,
  children: [],
});

const hole = (id: string): Tree => leaf(id, "◯");

const op = (
  id: string,
  label: string,
  children: Tree[],
  variadic?: boolean
): Tree => ({
  id,
  label,
  children,
  ...(variadic ? { variadic: true } : {}),
});

// +(A, B)
const simpleTree: Tree = op("r", "+", [leaf("a", "⛅"), leaf("b", "🍄")]);

// +(+(C, D), E)
const nestedTree: Tree = op("r", "+", [
  op("l", "+", [leaf("c", "⛅"), leaf("d", "🍄")]),
  leaf("e", "🎲"),
]);

// variadic +(A, B, C)
const variadicTree: Tree = op(
  "v",
  "+",
  [leaf("va", "⛅"), leaf("vb", "🍄"), leaf("vc", "🎲")],
  true
);

describe("replaceNode", () => {
  it("replaces a leaf", () => {
    const result = replaceNode(simpleTree, "a", leaf("x", "🎲"));
    expect(result.children[0]).toEqual(leaf("x", "🎲"));
    expect(result.children[1]).toBe(simpleTree.children[1]); // structural sharing
  });

  it("replaces a subtree", () => {
    const result = replaceNode(nestedTree, "l", leaf("x", "atom"));
    expect(result.children[0]).toEqual(leaf("x", "atom"));
    expect(result.children[1]).toBe(nestedTree.children[1]);
  });

  it("replaces root", () => {
    const result = replaceNode(simpleTree, "r", leaf("x", "new"));
    expect(result).toEqual(leaf("x", "new"));
  });

  it("returns same tree when target not found", () => {
    const result = replaceNode(simpleTree, "zzz", leaf("x", "new"));
    expect(result).toBe(simpleTree);
  });
});

describe("insertChild", () => {
  it("inserts at start", () => {
    const child = leaf("n", "🎲");
    const result = insertChild(simpleTree, "r", 0, child);
    expect(result.children.length).toBe(3);
    expect(result.children[0]).toBe(child);
    expect(result.children[1]).toBe(simpleTree.children[0]);
  });

  it("inserts at middle", () => {
    const child = leaf("n", "🎲");
    const result = insertChild(simpleTree, "r", 1, child);
    expect(result.children.length).toBe(3);
    expect(result.children[0]).toBe(simpleTree.children[0]);
    expect(result.children[1]).toBe(child);
    expect(result.children[2]).toBe(simpleTree.children[1]);
  });

  it("inserts at end", () => {
    const child = leaf("n", "🎲");
    const result = insertChild(simpleTree, "r", 2, child);
    expect(result.children.length).toBe(3);
    expect(result.children[2]).toBe(child);
  });

  it("inserts into nested parent", () => {
    const child = leaf("n", "🎲");
    const result = insertChild(nestedTree, "l", 1, child);
    expect(result.children[0].children.length).toBe(3);
    expect(result.children[0].children[1]).toBe(child);
    expect(result.children[1]).toBe(nestedTree.children[1]); // untouched
  });
});

describe("removeChild", () => {
  it("removes from start", () => {
    const result = removeChild(simpleTree, "r", 0);
    expect(result.children.length).toBe(1);
    expect(result.children[0]).toBe(simpleTree.children[1]);
  });

  it("removes from end", () => {
    const result = removeChild(simpleTree, "r", 1);
    expect(result.children.length).toBe(1);
    expect(result.children[0]).toBe(simpleTree.children[0]);
  });

  it("removes from nested parent", () => {
    const result = removeChild(nestedTree, "l", 0);
    expect(result.children[0].children.length).toBe(1);
    expect(result.children[0].children[0].id).toBe("d");
    expect(result.children[1]).toBe(nestedTree.children[1]);
  });
});

describe("removeNode", () => {
  it("removes a leaf by id", () => {
    const result = removeNode(simpleTree, "a");
    expect(result.children.length).toBe(1);
    expect(result.children[0]).toBe(simpleTree.children[1]);
  });

  it("removes a nested node", () => {
    const result = removeNode(nestedTree, "c");
    expect(result.children[0].children.length).toBe(1);
    expect(result.children[0].children[0].id).toBe("d");
  });

  it("returns same tree when not found", () => {
    const result = removeNode(simpleTree, "zzz");
    expect(result).toBe(simpleTree);
  });
});

describe("swapChildrenAtParent", () => {
  it("swaps adjacent children", () => {
    const result = swapChildrenAtParent(simpleTree, "r", 0, 1);
    expect(result.children[0]).toBe(simpleTree.children[1]);
    expect(result.children[1]).toBe(simpleTree.children[0]);
  });

  it("swaps in nested parent", () => {
    const result = swapChildrenAtParent(nestedTree, "l", 0, 1);
    expect(result.children[0].children[0].id).toBe("d");
    expect(result.children[0].children[1].id).toBe("c");
    expect(result.children[1]).toBe(nestedTree.children[1]);
  });

  it("returns same tree when parent not found", () => {
    const result = swapChildrenAtParent(simpleTree, "zzz", 0, 1);
    expect(result).toBe(simpleTree);
  });
});

describe("findParentAndIndex", () => {
  it("finds root child", () => {
    const result = findParentAndIndex(simpleTree, "a");
    expect(result).toEqual({ parent: simpleTree, index: 0 });
  });

  it("finds nested child", () => {
    const result = findParentAndIndex(nestedTree, "c");
    expect(result).toEqual({ parent: nestedTree.children[0], index: 0 });
  });

  it("returns null for root", () => {
    const result = findParentAndIndex(simpleTree, "r");
    expect(result).toBeNull();
  });

  it("returns null when not found", () => {
    const result = findParentAndIndex(simpleTree, "zzz");
    expect(result).toBeNull();
  });
});

describe("findAllHoles", () => {
  it("no holes", () => {
    expect(findAllHoles(simpleTree)).toEqual([]);
  });

  it("leaf hole", () => {
    expect(findAllHoles(hole("h1"))).toEqual(["h1"]);
  });

  it("nested holes", () => {
    const tree = op("r", "+", [hole("h1"), op("l", "+", [hole("h2"), hole("h3")])]);
    expect(findAllHoles(tree)).toEqual(["h1", "h2", "h3"]);
  });

  it("mixed tree", () => {
    const tree = op("r", "+", [leaf("a", "⛅"), hole("h1")]);
    expect(findAllHoles(tree)).toEqual(["h1"]);
  });
});

describe("allInsertionPoints", () => {
  it("no variadic nodes (default predicate)", () => {
    expect(allInsertionPoints(simpleTree)).toEqual([]);
  });

  it("one variadic node", () => {
    const pts = allInsertionPoints(variadicTree);
    expect(pts.length).toBe(4); // 0,1,2,3 for 3 children
    expect(pts[0]).toEqual({ parentId: "v", index: 0 });
    expect(pts[3]).toEqual({ parentId: "v", index: 3 });
  });

  it("nested variadic", () => {
    const tree = op(
      "outer",
      "+",
      [op("inner", "+", [leaf("a", "⛅")], true)],
      true
    );
    const pts = allInsertionPoints(tree);
    // outer: 0,1 (2 positions); inner: 0,1 (2 positions)
    expect(pts.length).toBe(4);
  });

  it("custom canInsert predicate", () => {
    // Using isOp as predicate (tree-macro behavior)
    const pts = allInsertionPoints(simpleTree, (t) => isOp(t.label));
    expect(pts.length).toBe(3); // 0,1,2 for 2 children
    expect(pts[0]).toEqual({ parentId: "r", index: 0 });
  });
});

describe("arityOk", () => {
  it("atom (0 children)", () => {
    expect(arityOk(leaf("a", "⛅"))).toBe(true);
  });

  it("correct op arity", () => {
    expect(arityOk(simpleTree)).toBe(true);
  });

  it("wrong arity", () => {
    const bad = op("r", "+", [leaf("a", "⛅")]);
    expect(arityOk(bad)).toBe(false);
  });

  it("variadic node with wrong arity still reports wrong", () => {
    // variadic doesn't affect arityOk — it's purely about expected vs actual
    const v = { ...variadicTree, children: [leaf("a", "⛅")] };
    expect(arityOk(v)).toBe(false);
  });

  it("unary op with correct arity", () => {
    const neg = op("r", "-", [leaf("a", "⛅")]);
    expect(arityOk(neg)).toBe(true);
  });
});

describe("treeSize", () => {
  it("leaf", () => {
    const size = treeSize(leaf("a", "⛅"));
    expect(size.w).toBe(T_LABEL_WIDTH + T_PADDING * 2);
    expect(size.h).toBe(T_LABEL_MIN_HEIGHT + T_PADDING * 2);
  });

  it("op with children", () => {
    const size = treeSize(simpleTree);
    const childSizes = simpleTree.children.map(treeSize);
    const childAreaW = Math.max(...childSizes.map((c) => c.w));
    const childAreaH =
      childSizes.reduce((s, c) => s + c.h, 0) +
      T_GAP * (childSizes.length - 1);
    const innerW = T_LABEL_WIDTH + T_GAP + childAreaW;
    const innerH = Math.max(childAreaH, T_LABEL_MIN_HEIGHT);
    expect(size.w).toBe(innerW + T_PADDING * 2);
    expect(size.h).toBe(innerH + T_PADDING * 2);
  });

  it("empty op node shows child placeholder area", () => {
    const emptyOp = op("r", "+", []);
    const size = treeSize(emptyOp);
    // Should account for T_EMPTY_CHILD_W/H
    expect(size.w).toBe(T_LABEL_WIDTH + T_GAP + T_EMPTY_CHILD_W + T_PADDING * 2);
    expect(size.h).toBe(
      Math.max(T_EMPTY_CHILD_H, T_LABEL_MIN_HEIGHT) + T_PADDING * 2
    );
  });
});

describe("cloneTreeWithFreshIds", () => {
  it("preserves structure", () => {
    const clone = cloneTreeWithFreshIds(simpleTree);
    expect(clone.label).toBe(simpleTree.label);
    expect(clone.children.length).toBe(simpleTree.children.length);
    expect(clone.children[0].label).toBe(simpleTree.children[0].label);
  });

  it("all ids differ", () => {
    const clone = cloneTreeWithFreshIds(simpleTree);
    const collectIds = (t: Tree): string[] => [
      t.id,
      ...t.children.flatMap(collectIds),
    ];
    const origIds = new Set(collectIds(simpleTree));
    const cloneIds = collectIds(clone);
    for (const id of cloneIds) {
      expect(origIds.has(id)).toBe(false);
    }
  });

  it("preserves variadic flag", () => {
    const clone = cloneTreeWithFreshIds(variadicTree);
    expect(clone.variadic).toBe(true);
  });
});

describe("multi-tree wrappers", () => {
  const trees: Tree[] = [simpleTree, nestedTree];

  it("replaceInTrees replaces in correct tree", () => {
    const result = replaceInTrees(trees, 0, "a", leaf("x", "new"));
    expect(result[0].children[0].label).toBe("new");
    expect(result[1]).toBe(trees[1]); // untouched
  });

  it("insertInTrees inserts in correct tree", () => {
    const result = insertInTrees(trees, 1, "l", 1, leaf("x", "new"));
    expect(result[1].children[0].children.length).toBe(3);
    expect(result[0]).toBe(trees[0]); // untouched
  });

  it("removeInTrees removes from correct tree", () => {
    const result = removeInTrees(trees, 0, "r", 0);
    expect(result[0].children.length).toBe(1);
    expect(result[1]).toBe(trees[1]);
  });

  it("findAllHolesInTrees across trees", () => {
    const treesWithHoles: Tree[] = [
      op("r1", "+", [hole("h1"), leaf("a", "⛅")]),
      op("r2", "+", [hole("h2"), hole("h3")]),
    ];
    const holes = findAllHolesInTrees(treesWithHoles);
    expect(holes).toEqual([
      { treeIdx: 0, holeId: "h1" },
      { treeIdx: 1, holeId: "h2" },
      { treeIdx: 1, holeId: "h3" },
    ]);
  });

  it("allInsertionPointsInTrees with variadic trees", () => {
    const treesVar: Tree[] = [variadicTree, simpleTree];
    const pts = allInsertionPointsInTrees(treesVar);
    // variadicTree: 4 points, simpleTree: 0 points
    expect(pts.length).toBe(4);
    expect(pts[0].treeIdx).toBe(0);
  });
});

describe("isOp and expectedArity", () => {
  it("recognizes ops", () => {
    expect(isOp("+")).toBe(true);
    expect(isOp("×")).toBe(true);
    expect(isOp("-")).toBe(true);
    expect(isOp("→")).toBe(true);
  });

  it("atoms are not ops", () => {
    expect(isOp("⛅")).toBe(false);
    expect(isOp("🍄")).toBe(false);
    expect(isOp("◯")).toBe(false);
  });

  it("expected arities", () => {
    expect(expectedArity("+")).toBe(2);
    expect(expectedArity("×")).toBe(2);
    expect(expectedArity("-")).toBe(1);
    expect(expectedArity("→")).toBe(2);
    expect(expectedArity("⛅")).toBe(0);
  });
});
