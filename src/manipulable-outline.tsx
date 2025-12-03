import { span } from "./DragSpec";
import { Drag, Manipulable, translate } from "./manipulable";
import { Svgx } from "./svgx";

export namespace Outline {
  export type Tree = {
    id: string;
    label: string;
    children: Tree[];
  };

  export type State = Tree;

  const HEIGHT = 25;
  const WIDTH = 100;
  const INDENT = 20;

  function renderTree(
    tree: Tree,
    rootState: Tree,
    draggedId: string | null,
    drag: Drag<Tree>
  ): {
    elem: Svgx;
    h: number;
  } {
    const isDragged = tree.id === draggedId;
    const zIndex = isDragged ? 1 : 0;

    const block = (
      <g
        data-on-drag={drag(() => {
          const newState = structuredClone(rootState);
          // Remove the dragged node from its current location
          let foundNode: Tree | null = null;
          function removeKey(node: Tree): boolean {
            for (let i = 0; i < node.children.length; i++) {
              if (node.children[i].id === tree.id) {
                foundNode = node.children[i];
                node.children.splice(i, 1);
                return true;
              }
              if (removeKey(node.children[i])) {
                return true;
              }
            }
            return false;
          }
          removeKey(newState);
          if (!foundNode) {
            return [];
          }

          return span(insertAtAllPositions(newState, foundNode));
        })}
      >
        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          stroke="gray"
          strokeWidth={1}
          fill="white"
        />
        <text
          x={5}
          y={HEIGHT / 2}
          dominantBaseline="middle"
          textAnchor="start"
          fontSize={14}
          fill="black"
        >
          {tree.label}
        </text>
      </g>
    );

    let y = HEIGHT;

    return {
      elem: (
        <g id={tree.id} data-z-index={zIndex}>
          {block}
          {tree.children.map((child) => {
            const childRender = renderTree(child, rootState, draggedId, drag);
            const childPositioned = (
              <g id={`position-${child.id}`} transform={translate(INDENT, y)}>
                {childRender.elem}
              </g>
            );
            y += childRender.h;
            return childPositioned;
          })}
        </g>
      ),
      h: y,
    };
  }

  function insertAtAllPositions(tree: Tree, child: Tree): Tree[] {
    // All trees obtained by inserting `child` somewhere in the subtree rooted at `node`.
    function helper(node: Tree): Tree[] {
      const results: Tree[] = [];

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

  export const manipulable: Manipulable<State> = ({
    state,
    drag,
    draggedId,
  }) => {
    return (
      <g transform={translate(10, 10)}>
        {renderTree(state, state, draggedId, drag).elem}
      </g>
    );
  };

  export const state1: State = {
    id: "root",
    label: "+",
    children: [
      {
        id: "A",
        label: "A",
        children: [],
      },
      {
        id: "B",
        label: "B",
        children: [],
      },
    ],
  };

  export const state3: State = {
    id: "root",
    label: "+",
    children: [
      {
        id: "root-1",
        label: "+",
        children: [
          {
            id: "root-1-1",
            label: "+",
            children: [
              { id: "root-1-1-1", label: "⛅", children: [] },
              {
                id: "root-1-1-2",
                label: "-",
                children: [{ id: "root-1-1-2-1", label: "🍄", children: [] }],
              },
            ],
          },
          { id: "root-1-2", label: "🍄", children: [] },
        ],
      },
      {
        id: "root-2",
        label: "+",
        children: [
          {
            id: "root-2-1",
            label: "×",
            children: [
              { id: "root-2-1-1", label: "🎲", children: [] },
              { id: "root-2-1-2", label: "🦠", children: [] },
            ],
          },
          {
            id: "root-2-2",
            label: "×",
            children: [
              { id: "root-2-2-1", label: "🎲", children: [] },
              { id: "root-2-2-2", label: "🐝", children: [] },
            ],
          },
        ],
      },
    ],
  };

  export const state2: State = {
    id: "plus-1",
    label: "+",
    children: [
      {
        id: "plus-2",
        label: "+",
        children: [
          { id: "A", label: "A", children: [] },
          { id: "B", label: "B", children: [] },
        ],
      },
      {
        id: "plus-3",
        label: "+",
        children: [
          { id: "C", label: "C", children: [] },
          { id: "D", label: "D", children: [] },
        ],
      },
    ],
  };

  export const stateTreeOfLife: State = {
    id: "animalia",
    label: "Animalia",
    children: [
      {
        id: "chordata",
        label: "Chordata",
        children: [
          {
            id: "mammalia",
            label: "Mammalia",
            children: [
              {
                id: "carnivora",
                label: "Carnivora",
                children: [
                  {
                    id: "felidae",
                    label: "Felidae",
                    children: [
                      { id: "cat", label: "🐱 Cat", children: [] },
                      { id: "lion", label: "🦁 Lion", children: [] },
                      { id: "tiger", label: "🐯 Tiger", children: [] },
                    ],
                  },
                  {
                    id: "canidae",
                    label: "Canidae",
                    children: [
                      { id: "dog", label: "🐕 Dog", children: [] },
                      { id: "fox", label: "🦊 Fox", children: [] },
                      { id: "wolf", label: "🐺 Wolf", children: [] },
                    ],
                  },
                ],
              },
              {
                id: "primates",
                label: "Primates",
                children: [
                  { id: "monkey", label: "🐵 Monkey", children: [] },
                  { id: "gorilla", label: "🦍 Gorilla", children: [] },
                  { id: "orangutan", label: "🦧 Orangutan", children: [] },
                ],
              },
              {
                id: "cetacea",
                label: "Cetacea",
                children: [
                  { id: "whale", label: "🐋 Whale", children: [] },
                  { id: "dolphin", label: "🐬 Dolphin", children: [] },
                ],
              },
            ],
          },
          {
            id: "aves",
            label: "Aves",
            children: [
              { id: "eagle", label: "🦅 Eagle", children: [] },
              { id: "parrot", label: "🦜 Parrot", children: [] },
              { id: "penguin", label: "🐧 Penguin", children: [] },
              { id: "owl", label: "🦉 Owl", children: [] },
            ],
          },
          {
            id: "reptilia",
            label: "Reptilia",
            children: [
              { id: "turtle", label: "🐢 Turtle", children: [] },
              { id: "lizard", label: "🦎 Lizard", children: [] },
              { id: "crocodile", label: "🐊 Crocodile", children: [] },
              { id: "snake", label: "🐍 Snake", children: [] },
            ],
          },
        ],
      },
      {
        id: "arthropoda",
        label: "Arthropoda",
        children: [
          {
            id: "insecta",
            label: "Insecta",
            children: [
              { id: "butterfly", label: "🦋 Butterfly", children: [] },
              { id: "bee", label: "🐝 Bee", children: [] },
              { id: "ant", label: "🐜 Ant", children: [] },
              { id: "ladybug", label: "🐞 Ladybug", children: [] },
            ],
          },
          {
            id: "arachnida",
            label: "Arachnida",
            children: [
              { id: "spider", label: "🕷️ Spider", children: [] },
              { id: "scorpion", label: "🦂 Scorpion", children: [] },
            ],
          },
        ],
      },
      {
        id: "mollusca",
        label: "Mollusca",
        children: [
          { id: "octopus", label: "🐙 Octopus", children: [] },
          { id: "squid", label: "🦑 Squid", children: [] },
          { id: "snail", label: "🐌 Snail", children: [] },
        ],
      },
    ],
  };
}
