import _ from "lodash";
import { ReactNode, useMemo, useState } from "react";
import {
  allPossibleRewrites,
  isWildcard,
  Pattern,
  rewr,
  Rewrite,
  Tree,
} from "../asts";
import { ConfigCheckbox, ConfigPanel, DemoDraggable } from "../demo-ui";
import { Draggable } from "../draggable";
import { type DragSpecBuilders } from "../DragSpec";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";

type State = Tree;

const initialState1: State = {
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

const initialState2: State = {
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
    rewrites: [rewr("(+ #A #B)", "(+ B A)"), rewr("(× #A #B)", "(× B A)")],
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

const defaultActiveRewriteSets = rewriteSets.map(
  (rs) => rs.defaultEnabled ?? false,
);

function draggableFactory(activeRewrites: Rewrite[]): Draggable<State> {
  return ({ state, d }) => renderTree(state, state, d, activeRewrites).element;
}

function renderTree(
  state: State,
  tree: Tree,
  d: DragSpecBuilders<State>,
  activeRewrites: Rewrite[],
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
    renderTree(state, child, d, activeRewrites),
  );

  const renderedChildrenElements: Svgx[] = [];
  let childY = 0;
  for (const childR of renderedChildren) {
    renderedChildrenElements.push(
      <g transform={translate(0, childY)}>{childR.element}</g>,
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
        data-on-drag={() => dragTargets(d, state, tree.id, activeRewrites)}
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

function dragTargets(
  d: DragSpecBuilders<State>,
  state: State,
  draggedKey: string,
  activeRewrites: Rewrite[],
) {
  const newTrees = allPossibleRewrites(state, activeRewrites, draggedKey);
  if (newTrees.length === 0) return d.span([state]);
  return d.closest(newTrees.map((newTree) => d.span([state, newTree])));
}

// # Rewrite rule display

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
  firstTriggerId: string | null,
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

// # Config panel

function RewriteRuleCheckboxes({
  activeRewriteSets,
  setActiveRewriteSets,
}: {
  activeRewriteSets: boolean[];
  setActiveRewriteSets: (v: boolean[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {rewriteSets.map((rewriteSet, i) => (
        <ConfigCheckbox
          key={i}
          value={activeRewriteSets[i]}
          onChange={(v) => {
            const newActive = [...activeRewriteSets];
            newActive[i] = v;
            setActiveRewriteSets(newActive);
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
          {rewriteSet.rewrites.length > 0 &&
            drawRewrite(rewriteSet.rewrites[0])}
        </ConfigCheckbox>
      ))}
    </div>
  );
}

// # Component

export const NoolTree = () => {
  const [activeRewriteSets, setActiveRewriteSets] = useState(
    defaultActiveRewriteSets,
  );

  const activeRewrites = useMemo(
    () =>
      _.zip(rewriteSets, activeRewriteSets).flatMap(([set, enabled]) =>
        enabled ? set!.rewrites : [],
      ),
    [activeRewriteSets],
  );

  const draggable = useMemo(
    () => draggableFactory(activeRewrites),
    [activeRewrites],
  );

  return (
    <div className="flex flex-col md:flex-row gap-4 items-start">
      <div>
        <h3 className="text-md font-medium italic mt-6 mb-1">state 1</h3>
        <DemoDraggable
          draggable={draggable}
          initialState={initialState1}
          width={300}
          height={350}
        />
        <h3 className="text-md font-medium italic mt-6 mb-1">state 2</h3>
        <DemoDraggable
          draggable={draggable}
          initialState={initialState2}
          width={300}
          height={300}
        />
      </div>
      <ConfigPanel title="Active rewrite rules">
        <RewriteRuleCheckboxes
          activeRewriteSets={activeRewriteSets}
          setActiveRewriteSets={setActiveRewriteSets}
        />
      </ConfigPanel>
    </div>
  );
};
