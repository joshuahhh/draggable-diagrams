// Shared tree operations for Nool demos.
// Pure .ts — no JSX, no framework imports.

import _ from "lodash";
import { Tree } from "./asts";

// # Op definitions

export type OpDef = { label: string; arity: number };

export const OP_DEFS: OpDef[] = [
  { label: "→", arity: 2 },
  { label: "+", arity: 2 },
  { label: "×", arity: 2 },
  { label: "-", arity: 1 },
];

export function isRewriteArrow(label: string): boolean {
  return label === "→";
}

export function expectedArity(label: string): number {
  return OP_DEFS.find((d) => d.label === label)?.arity ?? 0;
}

export function isOp(label: string): boolean {
  return expectedArity(label) > 0;
}

export function arityOk(tree: Tree): boolean {
  const expected = expectedArity(tree.label);
  if (expected === 0) return tree.children.length === 0;
  return tree.children.length === expected;
}

// # Tree structural operations (all pure, structural sharing)

export function replaceNode(
  tree: Tree,
  targetId: string,
  replacement: Tree,
): Tree {
  if (tree.id === targetId) return replacement;
  const newChildren = tree.children.map((c) =>
    replaceNode(c, targetId, replacement),
  );
  if (newChildren.every((c, i) => c === tree.children[i])) return tree;
  return { ...tree, children: newChildren };
}

export function insertChild(
  tree: Tree,
  parentId: string,
  index: number,
  child: Tree,
): Tree {
  if (tree.id === parentId) {
    const newChildren = [...tree.children];
    newChildren.splice(index, 0, child);
    return { ...tree, children: newChildren };
  }
  const newChildren = tree.children.map((c) =>
    insertChild(c, parentId, index, child),
  );
  if (newChildren.every((c, i) => c === tree.children[i])) return tree;
  return { ...tree, children: newChildren };
}

export function removeChild(tree: Tree, parentId: string, index: number): Tree {
  if (tree.id === parentId) {
    const newChildren = [...tree.children];
    newChildren.splice(index, 1);
    return { ...tree, children: newChildren };
  }
  const newChildren = tree.children.map((c) => removeChild(c, parentId, index));
  if (newChildren.every((c, i) => c === tree.children[i])) return tree;
  return { ...tree, children: newChildren };
}

export function removeNode(tree: Tree, nodeId: string): Tree {
  const newChildren = tree.children
    .filter((c) => c.id !== nodeId)
    .map((c) => removeNode(c, nodeId));
  if (
    newChildren.length === tree.children.length &&
    newChildren.every((c, i) => c === tree.children[i])
  )
    return tree;
  return { ...tree, children: newChildren };
}

export function swapChildrenAtParent(
  tree: Tree,
  parentId: string,
  i: number,
  j: number,
): Tree {
  if (tree.id === parentId) {
    const newChildren = [...tree.children];
    [newChildren[i], newChildren[j]] = [newChildren[j], newChildren[i]];
    return { ...tree, children: newChildren };
  }
  const newChildren = tree.children.map((c) =>
    swapChildrenAtParent(c, parentId, i, j),
  );
  if (newChildren.every((c, idx) => c === tree.children[idx])) return tree;
  return { ...tree, children: newChildren };
}

// # Tree search

export function findParentAndIndex(
  tree: Tree,
  nodeId: string,
): { parent: Tree; index: number } | null {
  for (let i = 0; i < tree.children.length; i++) {
    if (tree.children[i].id === nodeId) return { parent: tree, index: i };
    const result = findParentAndIndex(tree.children[i], nodeId);
    if (result) return result;
  }
  return null;
}

export function findAllHoles(tree: Tree): string[] {
  if (tree.label === "◯") return [tree.id];
  return tree.children.flatMap(findAllHoles);
}

// # Insertion points

export function allInsertionPoints(
  tree: Tree,
  canInsert?: (tree: Tree) => boolean,
): { parentId: string; index: number }[] {
  const pred = canInsert ?? ((t: Tree) => !!t.variadic);
  const points: { parentId: string; index: number }[] = [];
  if (pred(tree)) {
    for (let i = 0; i <= tree.children.length; i++) {
      points.push({ parentId: tree.id, index: i });
    }
  }
  for (const child of tree.children) {
    points.push(...allInsertionPoints(child, canInsert));
  }
  return points;
}

// # Multi-tree wrappers

export function allInsertionPointsInTrees(
  trees: Tree[],
  canInsert?: (tree: Tree) => boolean,
): { treeIdx: number; parentId: string; index: number }[] {
  return trees.flatMap((tree, treeIdx) =>
    allInsertionPoints(tree, canInsert).map((pt) => ({ treeIdx, ...pt })),
  );
}

export function findAllHolesInTrees(
  trees: Tree[],
): { treeIdx: number; holeId: string }[] {
  return trees.flatMap((tree, treeIdx) =>
    findAllHoles(tree).map((holeId) => ({ treeIdx, holeId })),
  );
}

export function replaceInTrees(
  trees: Tree[],
  treeIdx: number,
  targetId: string,
  replacement: Tree,
): Tree[] {
  return trees.map((t, i) =>
    i === treeIdx ? replaceNode(t, targetId, replacement) : t,
  );
}

export function insertInTrees(
  trees: Tree[],
  treeIdx: number,
  parentId: string,
  index: number,
  child: Tree,
): Tree[] {
  return trees.map((t, i) =>
    i === treeIdx ? insertChild(t, parentId, index, child) : t,
  );
}

export function removeInTrees(
  trees: Tree[],
  treeIdx: number,
  parentId: string,
  index: number,
): Tree[] {
  return trees.map((t, i) =>
    i === treeIdx ? removeChild(t, parentId, index) : t,
  );
}

// # Layout constants

export const T_GAP = 10;
export const T_PADDING = 5;
export const T_LABEL_WIDTH = 20;
export const T_LABEL_MIN_HEIGHT = 20;
export const T_EMPTY_CHILD_W = 12;
export const T_EMPTY_CHILD_H = 12;

export function treeSize(tree: Tree): { w: number; h: number } {
  const childSizes = tree.children.map(treeSize);
  const isOpNode = isOp(tree.label);
  const hasChildArea = childSizes.length > 0 || isOpNode;
  const childAreaW =
    childSizes.length > 0
      ? _.max(childSizes.map((c) => c.w))!
      : isOpNode
        ? T_EMPTY_CHILD_W
        : 0;
  const childAreaH =
    childSizes.length > 0
      ? _.sumBy(childSizes, (c) => c.h) + T_GAP * (childSizes.length - 1)
      : isOpNode
        ? T_EMPTY_CHILD_H
        : T_LABEL_MIN_HEIGHT;
  const innerW = T_LABEL_WIDTH + (hasChildArea ? T_GAP + childAreaW : 0);
  const innerH = hasChildArea
    ? Math.max(childAreaH, T_LABEL_MIN_HEIGHT)
    : T_LABEL_MIN_HEIGHT;
  return { w: innerW + T_PADDING * 2, h: innerH + T_PADDING * 2 };
}

// # Cloning

let nextCloneId = 0;

export function cloneTreeWithFreshIds(tree: Tree): Tree {
  return {
    id: `clone-${nextCloneId++}`,
    label: tree.label,
    children: tree.children.map(cloneTreeWithFreshIds),
    variadic: tree.variadic,
  };
}
