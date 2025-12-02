import _ from "lodash";
import { ConfigCheckbox } from "./config-controls";
import { ConfigPanelProps } from "./Demo";
import { DragSpec, straightTo } from "./DragSpec";
import { SvgElem } from "./jsx-flatten";
import { Drag, Manipulable, translate } from "./manipulable";
import { insertImm, removeImm, setImm } from "./utils";

export namespace NoolTree {
  // # trees

  export type Tree = {
    id: string;
    label: string;
    children: Tree[];
  };

  function isOp(node: Tree): boolean {
    return node.label === "+" || node.label === "×";
  }

  function isBinaryOp(node: Tree): boolean {
    return isOp(node) && node.children.length === 2;
  }

  // # state etc

  export type State = Tree;

  export type Config = {
    commutativity: boolean;
    pullUpOp: boolean;
    pullDownOp: boolean;
    pullUpTail: boolean;
    pullDownTail: boolean;
  };

  export const defaultConfig: Config = {
    commutativity: true,
    pullUpOp: false,
    pullDownOp: false,
    pullUpTail: true,
    pullDownTail: true,
  };

  export const manipulable: Manipulable<State, Config> = ({
    state,
    drag,
    config,
  }) => {
    return renderTree(state, state, drag, config).element;
  };

  function renderTree(
    state: State,
    tree: Tree,
    drag: Drag<State>,
    config: Config
  ): {
    element: SvgElem;
    w: number;
    h: number;
    id: string;
  } {
    const GAP = 10;
    const PADDING = 5;
    const LABEL_WIDTH = 20;
    const LABEL_MIN_HEIGHT = 20;

    const renderedChildren = tree.children.map((child) =>
      renderTree(state, child, drag, config)
    );

    const renderedChildrenElements: SvgElem[] = [];
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
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={innerW + PADDING * 2}
          height={innerH + PADDING * 2}
          stroke="gray"
          strokeWidth={1}
          fill="none"
        />
        {/* Label - draggable text */}
        <text
          x={PADDING + LABEL_WIDTH / 2}
          y={PADDING + innerH / 2}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={20}
          fill="black"
          data-on-drag={drag(() => dragTargets(state, tree.id, config))}
        >
          {tree.label}
        </text>
        ,{/* Children */}
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

  function dragTargets(
    state: State,
    draggedKey: string,
    config: Config
  ): DragSpec<State> {
    function walk(currentTree: Tree, replaceNode: (newNode: Tree) => void) {
      // commutativity
      if (config.commutativity && isOp(currentTree)) {
        const childIdx = currentTree.children.findIndex(
          (c) => c.id === draggedKey
        );
        if (childIdx !== -1) {
          const dragged = currentTree.children[childIdx];
          const childrenWithoutDragged = removeImm(
            currentTree.children,
            childIdx
          );
          _.range(0, childrenWithoutDragged.length + 1).forEach((insertIdx) => {
            if (insertIdx === childIdx) return;
            replaceNode({
              ...currentTree,
              children: insertImm(childrenWithoutDragged, insertIdx, dragged),
            });
          });
        }
      }

      // pull up op to associate
      if (config.pullUpOp && isBinaryOp(currentTree)) {
        const childIdx = currentTree.children.findIndex(
          (c) => c.id === draggedKey
        );
        if (childIdx !== -1) {
          const dragged = currentTree.children[childIdx];
          if (dragged.label === currentTree.label && isBinaryOp(dragged)) {
            if (childIdx === 0) {
              replaceNode({
                ...dragged,
                children: [
                  dragged.children[0],
                  {
                    ...currentTree,
                    children: [dragged.children[1], currentTree.children[1]],
                  },
                ],
              });
            } else {
              replaceNode({
                ...dragged,
                children: [
                  {
                    ...currentTree,
                    children: [currentTree.children[0], dragged.children[0]],
                  },
                  dragged.children[1],
                ],
              });
            }
          }
        }
      }

      // pull down op to associate
      if (
        config.pullDownOp &&
        currentTree.id === draggedKey &&
        isBinaryOp(currentTree)
      ) {
        const child0 = currentTree.children[0];
        if (isBinaryOp(child0) && child0.label === currentTree.label) {
          replaceNode({
            ...child0,
            children: [
              child0.children[0],
              {
                ...currentTree,
                children: [child0.children[1], currentTree.children[1]],
              },
            ],
          });
        }
        const child1 = currentTree.children[1];
        if (isBinaryOp(child1) && child1.label === currentTree.label) {
          replaceNode({
            ...child1,
            children: [
              {
                ...currentTree,
                children: [currentTree.children[0], child1.children[0]],
              },
              child1.children[1],
            ],
          });
        }
      }

      // pull up "tail" to associate
      if (config.pullUpTail && isBinaryOp(currentTree)) {
        const child0 = currentTree.children[0];
        if (isBinaryOp(child0) && child0.label === currentTree.label) {
          const grandchild0 = child0.children[0];
          if (grandchild0.id === draggedKey) {
            replaceNode({
              ...child0,
              children: [
                grandchild0,
                {
                  ...currentTree,
                  children: [child0.children[1], currentTree.children[1]],
                },
              ],
            });
          }
        }
        const child1 = currentTree.children[1];
        if (isBinaryOp(child1) && child1.label === currentTree.label) {
          const grandchild1 = child1.children[1];
          if (grandchild1.id === draggedKey) {
            replaceNode({
              ...child1,
              children: [
                {
                  ...currentTree,
                  children: [currentTree.children[0], child1.children[0]],
                },
                grandchild1,
              ],
            });
          }
        }
      }

      // pull down "tail" to associate
      if (config.pullDownTail && isBinaryOp(currentTree)) {
        const [child0, child1] = currentTree.children;
        if (
          isBinaryOp(child0) &&
          child0.label === currentTree.label &&
          child1.id === draggedKey
        ) {
          replaceNode({
            ...child0,
            children: [
              child0.children[0],
              {
                ...currentTree,
                children: [child0.children[1], child1],
              },
            ],
          });
        }
        if (
          isBinaryOp(child1) &&
          child1.label === currentTree.label &&
          child0.id === draggedKey
        ) {
          replaceNode({
            ...child1,
            children: [
              {
                ...currentTree,
                children: [child0, child1.children[0]],
              },
              child1.children[1],
            ],
          });
        }
      }

      // recurse
      currentTree.children.forEach((child, childIdx) =>
        walk(child, (newChild) =>
          replaceNode({
            ...currentTree,
            children: setImm(currentTree.children, childIdx, newChild),
          })
        )
      );
    }

    const spec: DragSpec<State> = [];
    walk(state, (newTree) => {
      spec.push(straightTo(newTree));
    });
    return spec;
  }

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

  export function ConfigPanel({ config, setConfig }: ConfigPanelProps<Config>) {
    const plus1 = <span className="text-red-600 font-bold">+</span>;
    const plus2 = <span className="text-green-600 font-bold">+</span>;
    const D = ({ children }: { children: React.ReactNode }) => (
      <span className="bg-amber-200 rounded-sm p-0.5">{children}</span>
    );

    return (
      <>
        <ConfigCheckbox
          value={config.commutativity}
          onChange={(v) => setConfig({ ...config, commutativity: v })}
        >
          <b>Commutativity</b>
          <br />
          <D>A</D> {plus1} B → B {plus1} <D>A</D>
        </ConfigCheckbox>

        <ConfigCheckbox
          value={config.pullUpOp}
          onChange={(v) => setConfig({ ...config, pullUpOp: v })}
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
          onChange={(v) => setConfig({ ...config, pullDownOp: v })}
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
          onChange={(v) => setConfig({ ...config, pullUpTail: v })}
        >
          <b>Associativity</b>
          <br />
          Pull up operand
          <br />(<D>A</D> {plus1} B) {plus2} C → <D>A</D> {plus1} (B {plus2} C)
        </ConfigCheckbox>

        <ConfigCheckbox
          value={config.pullDownTail}
          onChange={(v) => setConfig({ ...config, pullDownTail: v })}
        >
          <b>Associativity</b>
          <br />
          Pull down operand
          <br />
          <D>A</D> {plus1} (B {plus2} C) → (<D>A</D> {plus1} B) {plus2} C
        </ConfigCheckbox>
      </>
    );
  }
}
