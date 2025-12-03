import { curveCardinal, line } from "d3-shape";
import _ from "lodash";
import { arrowhead } from "./arrows";
import { ConfigCheckbox } from "./config-controls";
import { ConfigPanelProps } from "./Demo";
import { span } from "./DragSpec";
import { overlapIntervals } from "./layout";
import { Drag, Manipulable, translate } from "./manipulable";
import { Svgx } from "./svgx";
import { Finalizers, pointRef, PointRef } from "./svgx/finalizers";
import {
  getAllMorphs,
  getNodeById,
  tree3,
  tree7,
  TreeMorph,
  TreeNode,
} from "./trees";
import { Vec2 } from "./vec2";

// returns the path from `node` to another node `n` such that `pred(n)==true`.
function traverseUntilPred<T>(
  node: T,
  next: (n: T) => T[],
  pred: (n: T) => boolean
) {
  const visited = new Set([node]);
  const todo: [T, T[]][] = [[node, []]];
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
}

const nodeDist = (a: TreeNode, b: TreeNode) =>
  traverseUntilPred(
    a,
    (n) => (n ? [...n.children, ...(n.parent ? [n.parent] : [])] : []),
    (n) => n === b
  )!.length;

export namespace OrderPreserving {
  export type State = {
    domainTree: TreeNode;
    codomainTree: TreeNode;
    morph: TreeMorph;
    allMorphs: TreeMorph[];
    yForTradRep: number;
  };

  const allMorphs3To3 = getAllMorphs(tree3, tree3);
  export const state3To3: State = {
    domainTree: tree3,
    codomainTree: tree3,
    morph: allMorphs3To3[0],
    allMorphs: allMorphs3To3,
    yForTradRep: 300,
  };

  const allMorphs7To7 = getAllMorphs(tree7, tree7);
  export const state7To7: State = {
    domainTree: tree7,
    codomainTree: tree7,
    morph: allMorphs7To7[0],
    allMorphs: allMorphs7To7,
    yForTradRep: 500,
  };

  export type Config = {
    oneNodeAtATime: boolean;
    showTradRep: boolean;
  };

  export const defaultConfig: Config = {
    oneNodeAtATime: false,
    showTradRep: false,
  };

  export const manipulable: Manipulable<State, Config> = ({
    state,
    drag,
    config,
  }) => {
    const { morph } = state;
    const elements: Svgx[] = [];
    const finalizers = new Finalizers();

    const r = drawBgTree(
      state.codomainTree,
      state.domainTree,
      morph,
      finalizers,
      state,
      drag,
      config
    );
    elements.push(r.element);

    if (config.showTradRep) {
      elements.push(...drawTradRep(state, morph, finalizers, drag, config));
    }

    const mainTree = <g>{elements}</g>;
    return <g>{[mainTree, ...finalizers.run(mainTree)]}</g>;
  };

  export function ConfigPanel({ config, setConfig }: ConfigPanelProps<Config>) {
    return (
      <>
        <ConfigCheckbox
          value={config.oneNodeAtATime}
          onChange={(newValue) =>
            setConfig({ ...config, oneNodeAtATime: newValue })
          }
        >
          Only drag one node at a time
        </ConfigCheckbox>
        <ConfigCheckbox
          value={config.showTradRep}
          onChange={(newValue) =>
            setConfig({ ...config, showTradRep: newValue })
          }
        >
          Show traditional representation
        </ConfigCheckbox>
      </>
    );
  }

  // # Drag spec

  export function dragSpec(
    draggedNodeId: string,
    state: State,
    config: Config
  ) {
    const { morph, allMorphs, codomainTree } = state;
    const domainIds = Object.keys(morph);

    let newMorphs;

    if (config.oneNodeAtATime) {
      newMorphs = allMorphs.filter((newMorph) => {
        return domainIds.every(
          (nodeId) =>
            nodeId === draggedNodeId || // dragged node can go anywhere
            morph[nodeId] === newMorph[nodeId] // others stay put
        );
      });
    } else {
      // 1. group morphisms by where they send draggedNodeId
      const morphsByDragTarget = _.groupBy(
        allMorphs,
        (targetMorph) => targetMorph[draggedNodeId]
      );

      // 2. sort groups by how many nodes they change, and pick first
      newMorphs = Object.values(morphsByDragTarget).map(
        (morphsWithDragTarget) =>
          _.minBy(morphsWithDragTarget, (newMorph) =>
            _.sum(
              domainIds.map((nodeId) =>
                nodeDist(
                  getNodeById(codomainTree, morph[nodeId])!,
                  getNodeById(codomainTree, newMorph[nodeId])!
                )
              )
            )
          )!
      );
    }

    return span(newMorphs.map((morph) => ({ ...state, morph })));
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
    drag: Drag<State>,
    config: Config
  ): { element: Svgx; w: number; h: number } {
    const result = drawBgSubtree(
      bgNode,
      [fgNode],
      morph,
      finalizers,
      state,
      drag,
      config
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
    finalizers: Finalizers,
    state: State,
    drag: Drag<State>,
    config: Config
  ): {
    element: Svgx;
    w: number;
    h: number;
    rootCenter: PointRef;
  } {
    const elements: Svgx[] = [];

    const [fgNodesHere, fgNodesBelow] = _.partition(
      fgNodes,
      (n) => morph[n.id] === bgNode.id
    );

    const bgNodeR = drawBgNodeWithFgNodesInside(
      morph,
      bgNode,
      fgNodesHere,
      finalizers,
      state,
      drag,
      config
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
      drawBgSubtree(child, fgNodesBelow, morph, finalizers, state, drag, config)
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

    elements.push(
      <g id={`bg-node-group-${bgNode.id}`} transform={translate(aOffset, 0)}>
        {bgNodeR.element}
      </g>
    );

    let x = bOffset;
    const y = bgNodeR.h + BG_NODE_GAP;
    let maxY = bgNodeR.h;

    for (const [i, childR] of childRs.entries()) {
      const child = bgNode.children[i];
      const childOffset = Vec2(x, y);
      elements.push(
        <g
          id={`bg-child-group-${bgNode.id}-${child.id}`}
          transform={translate(childOffset)}
        >
          {childR.element}
        </g>
      );

      x += childR.w + BG_NODE_GAP;
      maxY = Math.max(maxY, y + childR.h);

      const bgRootCenter = bgNodeR.rootCenter;
      const childRootCenter = childR.rootCenter;

      finalizers.push((resolve) => {
        const from = resolve(bgRootCenter);
        const to = resolve(childRootCenter);
        return (
          <line
            id={`bg-edge-${bgNode.id}-${child.id}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="lightgray"
            strokeWidth={12}
            data-z-index={-2}
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
    finalizers: Finalizers,
    state: State,
    drag: Drag<State>,
    config: Config
  ): {
    element: Svgx;
    w: number;
    h: number;
    fgNodesBelow: TreeNode[];
    rootCenter: PointRef;
  } {
    const elementsInRect: Svgx[] = [];

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
        finalizers,
        state,
        drag,
        config
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
    finalizers: Finalizers,
    state: State,
    drag: Drag<State>,
    config: Config
  ): {
    element: Svgx;
    fgNodesBelow: TreeNode[];
    w: number;
    h: number;
  } {
    const childrenElements: Svgx[] = [];
    const childrenId = `fg-children-${fgNode.id}`;
    const fgNodesBelow: TreeNode[] = [];
    let childrenX = 0;
    let childrenMaxH = 0;

    for (const [i, child] of fgNode.children.entries()) {
      if (i > 0) {
        childrenX += FG_NODE_GAP;
      }

      const edgeId = `fg-edge-${fgNode.id}-${child.id}`;

      if (morph[child.id] === bgNodeId) {
        const r = drawFgSubtreeInBgNode(
          child,
          bgNodeId,
          morph,
          finalizers,
          state,
          drag,
          config
        );
        childrenElements.push(
          <g
            id={`fg-child-${fgNode.id}-${child.id}`}
            transform={translate(childrenX, 0)}
          >
            {r.element}
          </g>
        );
        fgNodesBelow.push(...r.fgNodesBelow);
        childrenX += r.w;
        childrenMaxH = Math.max(childrenMaxH, r.h);

        finalizers.push((resolve) => {
          const from = resolve(pointRef(fgNode.id, Vec2(0)));
          const to = resolve(pointRef(child.id, Vec2(0)));
          return (
            <path
              id={edgeId}
              d={
                line().curve(curveCardinal)([
                  [from.x, from.y],
                  [from.x, from.y],
                  [to.x, to.y],
                ])!
              }
              fill="none"
              stroke="black"
              strokeWidth={2}
              data-z-index={-1}
            />
          );
        });
      } else {
        fgNodesBelow.push(child);

        const intermediateRef = pointRef(childrenId, Vec2(childrenX, 0));
        finalizers.push((resolve) => {
          const myCenter = resolve(pointRef(fgNode.id, Vec2(0)));
          const intermediate = resolve(intermediateRef);
          const childCenter = resolve(pointRef(child.id, Vec2(0)));
          return (
            <path
              id={edgeId}
              d={
                line().curve(curveCardinal)([
                  myCenter.arr(),
                  intermediate.arr(),
                  childCenter.arr(),
                ])!
              }
              fill="none"
              stroke="black"
              strokeWidth={2}
            />
          );
        });
      }
    }

    let nodeX;
    let childrenTransform;
    if (childrenX < FG_NODE_SIZE) {
      nodeX = FG_NODE_SIZE / 2;
      childrenTransform = translate(
        (FG_NODE_SIZE - childrenX) / 2,
        FG_NODE_SIZE + FG_NODE_GAP
      );
    } else {
      nodeX = childrenX / 2;
      childrenTransform = translate(0, FG_NODE_SIZE + FG_NODE_GAP);
    }

    const childrenContainer = (
      <g id={childrenId} transform={childrenTransform}>
        {childrenElements}
      </g>
    );

    const nodeCenter = Vec2(nodeX, FG_NODE_SIZE / 2);

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
            data-on-drag={drag(() => dragSpec(fgNode.id, state, config))}
          />
          {childrenContainer}
        </g>
      ),
      fgNodesBelow,
      w: Math.max(childrenX, FG_NODE_SIZE),
      h: FG_NODE_SIZE + (childrenMaxH > 0 ? FG_NODE_GAP + childrenMaxH : 0),
    };
  }

  function nodeSvgId(nodeId: string, prefix: string): string {
    return `${prefix}-${nodeId}`;
  }

  function drawTradRep(
    state: State,
    morph: TreeMorph,
    finalizers: Finalizers,
    drag: Drag<State>,
    config: Config
  ): Svgx[] {
    const elements: Svgx[] = [];

    const domR = drawTree(state.domainTree, "domain", "fg", finalizers);
    elements.push(
      <g transform={translate(0, state.yForTradRep)}>{domR.element}</g>
    );

    const codR = drawTree(state.codomainTree, "codomain", "bg", finalizers);
    elements.push(
      <g transform={translate(domR.w + 40, state.yForTradRep)}>
        {codR.element}
      </g>
    );

    for (const [domElem, codElem] of Object.entries(morph)) {
      finalizers.push((resolve) => {
        const from = resolve(pointRef(nodeSvgId(domElem, "domain"), Vec2(0)));
        const to = resolve(pointRef(nodeSvgId(codElem, "codomain"), Vec2(0)));
        const mid = from.lerp(to, 0.5).add(Vec2(0, -from.dist(to) / 6));
        const fromAdjusted = from.towards(mid, FG_NODE_SIZE / 2);
        const toAdjusted = to.towards(mid, FG_NODE_SIZE / 2);

        return (
          <g id={`morphism-arrow-${domElem}`}>
            <path
              d={`M ${fromAdjusted.arr()} Q ${mid.arr()} ${toAdjusted
                .towards(mid, 5)
                .arr()}`}
              fill="none"
              stroke="#4287f5"
              strokeWidth={2}
            />
            {arrowhead({
              tip: toAdjusted,
              headAngle: Math.PI / 10,
              direction: to.sub(mid),
              headLength: 15,
              fill: "#4287f5",
              "data-on-drag": drag(() => dragSpec(domElem, state, config)),
            })}
          </g>
        );
      });
    }

    return elements;
  }

  function drawTree(
    node: TreeNode,
    idPrefix: string,
    style: "fg" | "bg",
    finalizers: Finalizers
  ): {
    element: Svgx;
    w: number;
    h: number;
  } {
    const r = drawSubtree(node, idPrefix, style, finalizers);
    return {
      element: r.element,
      w: r.w,
      h: r.h,
    };
  }

  function drawSubtree(
    node: TreeNode,
    idPrefix: string,
    style: "fg" | "bg",
    finalizers: Finalizers
  ): {
    element: Svgx;
    w: number;
    h: number;
  } {
    const childrenElements: Svgx[] = [];
    let childrenX = 0;
    let childrenMaxH = 0;

    for (const [i, child] of node.children.entries()) {
      if (i > 0) {
        childrenX += FG_NODE_GAP;
      }
      const r = drawSubtree(child, idPrefix, style, finalizers);
      childrenElements.push(
        <g
          id={`${idPrefix}-child-${node.id}-${child.id}`}
          transform={translate(childrenX, 0)}
        >
          {r.element}
        </g>
      );
      childrenX += r.w;
      childrenMaxH = Math.max(childrenMaxH, r.h);

      finalizers.push((resolve) => {
        const from = resolve(pointRef(nodeSvgId(node.id, idPrefix), Vec2(0)));
        const to = resolve(pointRef(nodeSvgId(child.id, idPrefix), Vec2(0)));
        return (
          <line
            id={`${idPrefix}-edge-${node.id}-${child.id}`}
            {...from.xy1()}
            {...to.xy2()}
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

    return {
      element: (
        <g>
          <circle
            id={nodeSvgId(node.id, idPrefix)}
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
