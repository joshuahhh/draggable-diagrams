import { describe, expect, test } from "vitest";
import {
  allPossibleRewrites,
  applyRewrite,
  isBinaryOp,
  isOp,
  Match,
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
      }),
    ).toBe(true);
    expect(
      isBinaryOp({
        id: "x",
        label: "×",
        children: [
          { id: "a", label: "a", children: [] },
          { id: "b", label: "b", children: [] },
        ],
      }),
    ).toBe(true);
    expect(
      isBinaryOp({
        id: "x",
        label: "+",
        children: [{ id: "a", label: "a", children: [] }],
      }),
    ).toBe(false);
    expect(
      isBinaryOp({
        id: "x",
        label: "a",
        children: [
          { id: "a", label: "a", children: [] },
          { id: "b", label: "b", children: [] },
        ],
      }),
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

    // Create match manually
    const matchMap: Match = {
      wildcards: new Map<string, Tree>([
        ["A", tree.children[0]],
        ["B", tree.children[1]],
      ]),
      ops: new Map<string, Tree>([["+", tree]]),
    };

    expect(applyRewrite(matchMap, toPattern, "a")).toEqual({
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

  test("distributivity forward: duplicates wildcard with fresh IDs and emergeFrom", () => {
    // a × (b + c) → (a × b) + (a × c)
    const tree: Tree = {
      id: "times",
      label: "×",
      children: [
        { id: "a", label: "🎲", children: [] },
        {
          id: "plus",
          label: "+",
          children: [
            { id: "b", label: "🦠", children: [] },
            { id: "c", label: "🐝", children: [] },
          ],
        },
      ],
    };

    const rewrites = [rewr("(× A #(+ B C))", "(+ (× A B) (× A C))")];
    const results = allPossibleRewrites(tree, rewrites, "plus");

    expect(results).toHaveLength(1);
    const result = results[0];

    // Outer + reuses the matched +'s ID
    expect(result.id).toBe("plus");
    expect(result.label).toBe("+");

    // First × reuses the matched ×'s ID
    const firstTimes = result.children[0];
    expect(firstTimes.id).toBe("times");
    expect(firstTimes.label).toBe("×");
    // First A keeps original ID
    expect(firstTimes.children[0].id).toBe("a");
    expect(firstTimes.children[0].label).toBe("🎲");
    expect(firstTimes.children[1].id).toBe("b");

    // Second × gets a fresh ID, emerges from original ×
    const secondTimes = result.children[1];
    expect(secondTimes.id).not.toBe("times");
    expect(secondTimes.label).toBe("×");
    expect(secondTimes.emergeFrom).toBe("times");
    // Second A gets fresh ID, emerges from original a
    expect(secondTimes.children[0].id).not.toBe("a");
    expect(secondTimes.children[0].label).toBe("🎲");
    expect(secondTimes.children[0].emergeFrom).toBe("a");
    expect(secondTimes.children[1].id).toBe("c");
  });

  test("distributivity reverse: factors with repeated wildcard matching", () => {
    // (a × b) + (a × c) → a × (b + c), where both a's are structurally equal
    const tree: Tree = {
      id: "plus",
      label: "+",
      children: [
        {
          id: "times1",
          label: "×",
          children: [
            { id: "a1", label: "🎲", children: [] },
            { id: "b", label: "🦠", children: [] },
          ],
        },
        {
          id: "times2",
          label: "×",
          children: [
            { id: "a2", label: "🎲", children: [] },
            { id: "c", label: "🐝", children: [] },
          ],
        },
      ],
    };

    const rewrites = [rewr("#(+ (× A B) (× A C))", "(× A (+ B C))")];
    const results = allPossibleRewrites(tree, rewrites, "plus");

    expect(results).toHaveLength(1);
    const result = results[0];

    // × reuses the first matched ×'s ID
    expect(result.id).toBe("times1");
    expect(result.label).toBe("×");
    // A uses the first match (a1)
    expect(result.children[0].id).toBe("a1");
    expect(result.children[0].label).toBe("🎲");
    // + reuses the matched +'s ID
    expect(result.children[1].id).toBe("plus");
    expect(result.children[1].label).toBe("+");
    expect(result.children[1].children[0].id).toBe("b");
    expect(result.children[1].children[1].id).toBe("c");
  });

  test("distributivity reverse: fails when repeated wildcard doesn't match structurally", () => {
    // (a × b) + (d × c) where a ≠ d — should NOT match
    const tree: Tree = {
      id: "plus",
      label: "+",
      children: [
        {
          id: "times1",
          label: "×",
          children: [
            { id: "a", label: "🎲", children: [] },
            { id: "b", label: "🦠", children: [] },
          ],
        },
        {
          id: "times2",
          label: "×",
          children: [
            { id: "d", label: "🐝", children: [] },
            { id: "c", label: "⛅", children: [] },
          ],
        },
      ],
    };

    const rewrites = [rewr("#(+ (× A B) (× A C))", "(× A (+ B C))")];
    const results = allPossibleRewrites(tree, rewrites, "plus");

    expect(results).toHaveLength(0);
  });
});
