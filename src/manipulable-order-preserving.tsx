import _ from "lodash";
import { ConfigCheckbox } from "./config-controls";
import { ConfigPanelProps } from "./Demo";
import { span } from "./DragSpec";
import { SvgElem } from "./jsx-flatten";
import { overlapIntervals } from "./layout";
import { Manipulable, translate } from "./manipulable";
import {
  Finalizers,
  pointRef,
  PointRef,
  resolvePointRef,
} from "./svg-finalizers";
import {
  buildHasseDiagram,
  HasseDiagram,
  tree3,
  tree7,
  TreeMorph,
  TreeNode,
} from "./trees";
import { assert } from "./utils";
import { Vec2 } from "./vec2";

// HELPERS
const least = (arr: Array<any>, scorer: Function) => {
  if (arr.length === 0) {
    return undefined; // Or handle as appropriate for an empty array
  }

  return arr.reduce(
    ([bestScore, bestEl], currentElement) => {
      const score = scorer(currentElement);
      if (score < bestScore) {
        return [score, currentElement];
      } else {
        return [bestScore, bestEl];
      }
    },
    [Infinity, undefined]
  )[1];
};
// returns the path from `node` to another node `n` such that `pred(n)==true`.
const traverseUntilPred = (
  node: any,
  next: (n: any) => any[],
  pred: (n: any) => boolean
) => {
  const visited = new Set([node]);
  const todo: [any, any][] = [[node, []]];
  while (todo.length > 0) {
    const [cur, path] = todo.pop()!;
    if (pred(cur)) return path;

    for (const nxt of next(cur)) {
      if (!visited.has(nxt)) {
        todo.push([nxt, [...path, nxt]]);
        visited.add(nxt);
      }
    }
  }
};
const sum = (ns: number[]) => ns.reduce((acc, cur) => acc + cur, 0);

export namespace OrderPreserving {
  export type State = {
    domainTree: TreeNode;
    codomainTree: TreeNode;
    hasseDiagram: HasseDiagram;
    // all we are doing is changing the current morphism
    curMorphIdx: number;
    yForTradRep: number;
  };

  export type Config = {
    showTradRep: boolean;
  };

  export const defaultConfig: Config = {
    showTradRep: false,
  };

  export const manipulable: Manipulable<State, Config> = ({
    state,
    drag,
    config,
  }) => {
    const morph = state.hasseDiagram.nodes[state.curMorphIdx];
    const elements: SvgElem[] = [];
    const finalizers = new Finalizers();

    const r = drawBgTree(
      state.codomainTree,
      state.domainTree,
      morph,
      finalizers,
      state,
      drag
    );
    elements.push(r.element);

    if (config.showTradRep) {
      const domNodeCenters: Record<string, PointRef> = {};
      const domR = drawTree(
        state.domainTree,
        "domain",
        "fg",
        domNodeCenters,
        finalizers
      );
      elements.push(
        <g transform={translate(0, state.yForTradRep)}>{domR.element}</g>
      );

      const codNodeCenters: Record<string, PointRef> = {};
      const codR = drawTree(
        state.codomainTree,
        "codomain",
        "bg",
        codNodeCenters,
        finalizers
      );
      elements.push(
        <g transform={translate(domR.w + 40, state.yForTradRep)}>
          {codR.element}
        </g>
      );

      for (const [domElem, codElem] of Object.entries(morph)) {
        finalizers.push((tree) => {
          const domRef = domNodeCenters[domElem];
          assert(!!domRef, "domRef is undefined");
          const codRef = codNodeCenters[codElem];
          assert(!!codRef, "codRef is undefined");
          const from = resolvePointRef(domRef, tree);
          const to = resolvePointRef(codRef, tree);
          const fromAdjusted = from.towards(to, FG_NODE_SIZE / 2);
          const mid = from.lerp(to, 0.5).add(Vec2(0, -10));

          return (
            <path
              id={`morphism-arrow-${domElem}`}
              d={`M ${fromAdjusted.x} ${fromAdjusted.y} Q ${mid.x} ${mid.y} ${to.x} ${to.y}`}
              fill="none"
              stroke="#4287f5"
              strokeWidth={2}
              data-z-index={-1}
            />
          );
        });
      }
    }

    const mainTree = <g>{elements}</g>;
    return <g>{[mainTree, ...finalizers.resolve(mainTree)]}</g>;
  };

  export const state1: State = {
    domainTree: tree3,
    codomainTree: tree3,
    hasseDiagram: buildHasseDiagram(tree3, tree3),
    curMorphIdx: 0,
    yForTradRep: 300,
  };

  export const state2: State = {
    domainTree: tree7,
    codomainTree: tree7,
    hasseDiagram: buildHasseDiagram(tree7, tree7),
    curMorphIdx: 0,
    yForTradRep: 500,
  };

  export function ConfigPanel({ config, setConfig }: ConfigPanelProps<Config>) {
    return (
      <ConfigCheckbox
        value={config.showTradRep}
        onChange={(newValue) => setConfig({ ...config, showTradRep: newValue })}
      >
        Show traditional representation
      </ConfigCheckbox>
    );
  }

  // # Drawing constants

  const BG_NODE_PADDING = 10;
  const BG_NODE_GAP = 40;
  const FG_NODE_SIZE = 40;
  const FG_NODE_GAP = 20;

  // # Main drawing functions

  function drawBgTree(
    bgNode: TreeNode,
    fgNode: TreeNode,
    morph: TreeMorph,
    finalizers: Finalizers,
    state: State,
    drag: any
  ): { element: SvgElem; w: number; h: number } {
    const result = drawBgSubtree(
      bgNode,
      [fgNode],
      morph,
      {},
      finalizers,
      state,
      drag
    );
    return {
      element: result.element,
      w: result.w,
      h: result.h,
    };
  }

  function drawBgSubtree(
    bgNode: TreeNode,
    fgNodes: TreeNode[],
    morph: TreeMorph,
    fgNodeCenters: Record<string, PointRef>,
    finalizers: Finalizers,
    state: State,
    drag: any
  ): {
    element: SvgElem;
    w: number;
    h: number;
    rootCenter: PointRef;
  } {
    const elements: SvgElem[] = [];

    const [fgNodesHere, fgNodesBelow] = _.partition(
      fgNodes,
      (n) => morph[n.id] === bgNode.id
    );

    const bgNodeR = drawBgNodeWithFgNodesInside(
      morph,
      bgNode,
      fgNodesHere,
      fgNodeCenters,
      finalizers,
      state,
      drag
    );

    fgNodesBelow.push(...bgNodeR.fgNodesBelow);

    if (bgNode.children.length === 0) {
      return {
        element: bgNodeR.element,
        w: bgNodeR.w,
        h: bgNodeR.h,
        rootCenter: bgNodeR.rootCenter,
      };
    }

    const childRs = bgNode.children.map((child) =>
      drawBgSubtree(
        child,
        fgNodesBelow,
        morph,
        fgNodeCenters,
        finalizers,
        state,
        drag
      )
    );

    const childrenWidth =
      _.sumBy(childRs, (r) => r.w) + BG_NODE_GAP * (childRs.length - 1);

    const params = {
      aLength: bgNodeR.w,
      aAnchor: bgNodeR.w / 2,
      bLength: childrenWidth,
      bAnchor: childrenWidth / 2,
    };
    const { aOffset, bOffset, length: width } = overlapIntervals(params);

    const nodeGroupId = `bg-node-group-${bgNode.id}`;
    elements.push(
      <g id={nodeGroupId} transform={translate(aOffset, 0)}>
        {bgNodeR.element}
      </g>
    );

    let x = bOffset;
    const y = bgNodeR.h + BG_NODE_GAP;
    let maxY = bgNodeR.h;

    for (const [i, childR] of childRs.entries()) {
      const child = bgNode.children[i];
      const childGroupId = `bg-child-group-${bgNode.id}-${child.id}`;
      const childOffset = Vec2(x, y);
      elements.push(
        <g id={childGroupId} transform={translate(childOffset)}>
          {childR.element}
        </g>
      );

      x += childR.w + BG_NODE_GAP;
      maxY = Math.max(maxY, y + childR.h);

      const bgRootCenter = bgNodeR.rootCenter;
      const childRootCenter = childR.rootCenter;

      finalizers.push((tree) => {
        const from = resolvePointRef(bgRootCenter, tree);
        const to = resolvePointRef(childRootCenter, tree);
        return (
          <line
            id={`bg-edge-${bgNode.id}-${child.id}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="lightgray"
            strokeWidth={12}
            data-z-index={-1}
          />
        );
      });
    }

    return {
      element: <g>{elements}</g>,
      w: width,
      h: maxY,
      rootCenter: bgNodeR.rootCenter,
    };
  }

  function drawBgNodeWithFgNodesInside(
    morph: TreeMorph,
    bgNode: TreeNode,
    fgNodesHere: TreeNode[],
    fgNodeCenters: Record<string, PointRef>,
    finalizers: Finalizers,
    state: State,
    drag: any
  ): {
    element: SvgElem;
    w: number;
    h: number;
    fgNodesBelow: TreeNode[];
    rootCenter: PointRef;
  } {
    const elementsInRect: SvgElem[] = [];

    let x = BG_NODE_PADDING;
    let y = BG_NODE_PADDING;
    let maxX = x + 10;
    let maxY = y + 10;
    const fgNodesBelow: TreeNode[] = [];

    for (const fgNode of fgNodesHere) {
      const r = drawFgSubtreeInBgNode(
        fgNode,
        bgNode.id,
        morph,
        fgNodeCenters,
        finalizers,
        state,
        drag
      );
      elementsInRect.push(
        <g
          id={`fg-in-bg-${bgNode.id}-${fgNode.id}`}
          transform={translate(x, y)}
        >
          {r.element}
        </g>
      );

      x += r.w + FG_NODE_GAP;
      maxX = Math.max(maxX, x - FG_NODE_GAP);
      maxY = Math.max(maxY, y + r.h);

      fgNodesBelow.push(...r.fgNodesBelow);
    }

    maxX += BG_NODE_PADDING;
    maxY += BG_NODE_PADDING;

    const nodeCenterInRect = Vec2(maxX / 2, maxY / 2);
    const circleRadius = nodeCenterInRect.len();
    const nodeCenterInCircle = Vec2(circleRadius);
    const offset = nodeCenterInCircle.sub(nodeCenterInRect);

    const circleId = `bg-circle-${bgNode.id}`;

    return {
      element: (
        <g>
          <circle
            id={circleId}
            cx={nodeCenterInCircle.x}
            cy={nodeCenterInCircle.y}
            r={circleRadius}
            fill="lightgray"
            data-z-index={-1}
          />
          <g transform={translate(offset)}>{elementsInRect}</g>
        </g>
      ),
      w: 2 * circleRadius,
      h: 2 * circleRadius,
      fgNodesBelow,
      rootCenter: pointRef(circleId, nodeCenterInCircle),
    };
  }

  function drawFgSubtreeInBgNode(
    fgNode: TreeNode,
    bgNodeId: string,
    morph: TreeMorph,
    fgNodeCenters: Record<string, PointRef>,
    finalizers: Finalizers,
    state: State,
    drag: any
  ): {
    element: SvgElem;
    fgNodesBelow: TreeNode[];
    w: number;
    h: number;
  } {
    const childrenElements: SvgElem[] = [];
    const fgNodesBelow: TreeNode[] = [];
    let childrenX = 0;
    let childrenMaxH = 0;

    const childIntermediatePoints: Record<string, PointRef> = {};

    for (const [i, child] of fgNode.children.entries()) {
      if (i > 0) {
        childrenX += FG_NODE_GAP;
      }

      const edgeKey = `fg-edge-${fgNode.id}-${child.id}`;
      if (morph[child.id] === bgNodeId) {
        const childGroupId = `fg-child-${fgNode.id}-${child.id}`;
        const r = drawFgSubtreeInBgNode(
          child,
          bgNodeId,
          morph,
          fgNodeCenters,
          finalizers,
          state,
          drag
        );
        childrenElements.push(
          <g id={childGroupId} transform={translate(childrenX, 0)}>
            {r.element}
          </g>
        );
        fgNodesBelow.push(...r.fgNodesBelow);
        childrenX += r.w;
        childrenMaxH = Math.max(childrenMaxH, r.h);

        finalizers.push((tree) => {
          const fromRef = fgNodeCenters[fgNode.id];
          assert(!!fromRef, "fromRef is undefined");
          const toRef = fgNodeCenters[child.id];
          assert(!!toRef, "toRef is undefined");
          const from = resolvePointRef(fromRef, tree);
          const to = resolvePointRef(toRef, tree);
          return (
            <path
              id={edgeKey}
              d={`M ${from.x} ${from.y} Q ${from.x} ${from.y} ${to.x} ${to.y}`}
              fill="none"
              stroke="black"
              strokeWidth={2}
            />
          );
        });
      } else {
        fgNodesBelow.push(child);

        // Create intermediate point for this child's edge
        const intermediateId = `fg-intermediate-${fgNode.id}-${child.id}`;
        childIntermediatePoints[child.id] = pointRef(
          intermediateId,
          Vec2(childrenX, 0)
        );

        childrenElements.push(<g id={intermediateId} key={intermediateId} />);
      }
    }

    // Set the node center before creating finalizers that need it
    fgNodeCenters[fgNode.id] = pointRef(fgNode.id, Vec2(0, 0));

    // Add finalizers for edges to children below
    for (const child of fgNode.children) {
      if (morph[child.id] !== bgNodeId) {
        const edgeKey = `fg-edge-${fgNode.id}-${child.id}`;
        const intermediateRef = childIntermediatePoints[child.id];

        finalizers.push((tree) => {
          const fromRef = fgNodeCenters[fgNode.id];
          assert(!!fromRef, "fromRef is undefined");
          const toRef = fgNodeCenters[child.id];
          assert(!!toRef, "toRef is undefined");
          const from = resolvePointRef(fromRef, tree);
          const intermediate = resolvePointRef(intermediateRef, tree);
          const to = resolvePointRef(toRef, tree);
          return (
            <path
              id={edgeKey}
              d={`M ${from.x} ${from.y} Q ${intermediate.x} ${intermediate.y} ${to.x} ${to.y}`}
              fill="none"
              stroke="black"
              strokeWidth={2}
            />
          );
        });
      }
    }

    let nodeX;
    const childrenContainerId = `fg-children-${fgNode.id}`;
    const childrenContainer = (
      <g
        id={childrenContainerId}
        transform={translate(0, FG_NODE_SIZE + FG_NODE_GAP)}
      >
        {childrenElements}
      </g>
    );

    if (childrenX < FG_NODE_SIZE) {
      nodeX = FG_NODE_SIZE / 2;
    } else {
      nodeX = childrenX / 2;
    }

    const nodeCenter = Vec2(nodeX, FG_NODE_SIZE / 2);

    const dist = (a: any, b: any) =>
      traverseUntilPred(
        a,
        (n) => (n ? [...n.children, n.parent] : []),
        (n) => n === b
      ).length;

    return {
      element: (
        <g>
          <circle
            id={fgNode.id}
            transform={translate(nodeCenter)}
            cx={0}
            cy={0}
            r={FG_NODE_SIZE / 2}
            fill="black"
            data-on-drag={drag(() => {
              const { hasseDiagram, curMorphIdx, codomainTree } = state;
              const allMorphisms = hasseDiagram.nodes;
              const curMorph = allMorphisms[curMorphIdx];

              const byId = new Map<any, any>();
              traverseUntilPred(
                codomainTree,
                (n) => {
                  byId.set(n.id, n);
                  return n.children;
                },
                (n) => false
              );

              const distCache = new Map();
              const cachedDist = (aid: any, bid: any) => {
                const a = byId.get(aid);
                const b = byId.get(bid);
                if (distCache.has(a)) {
                  const aCache = distCache.get(a);
                  if (aCache.has(b)) return aCache.get(b);
                  else {
                    const d = dist(a, b);
                    aCache.set(b, d);
                    return d;
                  }
                } else {
                  const d = dist(a, b);
                  distCache.set(a, new Map([[b, d]]));
                  return d;
                }
              };

              // 1. group morphisms by where they send fgNode.id
              const a = _.groupBy(
                allMorphisms,
                (targetMorph) => targetMorph[fgNode.id]
              );
              // 2. sort groups by how many nodes they change, and pick first
              const curMorphMap = Object.entries(curMorph);
              const b = Object.values(a).map((morphs) =>
                least(morphs, (morph: any) =>
                  sum(curMorphMap.map(([k, v]) => cachedDist(morph[k], v)))
                )
              );
              // 3. to indices
              const c = b.map((morph: any) =>
                allMorphisms.findIndex((a) => a === morph)
              );

              return span(
                c.map((idx) => ({
                  ...state,
                  curMorphIdx: idx,
                }))
              );
            })}
          />
          {childrenContainer}
        </g>
      ),
      fgNodesBelow,
      w: Math.max(childrenX, FG_NODE_SIZE),
      h: FG_NODE_SIZE + (childrenMaxH > 0 ? FG_NODE_GAP + childrenMaxH : 0),
    };
  }

  function drawTree(
    node: TreeNode,
    keyPrefix: string,
    style: "fg" | "bg",
    nodeCenters: Record<string, PointRef>,
    finalizers: Finalizers
  ): {
    element: SvgElem;
    w: number;
    h: number;
  } {
    const r = drawSubtree(node, keyPrefix, style, nodeCenters, finalizers);
    return {
      element: r.element,
      w: r.w,
      h: r.h,
    };
  }

  function drawSubtree(
    node: TreeNode,
    keyPrefix: string,
    style: "fg" | "bg",
    nodeCenters: Record<string, PointRef>,
    finalizers: Finalizers
  ): {
    element: SvgElem;
    w: number;
    h: number;
  } {
    const childrenElements: SvgElem[] = [];
    let childrenX = 0;
    let childrenMaxH = 0;

    for (const [i, child] of node.children.entries()) {
      if (i > 0) {
        childrenX += FG_NODE_GAP;
      }
      const r = drawSubtree(child, keyPrefix, style, nodeCenters, finalizers);
      childrenElements.push(
        <g
          id={`${keyPrefix}-child-${node.id}-${child.id}`}
          transform={translate(childrenX, 0)}
        >
          {r.element}
        </g>
      );
      childrenX += r.w;
      childrenMaxH = Math.max(childrenMaxH, r.h);

      finalizers.push((tree) => {
        const fromRef = nodeCenters[node.id];
        assert(!!fromRef, "fromRef is undefined");
        const toRef = nodeCenters[child.id];
        assert(!!toRef, "toRef is undefined");
        const from = resolvePointRef(fromRef, tree);
        const to = resolvePointRef(toRef, tree);
        return (
          <path
            id={`${keyPrefix}-edge-${node.id}-${child.id}`}
            d={`M ${from.x} ${from.y} Q ${from.x} ${from.y} ${to.x} ${to.y}`}
            fill="none"
            stroke={style === "fg" ? "black" : "lightgray"}
            strokeWidth={style === "fg" ? 2 : 12}
          />
        );
      });
    }

    let nodeX;
    const childrenContainer =
      childrenElements.length > 0 ? (
        <g transform={translate(0, FG_NODE_SIZE + FG_NODE_GAP)}>
          {childrenElements}
        </g>
      ) : null;

    if (childrenX < FG_NODE_SIZE) {
      nodeX = FG_NODE_SIZE / 2;
    } else {
      nodeX = childrenX / 2;
    }

    const nodeCenter = Vec2(nodeX, FG_NODE_SIZE / 2);
    const nodeId = `${keyPrefix}-${node.id}`;
    nodeCenters[node.id] = pointRef(nodeId, Vec2(0, 0));

    return {
      element: (
        <g>
          <circle
            id={nodeId}
            transform={translate(nodeCenter)}
            cx={0}
            cy={0}
            r={FG_NODE_SIZE / 2}
            fill={style === "fg" ? "black" : "lightgray"}
          />
          {childrenContainer}
        </g>
      ),
      w: Math.max(childrenX, FG_NODE_SIZE),
      h: FG_NODE_SIZE + (childrenMaxH > 0 ? FG_NODE_GAP + childrenMaxH : 0),
    };
  }
}
