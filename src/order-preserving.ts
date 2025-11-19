import _ from "lodash";
import { overlapIntervals } from "./layout";
import {
  PointInShape,
  Shape,
  group,
  keyed,
  lazy,
  pointInShape,
  translate,
  zIndex,
} from "./shape";
import { TreeMorph, TreeNode } from "./trees";
import { Vec2 } from "./vec2";

const BG_NODE_PADDING = 10;
const BG_NODE_GAP = 40;
export const FG_NODE_SIZE = 40; // HACK
const FG_NODE_GAP = 20;

export function drawBgTree(
  /** The background (codomain) node to draw */
  bgNode: TreeNode,
  /** The foreground (domain) node to draw */
  fgNode: TreeNode,
  morph: TreeMorph,
): { shape: Shape; w: number; h: number } {
  return drawBgSubtree(bgNode, [fgNode], morph, {});
}

function drawBgSubtree(
  /** The background (codomain) node to draw */
  bgNode: TreeNode,
  /** All foreground (domain) nodes that are still looking for a
   * home, here or elsewhere, TODO: in left-to-right order */
  fgNodes: TreeNode[],
  morph: TreeMorph,
  /** An mutable record of where foreground nodes centers */
  fgNodeCenters: Record<string, PointInShape>,
): {
  shape: Shape;
  w: number;
  h: number;
  rootCenter: PointInShape;
} {
  const shape = group(`drawBgSubtree(${bgNode.id})`);

  let [fgNodesHere, fgNodesBelow] = _.partition(
    fgNodes,
    (n) => morph[n.id] === bgNode.id,
  );

  const bgNodeR = drawBgNodeWithFgNodesInside(
    morph,
    bgNode,
    fgNodesHere,
    fgNodeCenters,
  );

  fgNodesBelow.push(...bgNodeR.fgNodesBelow);

  if (bgNode.children.length === 0) {
    return {
      shape: bgNodeR.shape,
      w: bgNodeR.w,
      h: bgNodeR.h,
      rootCenter: bgNodeR.rootCenter,
    };
  }

  const childRs = bgNode.children.map((child) =>
    drawBgSubtree(child, fgNodesBelow, morph, fgNodeCenters),
  );

  const childrenWidth =
    _.sumBy(childRs, (r) => r.w) + BG_NODE_GAP * (childRs.length - 1);

  const firstChildX = childRs[0].rootCenter.__point.x;
  const lastChildX =
    childrenWidth -
    (childRs[childRs.length - 1].w -
      childRs[childRs.length - 1].rootCenter.__point.x);

  const params = {
    aLength: bgNodeR.w,
    aAnchor: bgNodeR.w / 2,
    bLength: childrenWidth,
    bAnchor: (firstChildX + lastChildX) / 2,
  };
  const { aOffset, bOffset, length: width } = overlapIntervals(params);

  shape.shapes.push(translate(Vec2(aOffset, 0), bgNodeR.shape));

  let x = bOffset;
  let y = bgNodeR.h + BG_NODE_GAP;
  let maxY = bgNodeR.h;

  for (const childR of childRs) {
    shape.shapes.push(translate(Vec2(x, y), childR.shape));

    x += childR.w + BG_NODE_GAP;
    maxY = Math.max(maxY, y + childR.h);

    shape.shapes.push(
      lazy((resolveHere) => ({
        type: "line",
        from: resolveHere(bgNodeR.rootCenter),
        to: resolveHere(childR.rootCenter),
        strokeStyle: "lightgray",
        lineWidth: 12,
      })),
    );
  }

  return {
    shape,
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
  fgNodeCenters: Record<string, PointInShape>,
): {
  shape: Shape;
  w: number;
  h: number;
  /** A list of foreground nodes that are descendents of nodes drawn
   * here, but which belong in lower-down background nodes */
  fgNodesBelow: TreeNode[];
  rootCenter: PointInShape;
} {
  const shapeInRect = group(`drawBgNodeWithFgNodesInside(${bgNode.id})-inner`);

  let x = BG_NODE_PADDING;
  let y = BG_NODE_PADDING;

  let maxX = x + 10;
  let maxY = y + 10;

  const fgNodesBelow: TreeNode[] = [];

  for (const fgNode of fgNodesHere) {
    const r = drawFgSubtreeInBgNode(fgNode, bgNode.id, morph, fgNodeCenters);
    shapeInRect.shapes.push(translate(Vec2(x, y), r.shape));

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

  const shape = group(`drawBgNodeWithFgNodesInside(${bgNode.id})`);
  shape.shapes.push(translate(offset, shapeInRect));

  shape.shapes.push(
    zIndex(-1, {
      type: "circle",
      center: nodeCenterInCircle,
      radius: circleRadius,
      fillStyle: "lightgray",
    }),
  );

  return {
    shape,
    w: 2 * circleRadius,
    h: 2 * circleRadius,
    fgNodesBelow,
    rootCenter: pointInShape(shape, nodeCenterInCircle),
  };
}

function drawFgSubtreeInBgNode(
  fgNode: TreeNode,
  bgNodeId: string,
  morph: TreeMorph,
  /** An mutable record of where foreground nodes centers */
  fgNodeCenters: Record<string, PointInShape>,
): {
  shape: Shape;
  fgNodesBelow: TreeNode[];
  w: number;
  h: number;
} {
  const childrenShape = group(`drawFgSubtreeInBgNode(${fgNode.id})-children`);
  const fgNodesBelow: TreeNode[] = [];
  let childrenX = 0;
  let childrenMaxH = 0;
  for (const [i, child] of fgNode.children.entries()) {
    if (i > 0) {
      childrenX += FG_NODE_GAP;
    }
    const edgeKey = `${fgNode.id}->${child.id}`;
    if (morph[child.id] === bgNodeId) {
      const r = drawFgSubtreeInBgNode(child, bgNodeId, morph, fgNodeCenters);
      childrenShape.shapes.push(translate(Vec2(childrenX, 0), r.shape));
      fgNodesBelow.push(...r.fgNodesBelow);
      childrenX += r.w;
      childrenMaxH = Math.max(childrenMaxH, r.h);

      childrenShape.shapes.push(
        keyed(
          edgeKey,
          false,
          lazy((resolveHere) => {
            const from = resolveHere(fgNodeCenters[fgNode.id]);
            const to = resolveHere(fgNodeCenters[child.id]);
            return {
              type: "curve",
              points: [from, from, to],
              strokeStyle: "black",
              lineWidth: 2,
            };
          }),
        ),
      );
    } else {
      fgNodesBelow.push(child);

      const childrenXBefore = childrenX;
      childrenShape.shapes.push(
        keyed(
          edgeKey,
          false,
          lazy((resolveHere) => {
            const myCenter = fgNodeCenters[fgNode.id];
            const intermediate = pointInShape(
              childrenShape,
              Vec2(childrenXBefore, 0),
            );
            const childCenter = fgNodeCenters[child.id];
            return {
              type: "curve",
              points: [
                resolveHere(myCenter),
                resolveHere(intermediate),
                resolveHere(childCenter),
              ],
              strokeStyle: "black",
              lineWidth: 2,
            };
          }),
        ),
      );
    }
  }

  const shape = group(`drawFgSubtreeInBgNode(${fgNode.id})`);
  let nodeX;
  if (childrenX < FG_NODE_SIZE) {
    nodeX = FG_NODE_SIZE / 2;
    shape.shapes.push(
      translate(
        Vec2((FG_NODE_SIZE - childrenX) / 2, FG_NODE_SIZE + FG_NODE_GAP),
        childrenShape,
      ),
    );
  } else {
    nodeX = childrenX / 2;
    shape.shapes.push(
      translate(Vec2(0, FG_NODE_SIZE + FG_NODE_GAP), childrenShape),
    );
  }

  const nodeCenter = Vec2(nodeX, FG_NODE_SIZE / 2);
  fgNodeCenters[fgNode.id] = pointInShape(shape, nodeCenter);
  shape.shapes.push(
    keyed(fgNode.id, true, {
      type: "circle",
      center: nodeCenter,
      radius: FG_NODE_SIZE / 2,
      fillStyle: "black",
    }),
  );

  return {
    shape,
    fgNodesBelow,
    w: Math.max(childrenX, FG_NODE_SIZE),
    h: FG_NODE_SIZE + (childrenMaxH > 0 ? FG_NODE_GAP + childrenMaxH : 0),
  };
}

export function drawSubtree(
  node: TreeNode,
  keyPrefix: string,
  style: "fg" | "bg",
  /** An mutable record of where nodes are centered */
  nodeCenters: Record<string, PointInShape>,
): {
  shape: Shape;
  w: number;
  h: number;
} {
  const childrenShape = group(`drawSubtree(${node.id})-children`);
  let childrenX = 0;
  let childrenMaxH = 0;
  for (const [i, child] of node.children.entries()) {
    if (i > 0) {
      childrenX += FG_NODE_GAP;
    }
    const r = drawSubtree(child, keyPrefix, style, nodeCenters);
    childrenShape.shapes.push(translate(Vec2(childrenX, 0), r.shape));
    childrenX += r.w;
    childrenMaxH = Math.max(childrenMaxH, r.h);

    childrenShape.shapes.push(
      keyed(
        `${keyPrefix}-${node.id}->${child.id}`,
        false,
        lazy((resolveHere) => {
          const from = resolveHere(nodeCenters[node.id]);
          const to = resolveHere(nodeCenters[child.id]);
          return {
            type: "curve",
            points: [from, from, to],
            strokeStyle: { fg: "black", bg: "lightgray" }[style],
            lineWidth: { fg: 2, bg: 12 }[style],
          };
        }),
      ),
    );
  }

  const shape = group(`drawSubtree(${node.id})`);
  let nodeX;
  if (childrenX < FG_NODE_SIZE) {
    nodeX = FG_NODE_SIZE / 2;
    shape.shapes.push(
      translate(
        Vec2((FG_NODE_SIZE - childrenX) / 2, FG_NODE_SIZE + FG_NODE_GAP),
        childrenShape,
      ),
    );
  } else {
    nodeX = childrenX / 2;
    shape.shapes.push(
      translate(Vec2(0, FG_NODE_SIZE + FG_NODE_GAP), childrenShape),
    );
  }

  const nodeCenter = Vec2(nodeX, FG_NODE_SIZE / 2);
  nodeCenters[node.id] = pointInShape(shape, nodeCenter);
  shape.shapes.push(
    keyed(`${keyPrefix}-${node.id}`, false, {
      type: "circle",
      center: nodeCenter,
      radius: FG_NODE_SIZE / 2,
      fillStyle: { fg: "black", bg: "lightgray" }[style],
    }),
  );

  return {
    shape,
    w: Math.max(childrenX, FG_NODE_SIZE),
    h: FG_NODE_SIZE + (childrenMaxH > 0 ? FG_NODE_GAP + childrenMaxH : 0),
  };
}
