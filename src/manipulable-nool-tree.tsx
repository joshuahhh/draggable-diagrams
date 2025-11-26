import _ from "lodash";
import React from "react";
import { ConfigCheckbox } from "./config-controls";
import { Manipulable } from "./manipulable";
import { Diagram, group, rectangle } from "./shape";
import { insertImm, removeImm, setImm } from "./utils";

type NoolTree = {
  id: string;
  label: string;
  children: NoolTree[];
};

function isOp(node: NoolTree): boolean {
  return node.label === "+" || node.label === "×";
}

function isBinaryOp(node: NoolTree): boolean {
  return isOp(node) && node.children.length === 2;
}

type NoolTreeConfig = {
  commutativity: boolean;
  pullUpOp: boolean;
  pullDownOp: boolean;
  pullUpTail: boolean;
  pullDownTail: boolean;
};

export const manipulableNoolTree: Manipulable<NoolTree, NoolTreeConfig> = {
  sourceFile: "manipulable-nool-tree.tsx",

  render(state) {
    return renderNoolTree(state).diagram;
  },

  accessibleFrom(state, draggableKey, configParam) {
    const config = configParam || this.defaultConfig!;
    const manifolds: NoolTree[][] = [[state]];
    // walk the tree
    function walk(tree: NoolTree, replaceNode: (newNode: NoolTree) => void) {
      // commutativity
      if (config.commutativity && isOp(tree)) {
        const childIdx = tree.children.findIndex((c) => c.id === draggableKey);
        if (childIdx !== -1) {
          const dragged = tree.children[childIdx];
          const childrenWithoutDragged = removeImm(tree.children, childIdx);
          // try inserting the dragged child at every position
          _.range(0, childrenWithoutDragged.length + 1).forEach((insertIdx) => {
            if (insertIdx === childIdx) return;
            replaceNode({
              ...tree,
              children: insertImm(childrenWithoutDragged, insertIdx, dragged),
            });
          });
        }
      }

      // pull up op to associate
      if (config.pullUpOp && isBinaryOp(tree)) {
        const childIdx = tree.children.findIndex((c) => c.id === draggableKey);
        if (childIdx !== -1) {
          const dragged = tree.children[childIdx];
          if (dragged.label === tree.label && isBinaryOp(dragged)) {
            if (childIdx === 0) {
              // left child was dragged up
              // before: ⟦⟪dragged[0], dragged[1]⟫, tree[1]⟧
              // after:  ⟪dragged[0], ⟦dragged[1], tree[1]⟧⟫
              replaceNode({
                ...dragged,
                children: [
                  dragged.children[0],
                  {
                    ...tree,
                    children: [dragged.children[1], tree.children[1]],
                  },
                ],
              });
            } else {
              // right child was dragged up
              // before: ⟦tree[0], ⟪dragged[0], dragged[1]⟫⟧
              // after:  ⟪⟦tree[0], dragged[0]⟧, dragged[1]⟫
              replaceNode({
                ...dragged,
                children: [
                  {
                    ...tree,
                    children: [tree.children[0], dragged.children[0]],
                  },
                  dragged.children[1],
                ],
              });
            }
          }
        }
      }

      // pull down op to associate; we really need a DSL here huh?
      if (config.pullDownOp && tree.id === draggableKey && isBinaryOp(tree)) {
        const child0 = tree.children[0];
        if (isBinaryOp(child0) && child0.label === tree.label) {
          // before: ⟦⟪child[0], child[1]⟫, other⟧
          // after:  ⟪child[0], ⟦child[1], other⟧⟫
          replaceNode({
            ...child0,
            children: [
              child0.children[0],
              {
                ...tree,
                children: [child0.children[1], tree.children[1]],
              },
            ],
          });
        }
        const child1 = tree.children[1];
        if (isBinaryOp(child1) && child1.label === tree.label) {
          // before: ⟦other, ⟪child[0], child[1]⟫⟧
          // after:  ⟪⟦other, child[0]⟧, child[1]⟫
          replaceNode({
            ...child1,
            children: [
              {
                ...tree,
                children: [tree.children[0], child1.children[0]],
              },
              child1.children[1],
            ],
          });
        }
      }

      // pull up "tail" to associate
      // ⟦⟪*A, B⟫, C⟧ → ⟪A, ⟦B, C⟧⟫
      // ⟦A, ⟪B, *C⟫⟧ → ⟪⟦A, B⟧, C⟫
      if (config.pullUpTail && isBinaryOp(tree)) {
        const child0 = tree.children[0];
        if (isBinaryOp(child0) && child0.label === tree.label) {
          const grandchild0 = child0.children[0];
          if (grandchild0.id === draggableKey) {
            // before: ⟦⟪dragged, child0[1]⟫, tree[1]⟧
            // after:  ⟪dragged, ⟦child0[1], tree[1]⟧⟫
            replaceNode({
              ...child0,
              children: [
                grandchild0,
                {
                  ...tree,
                  children: [child0.children[1], tree.children[1]],
                },
              ],
            });
          }
        }
        const child1 = tree.children[1];
        if (isBinaryOp(child1) && child1.label === tree.label) {
          const grandchild1 = child1.children[1];
          if (grandchild1.id === draggableKey) {
            // before: ⟦tree[0], ⟪child1[0], dragged⟫⟧
            // after:  ⟪⟦tree[0], child1[0]⟧, dragged⟫
            replaceNode({
              ...child1,
              children: [
                {
                  ...tree,
                  children: [tree.children[0], child1.children[0]],
                },
                grandchild1,
              ],
            });
          }
        }
      }

      // pull down "tail" to associate
      // ⟦⟪A, B⟫, *C⟧ → ⟪A, ⟦B, C⟧⟫
      if (config.pullDownTail && isBinaryOp(tree)) {
        const [child0, child1] = tree.children;
        if (
          isBinaryOp(child0) &&
          child0.label === tree.label &&
          child1.id === draggableKey
        ) {
          // before: ⟦⟪child0[0], child0[1]⟫, dragged⟧
          // after:  ⟪child0[0], ⟦child0[1], dragged⟧⟫
          replaceNode({
            ...child0,
            children: [
              child0.children[0],
              {
                ...tree,
                children: [child0.children[1], child1],
              },
            ],
          });
        }
        if (
          isBinaryOp(child1) &&
          child1.label === tree.label &&
          child0.id === draggableKey
        ) {
          // before: ⟦dragged, ⟪child1[0], child1[1]⟫⟧
          // after:  ⟪⟦dragged, child1[0]⟧, child1[1]⟫
          replaceNode({
            ...child1,
            children: [
              {
                ...tree,
                children: [child0, child1.children[0]],
              },
              child1.children[1],
            ],
          });
        }
      }

      // recurse
      tree.children.forEach((child, childIdx) =>
        walk(child, (newChild) =>
          replaceNode({
            ...tree,
            children: setImm(tree.children, childIdx, newChild),
          }),
        ),
      );
    }
    walk(state, (newTree) => {
      manifolds.push([newTree]);
    });
    return { manifolds };
  },

  defaultConfig: {
    commutativity: true,
    pullUpOp: false,
    pullDownOp: false,
    pullUpTail: true,
    pullDownTail: true,
  },

  renderConfig: (config, setConfig) => {
    const plus1 = <span className="text-red-600 font-bold">+</span>;
    const plus2 = <span className="text-green-600 font-bold">+</span>;
    const D = ({ children }: { children: React.ReactNode }) => (
      <span className="bg-amber-200 rounded-sm p-0.5">{children}</span>
    );

    return (
      <>
        <ConfigCheckbox
          value={config.commutativity}
          onChange={(newValue) =>
            setConfig({ ...config, commutativity: newValue })
          }
        >
          <b>Commutativity</b>
          <br />
          <D>A</D> {plus1} B → B {plus1} <D>A</D>
        </ConfigCheckbox>

        <ConfigCheckbox
          value={config.pullUpOp}
          onChange={(newValue) => setConfig({ ...config, pullUpOp: newValue })}
        >
          <b>Associativity</b>
          <br />
          Pull up op
          <br />
          <D>(A {plus1} B)</D> {plus2} C →{" "}
          <D>
            A {plus1} (B {plus2} C)
          </D>
        </ConfigCheckbox>

        <ConfigCheckbox
          value={config.pullDownOp}
          onChange={(newValue) =>
            setConfig({ ...config, pullDownOp: newValue })
          }
        >
          <b>Associativity</b>
          <br />
          Pull down op
          <br />
          <D>
            A {plus1} (B {plus2} C)
          </D>{" "}
          → <D>(A {plus1} B)</D> {plus2} C
        </ConfigCheckbox>

        <ConfigCheckbox
          value={config.pullUpTail}
          onChange={(newValue) =>
            setConfig({ ...config, pullUpTail: newValue })
          }
        >
          <b>Associativity</b>
          <br />
          Pull up operand
          <br />(<D>A</D> {plus1} B) {plus2} C → <D>A</D> {plus1} (B {plus2} C)
        </ConfigCheckbox>

        <ConfigCheckbox
          value={config.pullDownTail}
          onChange={(newValue) =>
            setConfig({ ...config, pullDownTail: newValue })
          }
        >
          <b>Associativity</b>
          <br />
          Pull down operand
          <br />
          <D>A</D> {plus1} (B {plus2} C) → (<D>A</D> {plus1} B) {plus2} C
        </ConfigCheckbox>
      </>
    );
  },
};

export const stateNoolTree1: NoolTree = {
  id: "root",
  label: "+",
  children: [
    {
      id: "root/1",
      label: "+",
      children: [
        {
          id: "root/1/1",
          label: "+",
          children: [
            { id: "root/1/1/1", label: "⛅", children: [] },
            {
              id: "root/1/1/2",
              label: "-",
              children: [{ id: "root/1/1/2/1", label: "🍄", children: [] }],
            },
          ],
        },
        { id: "root/1/2", label: "🍄", children: [] },
      ],
    },
    {
      id: "root/2",
      label: "+",
      children: [
        {
          id: "root/2/1",
          label: "×",
          children: [
            { id: "root/2/1/1", label: "🎲", children: [] },
            { id: "root/2/1/2", label: "🦠", children: [] },
          ],
        },
        {
          id: "root/2/2",
          label: "×",
          children: [
            { id: "root/2/2/1", label: "🎲", children: [] },
            { id: "root/2/2/2", label: "🐝", children: [] },
          ],
        },
      ],
    },
  ],
};

export const stateNoolTree2: NoolTree = {
  id: "+1",
  label: "+",
  children: [
    {
      id: "+2",
      label: "+",
      children: [
        { id: "A", label: "A", children: [] },
        { id: "B", label: "B", children: [] },
      ],
    },
    {
      id: "+3",
      label: "+",
      children: [
        { id: "C", label: "C", children: [] },
        { id: "D", label: "D", children: [] },
      ],
    },
  ],
};

function renderNoolTree(tree: NoolTree): {
  diagram: Diagram;
  w: number;
  h: number;
  id: string;
} {
  const GAP = 10;
  const PADDING = 5;
  const LABEL_WIDTH = 20;
  const LABEL_MIN_HEIGHT = 20;
  const renderedChildren = tree.children.map(renderNoolTree);
  const renderedChildrenDiagrams: Diagram[] = [];
  let childY = 0;
  for (const childR of renderedChildren) {
    renderedChildrenDiagrams.push(childR.diagram.translate([0, childY]));
    childY += childR.h + GAP;
  }
  const innerW =
    LABEL_WIDTH +
    (renderedChildren.length > 0
      ? GAP + _.max(renderedChildren.map((c) => c.w))!
      : 0);
  const innerH =
    renderedChildren.length > 0
      ? _.sumBy(renderedChildren, (c) => c.h) +
        GAP * (renderedChildren.length - 1)
      : LABEL_MIN_HEIGHT;
  return {
    diagram: group(
      rectangle({
        // background
        xywh: [0, 0, innerW + PADDING * 2, innerH + PADDING * 2],
        strokeStyle: "gray",
        lineWidth: 1,
      }),
      rectangle({
        // label
        xywh: [PADDING, PADDING, LABEL_WIDTH, innerH],
        label: tree.label,
      }).draggable(tree.id),
      ...(renderedChildren.length > 0
        ? [
            group(renderedChildrenDiagrams).translate([
              PADDING + LABEL_WIDTH + GAP,
              PADDING,
            ]),
          ]
        : []),
    ).absoluteKey(tree.id),
    w: innerW + PADDING * 2,
    h: innerH + PADDING * 2,
    id: tree.id,
  };
}
