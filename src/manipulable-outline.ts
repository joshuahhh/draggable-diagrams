import { Manipulable } from "./manipulable";
import { Diagram, group, rectangle } from "./shape";

type Outline = {
  id: string;
  label: string;
  children: Outline[];
};

function renderOutline(tree: Outline): {
  diagram: Diagram;
  h: number;
} {
  const HEIGHT = 25;
  const WIDTH = 50;
  const INDENT = 20;
  const diagrams: Diagram[] = [];
  diagrams.push(
    rectangle({
      xywh: [0, 0, WIDTH, HEIGHT],
      strokeStyle: "gray",
      lineWidth: 1,
      label: tree.label,
    })
      .draggable(tree.id)
      .absoluteKey(tree.id),
  );
  let y = HEIGHT;
  tree.children.forEach((child) => {
    const childRender = renderOutline(child);
    diagrams.push(childRender.diagram.translate([INDENT, y]));
    y += childRender.h;
  });
  return {
    diagram: group(diagrams),
    h: y,
  };
}

function insertAtAllPositions(tree: Outline, child: Outline): Outline[] {
  // All trees obtained by inserting `child` somewhere in the subtree rooted at `node`.
  function helper(node: Outline): Outline[] {
    const results: Outline[] = [];

    // 1. Insert `child` as a direct child of `node` at every index.
    const len = node.children.length;
    for (let i = 0; i <= len; i++) {
      const newChildren = [
        ...node.children.slice(0, i),
        child,
        ...node.children.slice(i),
      ];
      results.push({
        ...node,
        children: newChildren,
      });
    }

    // 2. Recurse into each child: for each way of inserting inside that child,
    //    rebuild the current node with that modified child.
    for (let i = 0; i < len; i++) {
      const originalChild = node.children[i];
      const subtreeVariants = helper(originalChild);
      for (const variant of subtreeVariants) {
        const newChildren = node.children.slice();
        newChildren[i] = variant;
        results.push({
          ...node,
          children: newChildren,
        });
      }
    }

    return results;
  }

  // We want all ways of inserting anywhere under `tree` (including as direct child of root),
  // keeping `tree` itself unchanged.
  return helper(tree);
}

export const manipulableOutline: Manipulable<Outline> = {
  sourceFile: "manipulable-outline.tsx",

  render(state) {
    return renderOutline(state).diagram;
  },

  accessibleFrom(state, draggableKey) {
    const newState = structuredClone(state);
    // search for and remove the draggableKey from its current location
    let foundNode: Outline | null = null;
    function removeKey(tree: Outline): boolean {
      for (let i = 0; i < tree.children.length; i++) {
        if (tree.children[i].id === draggableKey) {
          foundNode = tree.children[i];
          tree.children.splice(i, 1);
          return true;
        }
        if (removeKey(tree.children[i])) {
          return true;
        }
      }
      return false;
    }
    removeKey(newState);
    if (!foundNode) {
      return [];
    }

    return insertAtAllPositions(newState, foundNode);
  },
};

export const stateOutline1: Outline = {
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

export const stateOutline2: Outline = {
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
