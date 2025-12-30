import _ from "lodash";
import { ReactNode } from "react";
import {
  allPossibleRewrites,
  isWildcard,
  Pattern,
  rewr,
  Rewrite,
  Tree,
} from "../asts";
import { ConfigCheckbox, ConfigPanelProps } from "../configurable";
import { configurableManipulable } from "../demos";
import { DragSpec, span, straightTo } from "../DragSpec";
import { Drag } from "../manipulable";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";

export namespace NoolTree {
  // # state etc

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

  type RewriteSet = {
    rewrites: Rewrite[];
    title: ReactNode;
    subtitle?: ReactNode;
    defaultEnabled?: boolean;
  };

  const rewriteSets: RewriteSet[] = [
    {
      title: <>Commutativity</>,
      rewrites: [
        rewr("(+ #A #B)", "(+ B A)"),
        rewr("(× #A #B)", "(× B A)"),
        // comment for line break
      ],
      defaultEnabled: true,
    },
    {
      title: <>Associativity</>,
      subtitle: <>Pull up op</>,
      rewrites: [
        rewr("(+2 #(+1 A B) C)", "(+1 A (+2 B C))"),
        rewr("(+1 A #(+2 B C))", "(+2 (+1 A B) C)"),
        rewr("(×2 #(×1 A B) C)", "(×1 A (×2 B C))"),
        rewr("(×1 A #(×2 B C))", "(×2 (×1 A B) C)"),
      ],
    },
    {
      title: <>Associativity</>,
      subtitle: <>Pull down op</>,
      rewrites: [
        rewr("#(+1 A (+2 B C))", "(+2 (+1 A B) C)"),
        rewr("#(+2 (+1 A B) C)", "(+1 A (+2 B C))"),
        rewr("#(×1 A (×2 B C))", "(×2 (×1 A B) C)"),
        rewr("#(×2 (×1 A B) C)", "(×1 A (×2 B C))"),
      ],
    },
    {
      title: <>Associativity</>,
      subtitle: <>Pull up operand</>,
      rewrites: [
        rewr("(+2 (+1 #A B) C)", "(+1 A (+2 B C))"),
        rewr("(+1 A (+2 #B C))", "(+2 (+1 A B) C)"),
        rewr("(×2 (×1 #A B) C)", "(×1 A (×2 B C))"),
        rewr("(×1 A (×2 #B C))", "(×2 (×1 A B) C)"),
      ],
      defaultEnabled: true,
    },
    {
      title: <>Associativity</>,
      subtitle: <>Pull down operand</>,
      rewrites: [
        rewr("(+1 #A (+2 B C))", "(+2 (+1 A B) C)"),
        rewr("(+2 (+1 A B) #C)", "(+1 A (+2 B C))"),
        rewr("(×1 #A (×2 B C))", "(×2 (×1 A B) C)"),
        rewr("(×2 (×1 A B) #C)", "(×1 A (×2 B C))"),
      ],
      defaultEnabled: true,
    },
    {
      title: <>Associativity</>,
      subtitle: (
        <>
          Pull op sideways
          <br />
          <span className="italic text-red-500">
            (Conflicts with commutativity!)
          </span>
        </>
      ),
      rewrites: [
        rewr("(+2 #(+1 A B) C)", "(+2 A #(+1 B C))"),
        rewr("(+1 A #(+2 B C))", "(+1 #(+2 A B) C)"),
        rewr("(×2 #(×1 A B) C)", "(×2 A #(×1 B C))"),
        rewr("(×1 A #(×2 B C))", "(×1 #(×2 A B) C)"),
      ],
    },
  ];

  type Config = {
    activeRewriteSets: boolean[];
  };

  const defaultConfig: Config = {
    activeRewriteSets: rewriteSets.map((rs) => rs.defaultEnabled ?? false),
  };

  export const manipulable = configurableManipulable<State, Config>(
    { defaultConfig, ConfigPanel },
    (config, { state, drag }) => {
      return renderTree(state, state, drag, config).element;
    }
  );

  function renderTree(
    state: State,
    tree: Tree,
    drag: Drag<State>,
    config: Config
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
      renderTree(state, child, drag, config)
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
    const newTrees = allPossibleRewrites(
      state,
      _.zip(rewriteSets, config.activeRewriteSets).flatMap(([set, enabled]) =>
        enabled ? set!.rewrites : []
      ),
      draggedKey
    );

    return [span(state), newTrees.map(straightTo)];
  }

  const drawRewrite = (rewrite: Rewrite) => {
    function findFirstTriggerId(pattern: Pattern): string | null {
      if (pattern.isTrigger) {
        return pattern.id;
      }
      if (!isWildcard(pattern)) {
        for (const child of pattern.children) {
          const result = findFirstTriggerId(child);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    }
    const firstTriggerId = findFirstTriggerId(rewrite.from);
    return (
      <>
        {drawPattern(rewrite.from, true, firstTriggerId)} →{" "}
        {drawPattern(rewrite.to, true, firstTriggerId)}
      </>
    );
  };

  const drawPattern = (
    pattern: Pattern,
    topLevel: boolean,
    firstTriggerId: string | null
  ): ReactNode => {
    let contents;
    if (isWildcard(pattern)) {
      contents = pattern.id;
    } else {
      const opById: Record<string, ReactNode> = {
        "+": <span className="text-red-600 font-bold">+</span>,
        "+1": <span className="text-red-600 font-bold">+</span>,
        "+2": <span className="text-green-600 font-bold">+</span>,
      };
      contents = (
        <>
          {topLevel ? "" : "("}
          {pattern.children.length > 0 &&
            pattern.children.map((child, i) => [
              i > 0 && <> {opById[pattern.id]} </>,
              drawPattern(child, false, firstTriggerId),
            ])}
          {topLevel ? "" : ")"}
        </>
      );
    }

    if (pattern.id === firstTriggerId) {
      return <span className="bg-amber-200 rounded-sm p-0.5">{contents}</span>;
    } else {
      return contents;
    }
  };

  function ConfigPanel({ config, setConfig }: ConfigPanelProps<Config>) {
    return rewriteSets.map((rewriteSet, i) => (
      <ConfigCheckbox
        key={i}
        value={config.activeRewriteSets[i]}
        onChange={(v) => {
          const newActive = [...config.activeRewriteSets];
          newActive[i] = v;
          setConfig({ ...config, activeRewriteSets: newActive });
        }}
      >
        <b>{rewriteSet.title}</b>
        {rewriteSet.subtitle && (
          <>
            <br />
            {rewriteSet.subtitle}
          </>
        )}
        <br />
        {rewriteSet.rewrites.length > 0 && drawRewrite(rewriteSet.rewrites[0])}
      </ConfigCheckbox>
    ));
  }
}
