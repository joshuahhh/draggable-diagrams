import _ from "lodash";
import { allPossibleRewrites, rewr, Rewrite, Tree } from "../asts";
import { closest, span } from "../DragSpec2";
import { Drag, Manipulable } from "../manipulable2";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";

export namespace NoolTree {
  export type State = Tree;

  export const state1: State = {
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

  // Default-enabled rewrite sets from the v1 config
  const rewrites: Rewrite[] = [
    // Commutativity
    rewr("(+ #A #B)", "(+ B A)"),
    rewr("(× #A #B)", "(× B A)"),
    // Associativity: Pull up operand
    rewr("(+2 (+1 #A B) C)", "(+1 A (+2 B C))"),
    rewr("(+1 A (+2 #B C))", "(+2 (+1 A B) C)"),
    rewr("(×2 (×1 #A B) C)", "(×1 A (×2 B C))"),
    rewr("(×1 A (×2 #B C))", "(×2 (×1 A B) C)"),
    // Associativity: Pull down operand
    rewr("(+1 #A (+2 B C))", "(+2 (+1 A B) C)"),
    rewr("(+2 (+1 A B) #C)", "(+1 A (+2 B C))"),
    rewr("(×1 #A (×2 B C))", "(×2 (×1 A B) C)"),
    rewr("(×2 (×1 A B) #C)", "(×1 A (×2 B C))"),
  ];

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    return renderTree(state, state, drag).element;
  };

  function renderTree(
    state: State,
    tree: Tree,
    drag: Drag<State>
  ): {
    element: Svgx;
    w: number;
    h: number;
    id: string;
  } {
    const GAP = 10;
    const PADDING = 5;
    const LABEL_WIDTH = 20;
    const LABEL_MIN_HEIGHT = 20;

    const renderedChildren = tree.children.map((child) =>
      renderTree(state, child, drag)
    );

    const renderedChildrenElements: Svgx[] = [];
    let childY = 0;
    for (const childR of renderedChildren) {
      renderedChildrenElements.push(
        <g transform={translate(0, childY)}>{childR.element}</g>
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

    const element = (
      <g id={tree.id}>
        <rect
          x={0}
          y={0}
          width={innerW + PADDING * 2}
          height={innerH + PADDING * 2}
          stroke="gray"
          strokeWidth={1}
          fill="none"
        />
        <text
          x={PADDING + LABEL_WIDTH / 2}
          y={PADDING + innerH / 2}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={20}
          fill="black"
          data-on-drag={drag(() => dragTargets(state, tree.id))}
        >
          {tree.label}
        </text>
        {renderedChildren.length > 0 && (
          <g transform={translate(PADDING + LABEL_WIDTH + GAP, PADDING)}>
            {renderedChildrenElements}
          </g>
        )}
      </g>
    );

    return {
      element,
      w: innerW + PADDING * 2,
      h: innerH + PADDING * 2,
      id: tree.id,
    };
  }

  function dragTargets(state: State, draggedKey: string) {
    const newTrees = allPossibleRewrites(state, rewrites, draggedKey);
    if (newTrees.length === 0) return span([state]);
    return closest(newTrees.map((newTree) => span([state, newTree])));
  }
}
