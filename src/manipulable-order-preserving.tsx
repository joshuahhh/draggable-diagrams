import _ from "lodash";
import { ConfigCheckbox } from "./config-controls";
import { Finalizers } from "./finalizers";
import { overlapIntervals } from "./layout";
import { Manipulable, span } from "./manipulable";
import {
  circle,
  curve,
  Diagram,
  groupBuilder,
  line,
  PointInDiagram,
  pointInDiagram,
  resolvePointInDiagram,
} from "./shape";
import {
  buildHasseDiagram,
  HasseDiagram,
  tree3,
  tree7,
  TreeMorph,
  TreeNode,
} from "./trees";
import { Vec2 } from "./vec2";

type OrderPreservingState = {
  domainTree: TreeNode;
  codomainTree: TreeNode;
  hasseDiagram: HasseDiagram;
  curMorphIdx: number;
  yForTradRep: number;
};

type OrderPreservingConfig = {
  showTradRep: boolean;
};

export const manipulableOrderPreserving: Manipulable<
  OrderPreservingState,
  OrderPreservingConfig
> = {
  sourceFile: "manipulable-order-preserving.ts",

  render(state, _draggableKey, config) {
    const morph = state.hasseDiagram.nodes[state.curMorphIdx];
    const g = groupBuilder();
    const r = drawBgTree(state.codomainTree, state.domainTree, morph);
    g.push(r.diagram);
    if (config.showTradRep) {
      const domNodeCenters: Record<string, PointInDiagram> = {};
      const domR = drawTree(state.domainTree, "domain", "fg", domNodeCenters);
      g.push(domR.diagram.translate([0, state.yForTradRep]));
      const codNodeCenters: Record<string, PointInDiagram> = {};
      const codR = drawTree(
        state.codomainTree,
        "codomain",
        "bg",
        codNodeCenters,
      );
      g.push(codR.diagram.translate([domR.w + 40, state.yForTradRep]));
      for (const [domElem, codElem] of Object.entries(morph)) {
        const from = resolvePointInDiagram(domNodeCenters[domElem], g);
        const to = resolvePointInDiagram(codNodeCenters[codElem], g);
        g.push(
          curve({
            points: [
              from.towards(to, FG_NODE_SIZE / 2),
              from.lerp(to, 0.5).add([0, -10]),
              to,
            ],
            strokeStyle: "#4287f5",
            lineWidth: 2,
          }).absoluteKey(`morphism-${domElem}`),
        );
      }
    }
    return g;
  },

  onDrag(state, draggableKey) {
    const { hasseDiagram, curMorphIdx } = state;
    const curMorph = hasseDiagram.nodes[curMorphIdx];
    const adjMorphIdxes = _.range(hasseDiagram.nodes.length).filter(
      (nodeIdx) => {
        const morph = hasseDiagram.nodes[nodeIdx];
        // all the mappings in morph must agree with those in the current morph,
        // except for the one with id draggableKey
        return Object.entries(morph).every(
          ([domainElem, codomainElem]) =>
            domainElem === draggableKey ||
            curMorph[domainElem] === codomainElem,
        );
      },
    );
    return span(
      adjMorphIdxes.map((idx) => ({
        ...state,
        curMorphIdx: idx,
      })),
    );
  },

  defaultConfig: {
    showTradRep: false,
  },

  renderConfig(config, setConfig) {
    return (
      <ConfigCheckbox
        label="Show Traditional Representation"
        value={config.showTradRep}
        onChange={(newValue) => setConfig({ ...config, showTradRep: newValue })}
      />
    );
  },
};

export const stateOrderPreserving1: OrderPreservingState = {
  domainTree: tree3,
  codomainTree: tree3,
  hasseDiagram: buildHasseDiagram(tree3, tree3),
  curMorphIdx: 0,
  yForTradRep: 300,
};

export const stateOrderPreserving2: OrderPreservingState = {
  domainTree: tree7,
  codomainTree: tree7,
  hasseDiagram: buildHasseDiagram(tree7, tree7),
  curMorphIdx: 0,
  yForTradRep: 500,
};

// # complex drawing stuff below

const BG_NODE_PADDING = 10;
const BG_NODE_GAP = 40;
const FG_NODE_SIZE = 40; // HACK
const FG_NODE_GAP = 20;

function drawBgTree(
  /** The background (codomain) node to draw */
  bgNode: TreeNode,
  /** The foreground (domain) node to draw */
  fgNode: TreeNode,
  morph: TreeMorph,
): { diagram: Diagram; w: number; h: number } {
  const finalizers = new Finalizers();
  const result = drawBgSubtree(bgNode, [fgNode], morph, {}, finalizers);
  return {
    ...result,
    diagram: finalizers.finish(result.diagram),
  };
}

function drawBgSubtree(
  /** The background (codomain) node to draw */
  bgNode: TreeNode,
  /** All foreground (domain) nodes that are still looking for a
   * home, here or elsewhere, TODO: in left-to-right order */
  fgNodes: TreeNode[],
  morph: TreeMorph,
  /** An mutable record of where foreground nodes centers */
  fgNodeCenters: Record<string, PointInDiagram>,
  finalizers: Finalizers,
): {
  diagram: Diagram;
  w: number;
  h: number;
  rootCenter: PointInDiagram;
} {
  const diagram = groupBuilder();

  let [fgNodesHere, fgNodesBelow] = _.partition(
    fgNodes,
    (n) => morph[n.id] === bgNode.id,
  );

  const bgNodeR = drawBgNodeWithFgNodesInside(
    morph,
    bgNode,
    fgNodesHere,
    fgNodeCenters,
    finalizers,
  );

  fgNodesBelow.push(...bgNodeR.fgNodesBelow);

  if (bgNode.children.length === 0) {
    return {
      diagram: bgNodeR.diagram,
      w: bgNodeR.w,
      h: bgNodeR.h,
      rootCenter: bgNodeR.rootCenter,
    };
  }

  const childRs = bgNode.children.map((child) =>
    drawBgSubtree(child, fgNodesBelow, morph, fgNodeCenters, finalizers),
  );

  const childrenWidth =
    _.sumBy(childRs, (r) => r.w) + BG_NODE_GAP * (childRs.length - 1);

  // const firstChildX = childRs[0].rootCenter.__point.x;
  // const lastChildX =
  //   childrenWidth -
  //   (childRs[childRs.length - 1].w -
  //     childRs[childRs.length - 1].rootCenter.__point.x);

  const params = {
    aLength: bgNodeR.w,
    aAnchor: bgNodeR.w / 2,
    bLength: childrenWidth,
    // bAnchor: (firstChildX + lastChildX) / 2,
    bAnchor: childrenWidth / 2,
  };
  const { aOffset, bOffset, length: width } = overlapIntervals(params);

  diagram.push(bgNodeR.diagram.translate(Vec2(aOffset, 0)));

  let x = bOffset;
  let y = bgNodeR.h + BG_NODE_GAP;
  let maxY = bgNodeR.h;

  for (const childR of childRs) {
    diagram.push(childR.diagram.translate(Vec2(x, y)));

    x += childR.w + BG_NODE_GAP;
    maxY = Math.max(maxY, y + childR.h);

    finalizers.push((resolve) =>
      line({
        from: resolve(bgNodeR.rootCenter),
        to: resolve(childR.rootCenter),
        strokeStyle: "lightgray",
        lineWidth: 12,
      }).zIndex(-1),
    );
  }

  return {
    diagram,
    w: width,
    h: maxY,
    rootCenter: bgNodeR.rootCenter,
  };
}

/** Draw a background node with all relevant foreground nodes inside
 * – might be multiple subtrees */
function drawBgNodeWithFgNodesInside(
  morph: TreeMorph,
  bgNode: TreeNode,
  /** The caller has already figured out which foreground nodes
   * should be drawn as roots here */
  fgNodesHere: TreeNode[],
  /** An mutable record of where foreground nodes centers */
  fgNodeCenters: Record<string, PointInDiagram>,
  finalizers: Finalizers,
): {
  diagram: Diagram;
  w: number;
  h: number;
  /** A list of foreground nodes that are descendents of nodes drawn
   * here, but which belong in lower-down background nodes */
  fgNodesBelow: TreeNode[];
  rootCenter: PointInDiagram;
} {
  const diagramInRect = groupBuilder();

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
    );
    diagramInRect.push(r.diagram.translate(Vec2(x, y)));

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

  const diagram = groupBuilder();
  diagram.push(diagramInRect.translate(offset));
  diagram.push(
    circle({
      center: nodeCenterInCircle,
      radius: circleRadius,
      fillStyle: "lightgray",
    }).zIndex(-1),
  );

  return {
    diagram,
    w: 2 * circleRadius,
    h: 2 * circleRadius,
    fgNodesBelow,
    rootCenter: pointInDiagram(diagram, nodeCenterInCircle),
  };
}

function drawFgSubtreeInBgNode(
  fgNode: TreeNode,
  bgNodeId: string,
  morph: TreeMorph,
  /** An mutable record of where foreground nodes centers */
  fgNodeCenters: Record<string, PointInDiagram>,
  finalizers: Finalizers,
): {
  diagram: Diagram;
  fgNodesBelow: TreeNode[];
  w: number;
  h: number;
} {
  const childrenDiagram = groupBuilder();
  const fgNodesBelow: TreeNode[] = [];
  let childrenX = 0;
  let childrenMaxH = 0;
  for (const [i, child] of fgNode.children.entries()) {
    if (i > 0) {
      childrenX += FG_NODE_GAP;
    }
    const edgeKey = `${fgNode.id}->${child.id}`;
    if (morph[child.id] === bgNodeId) {
      const r = drawFgSubtreeInBgNode(
        child,
        bgNodeId,
        morph,
        fgNodeCenters,
        finalizers,
      );
      childrenDiagram.push(r.diagram.translate(Vec2(childrenX, 0)));
      fgNodesBelow.push(...r.fgNodesBelow);
      childrenX += r.w;
      childrenMaxH = Math.max(childrenMaxH, r.h);

      finalizers.push((resolve) => {
        const from = resolve(fgNodeCenters[fgNode.id]);
        const to = resolve(fgNodeCenters[child.id]);
        return curve({
          points: [from, from, to],
          strokeStyle: "black",
          lineWidth: 2,
        }).absoluteKey(edgeKey);
      });
    } else {
      fgNodesBelow.push(child);

      const childrenXBefore = childrenX;
      finalizers.push((resolve) => {
        const myCenter = fgNodeCenters[fgNode.id];
        const intermediate = pointInDiagram(
          childrenDiagram,
          Vec2(childrenXBefore, 0),
        );
        const childCenter = fgNodeCenters[child.id];
        return curve({
          points: [
            resolve(myCenter),
            resolve(intermediate),
            resolve(childCenter),
          ],
          strokeStyle: "black",
          lineWidth: 2,
        }).absoluteKey(edgeKey);
      });
    }
  }

  const diagram = groupBuilder();
  let nodeX;
  if (childrenX < FG_NODE_SIZE) {
    nodeX = FG_NODE_SIZE / 2;
    diagram.push(
      childrenDiagram.translate(
        Vec2((FG_NODE_SIZE - childrenX) / 2, FG_NODE_SIZE + FG_NODE_GAP),
      ),
    );
  } else {
    nodeX = childrenX / 2;
    diagram.push(
      childrenDiagram.translate(Vec2(0, FG_NODE_SIZE + FG_NODE_GAP)),
    );
  }

  const nodeCenter = Vec2(nodeX, FG_NODE_SIZE / 2);
  fgNodeCenters[fgNode.id] = pointInDiagram(diagram, nodeCenter);
  diagram.push(
    circle({
      center: nodeCenter,
      radius: FG_NODE_SIZE / 2,
      fillStyle: "black",
    })
      .draggable(fgNode.id)
      .absoluteKey(fgNode.id),
  );

  return {
    diagram,
    fgNodesBelow,
    w: Math.max(childrenX, FG_NODE_SIZE),
    h: FG_NODE_SIZE + (childrenMaxH > 0 ? FG_NODE_GAP + childrenMaxH : 0),
  };
}

function drawTree(
  node: TreeNode,
  keyPrefix: string,
  style: "fg" | "bg",
  nodeCenters: Record<string, PointInDiagram>,
): {
  diagram: Diagram;
  w: number;
  h: number;
} {
  const finalizers = new Finalizers();
  const r = drawSubtree(node, keyPrefix, style, nodeCenters, finalizers);
  return {
    diagram: finalizers.finish(r.diagram),
    w: r.w,
    h: r.h,
  };
}

function drawSubtree(
  node: TreeNode,
  keyPrefix: string,
  style: "fg" | "bg",
  /** An mutable record of where nodes are centered */
  nodeCenters: Record<string, PointInDiagram>,
  finalizers: Finalizers,
): {
  diagram: Diagram;
  w: number;
  h: number;
} {
  const childrenDiagram = groupBuilder();
  let childrenX = 0;
  let childrenMaxH = 0;
  for (const [i, child] of node.children.entries()) {
    if (i > 0) {
      childrenX += FG_NODE_GAP;
    }
    const r = drawSubtree(child, keyPrefix, style, nodeCenters, finalizers);
    childrenDiagram.push(r.diagram.translate(Vec2(childrenX, 0)));
    childrenX += r.w;
    childrenMaxH = Math.max(childrenMaxH, r.h);

    finalizers.push((resolve) => {
      const from = resolve(nodeCenters[node.id]);
      const to = resolve(nodeCenters[child.id]);
      return curve({
        points: [from, from, to],
        strokeStyle: { fg: "black", bg: "lightgray" }[style],
        lineWidth: { fg: 2, bg: 12 }[style],
      }).absoluteKey(`${keyPrefix}-${node.id}->${child.id}`);
    });
  }

  const diagram = groupBuilder();
  let nodeX;
  if (childrenX < FG_NODE_SIZE) {
    nodeX = FG_NODE_SIZE / 2;
    diagram.push(
      childrenDiagram.translate(
        Vec2((FG_NODE_SIZE - childrenX) / 2, FG_NODE_SIZE + FG_NODE_GAP),
      ),
    );
  } else {
    nodeX = childrenX / 2;
    diagram.push(
      childrenDiagram.translate(Vec2(0, FG_NODE_SIZE + FG_NODE_GAP)),
    );
  }

  const nodeCenter = Vec2(nodeX, FG_NODE_SIZE / 2);
  nodeCenters[node.id] = pointInDiagram(diagram, nodeCenter);
  diagram.push(
    circle({
      center: nodeCenter,
      radius: FG_NODE_SIZE / 2,
      fillStyle: { fg: "black", bg: "lightgray" }[style],
    }).absoluteKey(`${keyPrefix}-${node.id}`),
  );

  return {
    diagram,
    w: Math.max(childrenX, FG_NODE_SIZE),
    h: FG_NODE_SIZE + (childrenMaxH > 0 ? FG_NODE_GAP + childrenMaxH : 0),
  };
}
