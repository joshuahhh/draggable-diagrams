import { describe, expect, it } from "vitest";
import {
  addParents,
  buildHasseDiagram,
  codomainTree,
  covers,
  domainTree,
  getAllMorphs,
  layoutHasse,
  testMorphs,
} from "./trees";

describe("getAllMorphs", () => {
  it("works on Elliot's example", () => {
    const tree = addParents({
      id: "root",
      children: [
        { id: "a", children: [] },
        { id: "b", children: [] },
      ],
    });
    const morphs = getAllMorphs(tree, tree);
    expect(morphs).toHaveLength(11);
  });

  it("single node to single node has exactly one morphism", () => {
    const singleNode = addParents({ id: "x", children: [] });
    const morphs = getAllMorphs(singleNode, singleNode);
    expect(morphs).toHaveLength(1);
    expect(morphs[0]).toEqual({ x: "x" });
  });

  it("single node to larger tree has morphisms to each node", () => {
    const singleNode = addParents({ id: "x", children: [] });
    const threeNodeTree = addParents({
      id: "root",
      children: [
        { id: "a", children: [] },
        { id: "b", children: [] },
      ],
    });
    const morphs = getAllMorphs(singleNode, threeNodeTree);
    expect(morphs).toHaveLength(3); // Can map to root, a, or b
    expect(morphs).toContainEqual({ x: "root" });
    expect(morphs).toContainEqual({ x: "a" });
    expect(morphs).toContainEqual({ x: "b" });
  });

  it("two-node chain has correct morphisms", () => {
    const chain = addParents({
      id: "p",
      children: [{ id: "c", children: [] }],
    });
    const morphs = getAllMorphs(chain, chain);
    // Valid morphisms: both to p, both to c, or p->p and c->c
    expect(morphs).toHaveLength(3);
    expect(morphs).toContainEqual({ p: "p", c: "p" }); // All to root
    expect(morphs).toContainEqual({ p: "p", c: "c" }); // Identity
    expect(morphs).toContainEqual({ p: "c", c: "c" }); // All to leaf
  });

  it("verifies testMorphs are all valid", () => {
    const allValidMorphs = getAllMorphs(domainTree, codomainTree);

    for (const testMorph of testMorphs) {
      const isValid = allValidMorphs.some(
        (m) => JSON.stringify(m) === JSON.stringify(testMorph)
      );
      expect(isValid).toBe(true);
    }
  });

  it("three-node chain to two-node chain has valid morphisms", () => {
    const largeChain = addParents({
      id: "a",
      children: [
        {
          id: "b",
          children: [{ id: "c", children: [] }],
        },
      ],
    });
    const smallerTree = addParents({
      id: "x",
      children: [{ id: "y", children: [] }],
    });
    const morphs = getAllMorphs(largeChain, smallerTree);
    // Possible mappings: all to x, all to y, a->x with b,c->y, or a,b->x with c->y
    expect(morphs).toHaveLength(4);
    expect(morphs).toContainEqual({ a: "x", b: "x", c: "x" });
    expect(morphs).toContainEqual({ a: "y", b: "y", c: "y" });
    expect(morphs).toContainEqual({ a: "x", b: "y", c: "y" });
    expect(morphs).toContainEqual({ a: "x", b: "x", c: "y" });
  });

  it("no morphisms when incompatible structure (two incomparable elements to chain)", () => {
    // Two sibling nodes cannot both map to a strict chain since they're incomparable
    const siblings = addParents({
      id: "root",
      children: [
        { id: "a", children: [] },
        { id: "b", children: [] },
      ],
    });
    const singleLeaf = addParents({ id: "x", children: [] });

    // There ARE morphisms - both siblings can map to the single node
    const morphs = getAllMorphs(siblings, singleLeaf);
    expect(morphs).toHaveLength(1);
    expect(morphs[0]).toEqual({ root: "x", a: "x", b: "x" });
  });

  it("counts morphisms for symmetric case", () => {
    // Two children, both with two children
    const symmetricTree = addParents({
      id: "root",
      children: [
        {
          id: "a",
          children: [
            { id: "a1", children: [] },
            { id: "a2", children: [] },
          ],
        },
        {
          id: "b",
          children: [
            { id: "b1", children: [] },
            { id: "b2", children: [] },
          ],
        },
      ],
    });
    const morphs = getAllMorphs(symmetricTree, symmetricTree);
    // Should have identity plus many other valid morphisms
    expect(morphs.length).toBeGreaterThan(1);

    // Verify identity is included
    const identity = {
      root: "root",
      a: "a",
      a1: "a1",
      a2: "a2",
      b: "b",
      b1: "b1",
      b2: "b2",
    };
    expect(morphs).toContainEqual(identity);
  });
});

describe("covers", () => {
  const tree = addParents({
    id: "root",
    children: [
      { id: "a", children: [] },
      { id: "b", children: [] },
    ],
  });

  it("detects covering when one node maps to parent", () => {
    const f = { x: "root", y: "root" };
    const g = { x: "root", y: "a" };
    expect(covers(f, g, tree)).toBe("y");
  });

  it("returns null when morphisms differ at multiple nodes", () => {
    const f = { x: "root", y: "root" };
    const g = { x: "a", y: "b" };
    expect(covers(f, g, tree)).toBe(null);
  });

  it("returns null when morphisms are identical", () => {
    const f = { x: "root", y: "a" };
    const g = { x: "root", y: "a" };
    expect(covers(f, g, tree)).toBe(null);
  });

  it("returns null when difference is not parent relationship", () => {
    const f = { x: "a", y: "a" };
    const g = { x: "b", y: "a" };
    // a and b are siblings, not parent-child
    expect(covers(f, g, tree)).toBe(null);
  });

  it("returns null when mapping goes down instead of up", () => {
    const f = { x: "root", y: "a" };
    const g = { x: "root", y: "root" };
    // g maps to parent of where f maps, not the other way around
    expect(covers(f, g, tree)).toBe(null);
  });

  it("works with deeper tree", () => {
    const deepTree = addParents({
      id: "root",
      children: [
        {
          id: "a",
          children: [{ id: "a1", children: [] }],
        },
      ],
    });

    const f = { x: "a", y: "a1" };
    const g = { x: "a", y: "a" };
    expect(covers(f, g, deepTree)).toBe(null); // wrong direction

    const f2 = { x: "a", y: "a" };
    const g2 = { x: "a", y: "a1" };
    expect(covers(f2, g2, deepTree)).toBe("y"); // f2 covers g2
  });
});

describe("buildHasseDiagram", () => {
  it("builds diagram for simple case", () => {
    const singleNode = addParents({ id: "x", children: [] });
    const twoNodeChain = addParents({
      id: "p",
      children: [{ id: "c", children: [] }],
    });

    const diagram = buildHasseDiagram(singleNode, twoNodeChain);

    // Should have 2 morphisms: x->p and x->c
    expect(diagram.nodes).toHaveLength(2);

    // x->p should cover x->c (p is parent of c)
    expect(diagram.edges).toHaveLength(1);

    // Find which index is which
    const pMorphIndex = diagram.nodes.findIndex((m) => m.x === "p");
    const cMorphIndex = diagram.nodes.findIndex((m) => m.x === "c");

    expect(diagram.edges[0]).toEqual([pMorphIndex, cMorphIndex, "x"]);
  });

  it("builds diagram for Elliot's example", () => {
    const tree = addParents({
      id: "root",
      children: [
        { id: "a", children: [] },
        { id: "b", children: [] },
      ],
    });

    const diagram = buildHasseDiagram(tree, tree);
    expect(diagram.nodes).toHaveLength(11);

    // Should have edges forming a proper poset structure
    expect(diagram.edges.length).toBeGreaterThan(0);

    // All edges should be valid covering relations
    for (const [from, to, key] of diagram.edges) {
      expect(covers(diagram.nodes[from], diagram.nodes[to], tree)).toBe(key);
    }
  });
});

describe("layoutHasse", () => {
  it("lays out a simple chain correctly", () => {
    const singleNode = addParents({ id: "x", children: [] });
    const twoNodeChain = addParents({
      id: "p",
      children: [{ id: "c", children: [] }],
    });

    const diagram = buildHasseDiagram(singleNode, twoNodeChain);
    const layout = layoutHasse(diagram);

    // Should have positions for both morphisms
    expect(layout.positions.size).toBe(2);

    // Find which is which
    const cMorphIdx = diagram.nodes.findIndex((m) => m.x === "c");
    const pMorphIdx = diagram.nodes.findIndex((m) => m.x === "p");

    // p morphism should be higher up (smaller y in TB layout with dagre)
    const cPos = layout.positions.get(cMorphIdx)!;
    const pPos = layout.positions.get(pMorphIdx)!;
    expect(pPos.y).toBeLessThan(cPos.y);
  });

  it("lays out Elliot's example with proper positioning", () => {
    const tree = addParents({
      id: "r",
      children: [
        { id: "a", children: [] },
        { id: "b", children: [] },
      ],
    });

    const diagram = buildHasseDiagram(tree, tree);
    const layout = layoutHasse(diagram);

    // All nodes should be assigned positions
    expect(layout.positions.size).toBe(diagram.nodes.length);

    // Check that covering edges go downward (from covers to, so from has smaller y)
    for (const [from, to] of diagram.edges) {
      const fromPos = layout.positions.get(from)!;
      const toPos = layout.positions.get(to)!;
      // from covers to, so from should have smaller y (higher up in TB layout)
      expect(fromPos.y).toBeLessThan(toPos.y);
    }

    // Layout should have reasonable dimensions
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});
