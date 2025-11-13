import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, keyed, keyedGroup, Shape, transform } from "./shape";
import { insert, remove, set } from "./utils";

type NoolTree = {
  id: string;
  label: string;
  children: NoolTree[];
};

function renderNoolTree(tree: NoolTree): {
  shape: Shape;
  w: number;
  h: number;
  id: string;
} {
  const GAP = 10;
  const PADDING = 5;
  const LABEL_WIDTH = 20;
  const LABEL_MIN_HEIGHT = 20;
  const renderedChildren = tree.children.map(renderNoolTree);
  const renderedChildrenShape = keyedGroup();
  let childY = 0;
  for (const childR of renderedChildren) {
    renderedChildrenShape.shapes[childR.id] = transform(
      [0, childY],
      childR.shape,
    );
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
    shape: keyed(
      tree.id,
      true,
      group("node", [
        {
          // background rectangle
          type: "rectangle" as const,
          xywh: [0, 0, innerW + PADDING * 2, innerH + PADDING * 2],
          strokeStyle: "gray",
          lineWidth: 1,
        } satisfies Shape,
        {
          // label rectangle
          type: "rectangle" as const,
          xywh: [PADDING, PADDING, LABEL_WIDTH, innerH],
          label: tree.label,
        } satisfies Shape,
        ...(renderedChildren.length > 0
          ? [
              transform(
                [PADDING + LABEL_WIDTH + GAP, PADDING],
                renderedChildrenShape,
              ),
            ]
          : []),
      ]),
    ),
    w: innerW + PADDING * 2,
    h: innerH + PADDING * 2,
    id: tree.id,
  };
}

function isOp(node: NoolTree): boolean {
  return node.label === "+" || node.label === "×";
}

function isBinaryOp(node: NoolTree): boolean {
  return isOp(node) && node.children.length === 2;
}

export const manipulableNoolTree: Manipulable<NoolTree> = {
  render(state) {
    return renderNoolTree(state).shape;
  },

  accessibleFrom(state, draggableKey) {
    const manifolds: NoolTree[][] = [[state]];
    // walk the tree
    function walk(tree: NoolTree, replaceNode: (newNode: NoolTree) => void) {
      // commutativity
      if (isOp(tree)) {
        const childIdx = tree.children.findIndex((c) => c.id === draggableKey);
        if (childIdx !== -1) {
          const dragged = tree.children[childIdx];
          const childrenWithoutDragged = remove(tree.children, childIdx);
          // try inserting the dragged child at every position
          _.range(0, childrenWithoutDragged.length + 1).forEach((insertIdx) => {
            if (insertIdx === childIdx) return;
            replaceNode({
              ...tree,
              children: insert(childrenWithoutDragged, insertIdx, dragged),
            });
          });
        }
      }

      // pull up op to associate
      if (false && isBinaryOp(tree)) {
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
      if (false && tree.id === draggableKey && isBinaryOp(tree)) {
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
      if (isBinaryOp(tree)) {
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
      if (isBinaryOp(tree)) {
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
            children: set(tree.children, childIdx, newChild),
          }),
        ),
      );
    }
    walk(state, (newTree) => {
      manifolds.push([state, newTree]);
    });
    return { manifolds };
  },
};
