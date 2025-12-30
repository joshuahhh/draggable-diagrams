import { describe, expect, test } from "vitest";
import {
  allPossibleRewrites,
  applyRewrite,
  isBinaryOp,
  isOp,
  pattern,
  rewr,
  Tree,
} from "./asts";

describe("pattern parser", () => {
  test("wildcards", () => {
    expect(pattern`A`).toEqual({
      type: "wildcard",
      id: "A",
      isTrigger: false,
    });
    expect(pattern`#A`).toEqual({
      type: "wildcard",
      id: "A",
      isTrigger: true,
    });
  });

  test("ops", () => {
    expect(pattern`(+ A B)`).toEqual({
      type: "op",
      label: "+",
      id: "+",
      children: [
        { type: "wildcard", id: "A", isTrigger: false },
        { type: "wildcard", id: "B", isTrigger: false },
      ],
      isTrigger: false,
    });

    expect(pattern`(+5 A B)`).toEqual({
      type: "op",
      label: "+",
      id: "+5",
      children: [
        { type: "wildcard", id: "A", isTrigger: false },
        { type: "wildcard", id: "B", isTrigger: false },
      ],
      isTrigger: false,
    });

    expect(pattern`#(+ A B)`).toEqual({
      type: "op",
      label: "+",
      id: "+",
      children: [
        { type: "wildcard", id: "A", isTrigger: false },
        { type: "wildcard", id: "B", isTrigger: false },
      ],
      isTrigger: true,
    });
  });
});

describe("tree helpers", () => {
  test("isOp", () => {
    expect(isOp({ id: "x", label: "+", children: [] })).toBe(true);
    expect(isOp({ id: "x", label: "×", children: [] })).toBe(true);
    expect(isOp({ id: "x", label: "a", children: [] })).toBe(false);
  });

  test("isBinaryOp", () => {
    expect(
      isBinaryOp({
        id: "x",
        label: "+",
        children: [
          { id: "a", label: "a", children: [] },
          { id: "b", label: "b", children: [] },
        ],
      })
    ).toBe(true);
    expect(
      isBinaryOp({
        id: "x",
        label: "×",
        children: [
          { id: "a", label: "a", children: [] },
          { id: "b", label: "b", children: [] },
        ],
      })
    ).toBe(true);
    expect(
      isBinaryOp({
        id: "x",
        label: "+",
        children: [{ id: "a", label: "a", children: [] }],
      })
    ).toBe(false);
    expect(
      isBinaryOp({
        id: "x",
        label: "a",
        children: [
          { id: "a", label: "a", children: [] },
          { id: "b", label: "b", children: [] },
        ],
      })
    ).toBe(false);
  });
});

describe("rewrites", () => {
  test("applyRewrite works with match", () => {
    const tree: Tree = {
      id: "root",
      label: "+",
      children: [
        { id: "a", label: "one", children: [] },
        { id: "b", label: "two", children: [] },
      ],
    };

    const toPattern = pattern`(+ B A)`;

    // Create match map manually
    const matchMap = new Map<string, Tree>();
    matchMap.set("+", tree);
    matchMap.set("A", tree.children[0]);
    matchMap.set("B", tree.children[1]);

    expect(applyRewrite(matchMap, toPattern)).toEqual({
      id: "root",
      label: "+",
      children: [
        { id: "b", label: "two", children: [] },
        { id: "a", label: "one", children: [] },
      ],
    });
  });

  test("allPossibleRewrites at root level", () => {
    const tree: Tree = {
      id: "root",
      label: "+",
      children: [
        { id: "a", label: "1", children: [] },
        { id: "b", label: "2", children: [] },
      ],
    };

    const rewrites = [rewr("#(+ A B)", "(+ B A)")];

    const results = allPossibleRewrites(tree, rewrites, "root");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: "root",
      label: "+",
      children: [
        { id: "b", label: "2", children: [] },
        { id: "a", label: "1", children: [] },
      ],
    });
  });

  test("allPossibleRewrites at child level", () => {
    const tree: Tree = {
      id: "root",
      label: "×",
      children: [
        {
          id: "child",
          label: "+",
          children: [
            { id: "a", label: "1", children: [] },
            { id: "b", label: "2", children: [] },
          ],
        },
        { id: "c", label: "3", children: [] },
      ],
    };

    const rewrites = [rewr("#(+ A B)", "(+ B A)")];

    const results = allPossibleRewrites(tree, rewrites, "child");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: "root",
      label: "×",
      children: [
        {
          id: "child",
          label: "+",
          children: [
            { id: "b", label: "2", children: [] },
            { id: "a", label: "1", children: [] },
          ],
        },
        { id: "c", label: "3", children: [] },
      ],
    });
  });

  test("allPossibleRewrites with no trigger match", () => {
    const tree: Tree = {
      id: "root",
      label: "+",
      children: [
        { id: "a", label: "1", children: [] },
        { id: "b", label: "2", children: [] },
      ],
    };

    const rewrites = [rewr("#(+ A B)", "(+ B A)")];

    // Trigger on a non-existent node
    const results = allPossibleRewrites(tree, rewrites, "nonexistent");

    expect(results).toHaveLength(0);
  });

  test("allPossibleRewrites with multiple rewrites", () => {
    const tree: Tree = {
      id: "root",
      label: "+",
      children: [
        {
          id: "left",
          label: "+",
          children: [
            { id: "a", label: "1", children: [] },
            { id: "b", label: "2", children: [] },
          ],
        },
        { id: "c", label: "3", children: [] },
      ],
    };

    const rewrites = [
      rewr("#(+ A B)", "(+ B A)"),
      rewr("#(+ (+ A B) C)", "(+ C (+ A B))"),
    ];

    const results = allPossibleRewrites(tree, rewrites, "left");

    // Only the first rewrite applies because "left" is the trigger,
    // and it matches the pattern (+ A B)
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: "root",
      label: "+",
      children: [
        {
          id: "left",
          label: "+",
          children: [
            { id: "b", label: "2", children: [] },
            { id: "a", label: "1", children: [] },
          ],
        },
        { id: "c", label: "3", children: [] },
      ],
    });
  });

  test("allPossibleRewrites with nested opportunities", () => {
    const tree: Tree = {
      id: "root",
      label: "+",
      children: [
        {
          id: "left",
          label: "+",
          children: [
            { id: "a", label: "1", children: [] },
            { id: "b", label: "2", children: [] },
          ],
        },
        {
          id: "right",
          label: "+",
          children: [
            { id: "c", label: "3", children: [] },
            { id: "d", label: "4", children: [] },
          ],
        },
      ],
    };

    const rewrites = [rewr("#(+ A B)", "(+ B A)")];

    const resultsLeft = allPossibleRewrites(tree, rewrites, "left");
    expect(resultsLeft).toHaveLength(1);
    expect(resultsLeft[0].children[0].children).toEqual([
      { id: "b", label: "2", children: [] },
      { id: "a", label: "1", children: [] },
    ]);

    const resultsRight = allPossibleRewrites(tree, rewrites, "right");
    expect(resultsRight).toHaveLength(1);
    expect(resultsRight[0].children[1].children).toEqual([
      { id: "d", label: "4", children: [] },
      { id: "c", label: "3", children: [] },
    ]);
  });
});
