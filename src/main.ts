import * as d3 from "d3-shape";
import _ from "lodash";
import { layer, type Layer } from "./layer";
import {
  buildHasseDiagram,
  megaTree,
  nodesInTree,
  TreeMorph,
  TreeNode,
} from "./trees";
import { assertNever, clamp } from "./utils";
import { add, dot, length, normalize, sub, v, type Vec2 } from "./vec2";
import { inXYWH, type XYWH } from "./xywh";

// # Shape system

export type Shape =
  | {
      type: "circle";
      center: Vec2;
      radius: number;
      fillStyle: string;
      nodeId?: string;
    }
  | {
      type: "line";
      from: Vec2;
      to: Vec2;
      strokeStyle: string;
      lineWidth: number;
    }
  | {
      type: "curve";
      points: Vec2[];
      strokeStyle: string;
      lineWidth: number;
    }
  | {
      type: "group";
      shapes: Shape[];
      offset?: Vec2;
      parent?: Group;
    }
  | {
      type: "keyed-group";
      shapes: Record<string, Shape>;
      offset?: Vec2;
      parent?: Group;
    }
  | {
      type: "lazy";
      getShape: () => Shape;
    };

export type Group = Shape & { type: "group" };
export type KeyedGroup = Shape & { type: "keyed-group" };

export function group(): Group {
  return { type: "group", shapes: [] };
}

export function keyedGroup(): KeyedGroup {
  return { type: "keyed-group", shapes: {} };
}

export function placeGroup(
  parent: Group,
  child: Group | KeyedGroup,
  offset?: Vec2,
): void {
  child.parent = parent;
  if (offset) {
    child.offset = offset;
  }
  parent.shapes.push(child);
}

export type PointInGroup = {
  __group: Group;
  __point: Vec2;
};

export function pointInGroup(group: Group, localPoint: Vec2): PointInGroup {
  return { __group: group, __point: localPoint };
}

export function resolvePointInGroup(target: Group, pig: PointInGroup): Vec2 {
  let { __group: group, __point: point } = pig;

  while (true) {
    if (group === target) {
      return point;
    }
    if (group.offset) {
      point = add(point, group.offset);
    }
    if (!group.parent) {
      throw new Error("Point's group is not a descendant of target group");
    }
    group = group.parent;
  }
}

export function drawShape(lyr: Layer, shape: Shape): void {
  lyr.do(() => {
    switch (shape.type) {
      case "circle":
        lyr.fillStyle = shape.fillStyle;
        lyr.beginPath();
        lyr.arc(...shape.center, shape.radius, 0, Math.PI * 2);
        lyr.fill();
        break;
      case "line":
        lyr.strokeStyle = shape.strokeStyle;
        lyr.lineWidth = shape.lineWidth;
        lyr.beginPath();
        lyr.moveTo(...shape.from);
        lyr.lineTo(...shape.to);
        lyr.stroke();
        break;
      case "curve":
        lyr.strokeStyle = shape.strokeStyle;
        lyr.lineWidth = shape.lineWidth;
        const curve = d3.curveCardinal(lyr);
        lyr.beginPath();
        curve.lineStart();
        for (const pt of shape.points) {
          curve.point(...pt);
        }
        curve.lineEnd();
        lyr.stroke();
        break;
      case "group":
        lyr.do(() => {
          if (shape.offset) {
            lyr.translate(...shape.offset);
          }

          for (const child of shape.shapes) {
            drawShape(lyr, child);
          }
        });
        break;
      case "keyed-group":
        lyr.do(() => {
          if (shape.offset) {
            lyr.translate(...shape.offset);
          }

          for (const key of Object.keys(shape.shapes)) {
            drawShape(lyr, shape.shapes[key]);
          }
        });
        break;
      case "lazy":
        drawShape(lyr, shape.getShape());
        break;
      default:
        assertNever(shape);
    }
  });
}

export function stripParents(shape: Shape): Shape {
  if (shape.type === "group") {
    return {
      ...shape,
      parent: undefined,
      shapes: shape.shapes.map(stripParents),
    };
  } else if (shape.type === "keyed-group") {
    return {
      ...shape,
      parent: undefined,
      shapes: _.mapValues(shape.shapes, stripParents),
    };
  }
  return shape;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

export function resolveLazy(shape: Shape): Shape {
  if (shape.type === "lazy") {
    return resolveLazy(shape.getShape());
  } else if (shape.type === "group") {
    return {
      ...shape,
      shapes: shape.shapes.map(resolveLazy),
    };
  } else if (shape.type === "keyed-group") {
    return {
      ...shape,
      shapes: _.mapValues(shape.shapes, (v) => resolveLazy(v)),
    };
  }
  return shape;
}

export function lerpShapes(a: Shape, b: Shape, t: number): Shape {
  function assertSameType<T extends Shape>(a: T, b: Shape): asserts b is T {
    if (a.type !== b.type)
      throw new Error(
        `Cannot interpolate shapes of different types (${a.type} vs ${b.type})`,
      );
  }

  switch (a.type) {
    case "circle":
      assertSameType(a, b);
      if (b.fillStyle !== a.fillStyle)
        throw new Error("Cannot interpolate shapes with different styles");
      return {
        type: "circle",
        center: lerpVec2(a.center, b.center, t),
        radius: lerp(a.radius, b.radius, t),
        fillStyle: a.fillStyle,
        nodeId: a.nodeId,
      };
    case "line":
      assertSameType(a, b);
      if (b.strokeStyle !== a.strokeStyle)
        throw new Error("Cannot interpolate shapes with different styles");
      return {
        type: "line",
        from: lerpVec2(a.from, b.from, t),
        to: lerpVec2(a.to, b.to, t),
        strokeStyle: a.strokeStyle,
        lineWidth: lerp(a.lineWidth, b.lineWidth, t),
      };
    case "curve":
      assertSameType(a, b);
      if (b.strokeStyle !== a.strokeStyle)
        throw new Error("Cannot interpolate shapes with different styles");
      if (b.points.length !== a.points.length)
        throw new Error(
          "Cannot interpolate curves with different point counts",
        );
      return {
        type: "curve",
        points: a.points.map((ap, i) => lerpVec2(ap, b.points[i], t)),
        strokeStyle: a.strokeStyle,
        lineWidth: lerp(a.lineWidth, b.lineWidth, t),
      };
    case "group":
      assertSameType(a, b);
      if (b.shapes.length !== a.shapes.length)
        throw new Error(
          "Cannot interpolate groups with different shape counts",
        );
      return {
        type: "group",
        shapes: a.shapes.map((as, i) => lerpShapes(as, b.shapes[i], t)),
        offset: lerpVec2(a.offset ?? v(0), b.offset ?? v(0), t),
      };
    case "keyed-group":
      assertSameType(a, b);
      if (
        Object.keys(a.shapes).length !== Object.keys(b.shapes).length ||
        Object.keys(a.shapes).some((k) => !(k in b.shapes))
      )
        throw new Error("Cannot interpolate keyed groups with different keys");
      return {
        type: "keyed-group",
        shapes: _.mapValues(a.shapes, (as, k) =>
          lerpShapes(as, b.shapes[k], t),
        ),
        offset: lerpVec2(a.offset ?? v(0), b.offset ?? v(0), t),
      };
    case "lazy":
      throw new Error("Cannot interpolate lazy shapes");
    default:
      return assertNever(a);
  }
}

// Canvas setup
const c = document.getElementById("c") as HTMLCanvasElement;
const cContainer = document.getElementById("c-container") as HTMLDivElement;
const ctx = c.getContext("2d")!;

// Pan state
let pan: Vec2 = [80, 80];

// Debug state
let showClickablesDebug = false;

// Interaction state machine
type InteractionState = { type: "not-dragging" } | { type: "dragging" };

let ix: InteractionState = { type: "not-dragging" };

// Mouse tracking
let mouseX = 0;
let mouseY = 0;
let pointerType: string = "mouse";

const updateMouse = (e: PointerEvent) => {
  // clientX/Y works better than offsetX/Y for Chrome/Safari compatibility.
  // const dragOffset =
  //   ix.type === "confirmed" && pointerType === "touch" ? 50 : 0;
  mouseX = e.clientX;
  // mouseY = e.clientY - dragOffset;
  mouseY = e.clientY;
  pointerType = e.pointerType;
};

// Clickable tracking (for future use)
let _clickables: {
  xywh: XYWH;
  onClick: () => void;
}[] = [];

let _onPointerUps: (() => void)[] = [];

const hoveredClickable = () => {
  return _clickables.find(({ xywh }) => inXYWH(mouseX, mouseY, xywh));
};

// Keyboard event listeners
window.addEventListener("keydown", (e) => {
  if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    showClickablesDebug = !showClickablesDebug;
  }
  if (e.key === "Escape") {
    selectedNodeId = null;
  }
});

// Pointer event listeners
c.addEventListener("pointermove", (e) => {
  updateMouse(e);

  // if (ix.type === "unconfirmed") {
  //   if (distance(ix.startPos, [e.clientX, e.clientY]) > 4) {
  //     if (ix.callback) {
  //       ix.callback();
  //       ix = { type: "confirmed", isPan: false, pointerType };
  //     } else {
  //       ix = { type: "confirmed", isPan: true, pointerType };
  //     }
  //   }
  // }

  // if (ix.type === "confirmed" && ix.isPan) {
  //   pan = add(pan, [e.movementX, e.movementY]);
  // }
});

c.addEventListener("pointerdown", (e) => {
  updateMouse(e);

  const clickable = hoveredClickable();
  if (clickable) {
    clickable.onClick();
    ix = { type: "dragging" };
  }
  // const callback = hoveredClickable()?.callback;
  // ix = { type: "unconfirmed", startPos: [mouseX, mouseY], callback };
});

c.addEventListener("pointerup", (e) => {
  updateMouse(e);

  // if (ix.type === "unconfirmed") {
  //   // a click!
  //   if (ix.callback) {
  //     ix.callback();
  //   }
  // } else if (ix.type === "confirmed") {
  //   if (!ix.isPan) {
  //     // a drag!
  //     const callback = hoveredClickable()?.callback;
  //     if (callback) {
  //       callback();
  //     }
  //   }
  //   // end of a pan or drag; it's all good
  // }

  _onPointerUps.forEach((f) => f());

  ix = { type: "not-dragging" };
});

// Helper to add clickable region
const addClickHandler = (xywh: XYWH, onClick: () => void) => {
  _clickables.push({ xywh, onClick });
};
const addPointerUpHandler = (onUp: () => void) => {
  _onPointerUps.push(onUp);
};

const BG_NODE_PADDING = 10;
const BG_NODE_GAP = 40;
const FG_NODE_SIZE = 40;
const FG_NODE_GAP = 20;

function drawBgTree(
  /** The background (codomain) node to draw */
  bgNode: TreeNode,
  /** The foreground (domain) node to draw */
  fgNode: TreeNode,
  morph: TreeMorph,
): { bgGrp: Group; fgGrp: Shape; w: number; h: number } {
  const fgKeyedGroup = keyedGroup();
  const r = drawBgSubtree(bgNode, [fgNode], morph, {}, fgKeyedGroup);
  // TODO: first we have to parent the fgKeyedGroup so lazy shapes
  // can access fgKeyedGroup.parent
  placeGroup(r.fgGrp, fgKeyedGroup);
  // then we can resolve the lazy shapes
  const resolved = resolveLazy(fgKeyedGroup);
  return { bgGrp: r.bgGrp, fgGrp: resolved, w: r.w, h: r.h };
}

function drawBgSubtree(
  /** The background (codomain) node to draw */
  bgNode: TreeNode,
  /** All foreground (domain) nodes that are still looking for a
   * home, here or elsewhere, TODO: in left-to-right order */
  fgNodes: TreeNode[],
  morph: TreeMorph,
  /** An mutable record of where foreground nodes centers */
  fgNodeCenters: Record<string, PointInGroup>,
  fgKeyedGroup: KeyedGroup,
): {
  bgGrp: Group;
  fgGrp: Group;
  w: number;
  h: number;
  rootCenter: PointInGroup;
} {
  const bgGrp = group();
  const fgGrp = group();

  let [fgNodesHere, fgNodesBelow] = _.partition(
    fgNodes,
    (n) => morph[n.id] === bgNode.id,
  );

  const bgNodeR = drawBgNodeWithFgNodesInside(
    morph,
    bgNode,
    fgNodesHere,
    fgNodeCenters,
    fgKeyedGroup,
  );

  fgNodesBelow.push(...bgNodeR.fgNodesBelow);

  let x = 0;
  let y = bgNodeR.h + BG_NODE_GAP;
  let maxX = bgNodeR.w;
  let maxY = bgNodeR.h;

  const childRootCenters: Vec2[] = [];

  for (const child of bgNode.children) {
    const childR = drawBgSubtree(
      child,
      fgNodesBelow,
      morph,
      fgNodeCenters,
      fgKeyedGroup,
    );

    placeGroup(bgGrp, childR.bgGrp, v(x, y));
    placeGroup(fgGrp, childR.fgGrp, v(x, y));

    x += childR.w + BG_NODE_GAP;
    maxX = Math.max(maxX, x - BG_NODE_GAP);
    maxY = Math.max(maxY, y + childR.h);

    childRootCenters.push(resolvePointInGroup(bgGrp, childR.rootCenter));
  }

  const bgNodeOffset = v(
    childRootCenters.length > 0
      ? (childRootCenters[0][0] +
          childRootCenters[childRootCenters.length - 1][0]) /
          2 -
          bgNodeR.w / 2
      : (maxX - bgNodeR.w) / 2,
    0,
  );
  placeGroup(bgGrp, bgNodeR.bgGrp, bgNodeOffset);
  placeGroup(fgGrp, bgNodeR.fgGrp, bgNodeOffset);

  for (const childRootCenter of childRootCenters) {
    bgGrp.shapes.push({
      type: "line",
      from: resolvePointInGroup(bgGrp, bgNodeR.rootCenter),
      to: childRootCenter,
      strokeStyle: "lightgray",
      lineWidth: 12,
    });
  }

  return {
    bgGrp,
    fgGrp,
    w: maxX,
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
  fgNodeCenters: Record<string, PointInGroup>,
  fgKeyedGroup: KeyedGroup,
): {
  bgGrp: Group;
  fgGrp: Group;
  w: number;
  h: number;
  /** A list of foreground nodes that are descendents of nodes drawn
   * here, but which belong in lower-down background nodes */
  fgNodesBelow: TreeNode[];
  rootCenter: PointInGroup;
} {
  const bgGrpInRect = group();
  const fgGrpInRect = group();

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
      fgKeyedGroup,
    );
    placeGroup(fgGrpInRect, r.fgGrp, v(x, y));

    x += r.w + FG_NODE_GAP;
    maxX = Math.max(maxX, x - FG_NODE_GAP);
    maxY = Math.max(maxY, y + r.h);

    fgNodesBelow.push(...r.fgNodesBelow);
  }

  maxX += BG_NODE_PADDING;
  maxY += BG_NODE_PADDING;

  const nodeCenterInRect = v(maxX / 2, maxY / 2);
  const circleRadius = length(nodeCenterInRect);
  const nodeCenterInCircle = v(circleRadius, circleRadius);
  const offset = sub(nodeCenterInCircle, nodeCenterInRect);

  const bgGrp = group();
  const fgGrp = group();
  placeGroup(bgGrp, bgGrpInRect, offset);
  placeGroup(fgGrp, fgGrpInRect, offset);

  bgGrp.shapes.push({
    type: "circle",
    center: nodeCenterInCircle,
    radius: circleRadius,
    fillStyle: "lightgray",
  });

  return {
    bgGrp: bgGrp,
    fgGrp: fgGrp,
    w: 2 * circleRadius,
    h: 2 * circleRadius,
    fgNodesBelow,
    rootCenter: pointInGroup(bgGrp, nodeCenterInCircle),
  };
}

function drawFgSubtreeInBgNode(
  fgNode: TreeNode,
  bgNodeId: string,
  morph: TreeMorph,
  /** An mutable record of where foreground nodes centers */
  fgNodeCenters: Record<string, PointInGroup>,
  fgKeyedGroup: KeyedGroup,
): {
  fgGrp: Group;
  fgNodesBelow: TreeNode[];
  w: number;
  h: number;
} {
  const fgGrpChildren = group();
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
        fgKeyedGroup,
      );
      placeGroup(fgGrpChildren, r.fgGrp, v(childrenX, 0));
      fgNodesBelow.push(...r.fgNodesBelow);
      childrenX += r.w;
      childrenMaxH = Math.max(childrenMaxH, r.h);

      fgKeyedGroup.shapes[edgeKey] = {
        type: "lazy",
        getShape: () => {
          const myCenter = fgNodeCenters[fgNode.id];
          const childCenter = fgNodeCenters[child.id];
          // TODO: fgKeyedGroup.parent is a total hack here
          const from = resolvePointInGroup(fgKeyedGroup.parent!, myCenter);
          return {
            type: "curve",
            points: [
              from,
              from,
              resolvePointInGroup(fgKeyedGroup.parent!, childCenter),
            ],
            strokeStyle: "black",
            lineWidth: 2,
          };
        },
      };
    } else {
      fgNodesBelow.push(child);

      const childrenXBefore = childrenX;
      fgKeyedGroup.shapes[edgeKey] = {
        type: "lazy",
        getShape: () => {
          const myCenter = fgNodeCenters[fgNode.id];
          const intermediate = pointInGroup(
            fgGrpChildren,
            v(childrenXBefore, 0),
          );
          const childCenter = fgNodeCenters[child.id];
          return {
            type: "curve",
            points: [
              resolvePointInGroup(fgKeyedGroup.parent!, myCenter),
              resolvePointInGroup(fgKeyedGroup.parent!, intermediate),
              resolvePointInGroup(fgKeyedGroup.parent!, childCenter),
            ],
            strokeStyle: "black",
            lineWidth: 2,
          };
        },
      };
    }
  }

  const fgGrp = group();
  let nodeX;
  if (childrenX < FG_NODE_SIZE) {
    nodeX = FG_NODE_SIZE / 2;
    placeGroup(
      fgGrp,
      fgGrpChildren,
      v((FG_NODE_SIZE - childrenX) / 2, FG_NODE_SIZE + FG_NODE_GAP),
    );
  } else {
    nodeX = childrenX / 2;
    placeGroup(fgGrp, fgGrpChildren, v(0, FG_NODE_SIZE + FG_NODE_GAP));
  }

  const nodeCenter = v(nodeX, FG_NODE_SIZE / 2);
  fgNodeCenters[fgNode.id] = pointInGroup(fgGrp, nodeCenter);
  fgKeyedGroup.shapes[fgNode.id] = {
    type: "lazy",
    getShape: () => {
      return {
        type: "circle",
        center: resolvePointInGroup(
          fgKeyedGroup.parent!,
          fgNodeCenters[fgNode.id],
        ),
        radius: FG_NODE_SIZE / 2,
        fillStyle: "black",
      };
    },
  };

  return {
    fgGrp: fgGrp,
    fgNodesBelow,
    w: Math.max(childrenX, FG_NODE_SIZE),
    h: FG_NODE_SIZE + (childrenMaxH > 0 ? FG_NODE_GAP + childrenMaxH : 0),
  };
}

const codomainTree = megaTree;
const domainTree = megaTree;

const hasseDiagram = buildHasseDiagram(domainTree, codomainTree);
console.log("Hasse diagram contains:", hasseDiagram.nodes.length);

const drawnTrees = hasseDiagram.nodes.map((morph) =>
  drawBgTree(codomainTree, domainTree, morph),
);

// const morphBefore = hasseDiagram.nodes[0];
// const morphAfter = hasseDiagram.nodes[1];
// const nodeId = covers(morphBefore, morphAfter, codomainTree)!;

// const rBefore = drawBgTree(codomainTree, domainTree, morphBefore);
// const rAfter = drawBgTree(codomainTree, domainTree, morphAfter);

let curMorphIdx = 0;
let selectedNodeId: string | null = null;

// Drawing function
function draw() {
  // Reset clickables at the start of each frame
  _clickables = [];
  _onPointerUps = [];

  // Create main layer
  const lyr = layer(ctx);

  // Clear canvas with white background
  lyr.fillStyle = "white";
  lyr.fillRect(0, 0, c.width, c.height);

  const lyrPan = layer(ctx);
  lyr.place(lyrPan, pan);

  function getNode(grp: Shape, id: string): Shape & { type: "circle" } {
    return (grp as KeyedGroup).shapes[id] as Shape & {
      type: "circle";
    };
  }

  // const aBefore = getNode(rBefore.fgGrp, nodeId).center;
  // const aAfter = getNode(rAfter.fgGrp, nodeId).center;

  // // now t goes from 0 to 1 as mouseInLyrPan goes from aBefore to aAfter
  // // (clamped, using a dot product)
  // const totalVec = sub(aAfter, aBefore);
  // const mouseVec = sub(mouseInLyrPan, aBefore);
  // let t = Math.max(
  //   0,
  //   Math.min(1, dot(mouseVec, totalVec) / dot(totalVec, totalVec)),
  // );

  // // const t = Math.sin(Date.now() / 1000) * 0.5 + 0.5;
  // const bgGrpLerp = lerpShapes(rBefore.bgGrp, rAfter.bgGrp, t);
  // const fgGrpLerp = lerpShapes(rBefore.fgGrp, rAfter.fgGrp, t);
  // console.log("fgGrpLerp:", fgGrpLerp);
  // console.log("aBefore:", aBefore);
  // console.log("aAfter:", aAfter);

  // drawShape(lyrPan, bgGrpLerp);
  // drawShape(lyrPan, fgGrpLerp);

  const curDrawnTree = drawnTrees[curMorphIdx];

  const mouseInLyrPan = sub(v(mouseX, mouseY), pan);

  let drewSomething = false;
  if (selectedNodeId) {
    addPointerUpHandler(() => {
      selectedNodeId = null;
    });
    const selectedNode = getNode(curDrawnTree.fgGrp, selectedNodeId);
    const adjMorphIdxes = [
      ...hasseDiagram.edges
        .filter(
          ([from, _to, nodeId]) =>
            from === curMorphIdx && nodeId === selectedNodeId,
        )
        .map(([, to]) => to),
      ...hasseDiagram.edges
        .filter(
          ([_from, to, nodeId]) =>
            to === curMorphIdx && nodeId === selectedNodeId,
        )
        .map(([from]) => from),
    ];
    const toMouse = normalize(sub(mouseInLyrPan, selectedNode.center));
    // which adjacent morphism maximizes the dot product with toMouse?
    const adjMorphDots = adjMorphIdxes.map((adjMorphIdx) => {
      const adjDrawn = drawnTrees[adjMorphIdx];
      const adjNode = getNode(adjDrawn.fgGrp, selectedNodeId!);
      const toAdjNode = normalize(sub(adjNode.center, selectedNode.center));
      return {
        adjMorphIdx,
        dot: dot(toMouse, toAdjNode),
      };
    });
    const bestAdjMorphIdx = _.maxBy(
      adjMorphDots.filter(({ dot }) => dot > 0.5),
      "dot",
    )?.adjMorphIdx;

    if (bestAdjMorphIdx !== undefined) {
      const adjDrawn = drawnTrees[bestAdjMorphIdx];
      const adjNode = getNode(adjDrawn.fgGrp, selectedNodeId);
      const totalVec = sub(adjNode.center, selectedNode.center);
      const mouseVec = sub(mouseInLyrPan, selectedNode.center);
      let t = clamp(0, 1, dot(mouseVec, totalVec) / dot(totalVec, totalVec));

      const targetDrawnTree = drawnTrees[bestAdjMorphIdx];

      const bgGrpLerp = lerpShapes(
        curDrawnTree.bgGrp,
        targetDrawnTree.bgGrp,
        t,
      );
      const fgGrpLerp = lerpShapes(
        curDrawnTree.fgGrp,
        targetDrawnTree.fgGrp,
        t,
      );
      drawShape(lyrPan, bgGrpLerp);
      drawShape(lyrPan, fgGrpLerp);
      drewSomething = true;

      if (t === 1) {
        curMorphIdx = bestAdjMorphIdx;
      }

      if (t > 0.5) {
        addPointerUpHandler(() => {
          console.log("pointer up with t =", t);

          curMorphIdx = bestAdjMorphIdx;
        });
      }

      // lyrPan.do(() => {
      //   lyrPan.beginPath();
      //   lyrPan.arc(...fgNode.center, FG_NODE_SIZE / 2, 0, Math.PI * 2);
      //   lyrPan.strokeStyle = "rgba(128,128,255)";
      //   lyrPan.lineWidth = 2;
      //   lyrPan.moveTo(...selectedNode.center);
      //   lyrPan.lineTo(...fgNode.center);
      //   lyrPan.stroke();
      // });
      // const bbox: XYWH = [
      //   ...sub(add(pan, fgNode.center), v(FG_NODE_SIZE / 2)),
      //   FG_NODE_SIZE,
      //   FG_NODE_SIZE,
      // ];

      // addClickHandler(bbox, () => {
      //   curMorphIdx = adjMorphIdx;
      //   selectedNodeId = null;
      // });
    }
  }

  if (!drewSomething) {
    drawShape(lyrPan, curDrawnTree.bgGrp);
    drawShape(lyrPan, curDrawnTree.fgGrp);

    for (const node of nodesInTree(codomainTree)) {
      const fgNode = getNode(curDrawnTree.fgGrp, node.id);
      const bbox: XYWH = [
        ...sub(add(pan, fgNode.center), v(FG_NODE_SIZE / 2)),
        FG_NODE_SIZE,
        FG_NODE_SIZE,
      ];
      // if (node.id === selectedNodeId || inXYWH(mouseX, mouseY, bbox)) {
      //   lyrPan.do(() => {
      //     lyrPan.beginPath();
      //     lyrPan.arc(...fgNode.center, FG_NODE_SIZE / 2, 0, Math.PI * 2);
      //     lyrPan.fillStyle = "rgba(128,128,255)";
      //     lyrPan.fill();
      //   });
      // }
      addClickHandler(bbox, () => {
        selectedNodeId = node.id;
      });
    }
  }

  // // Build Hasse diagram and layout
  // const diagram = buildHasseDiagram(domainTree, codomainTree);
  // const hasseLayout = layoutHasse(diagram);

  // // Store morphism bounding boxes and centers for edge drawing
  // const morphBoxes: Map<
  //   number,
  //   {
  //     x: number;
  //     y: number;
  //     w: number;
  //     h: number;
  //     centerX: number;
  //     centerY: number;
  //   }
  // > = new Map();

  // // Draw each morphism at its dagre-computed position
  // for (let morphIdx = 0; morphIdx < diagram.nodes.length; morphIdx++) {
  //   const morph = diagram.nodes[morphIdx];
  //   const pos = hasseLayout.positions.get(morphIdx)!;

  //   const fgNodeCenters: Record<string, PointOnLayer> = {};
  //   const fgKeyedGroup: ((lyr: Layer) => void)[] = [];
  //   const r = drawBgSubtree(
  //     codomainTree,
  //     [domainTree],
  //     morph,
  //     fgNodeCenters,
  //     fgKeyedGroup,
  //   );

  //   // Center the morphism at the dagre position
  //   const morphX = curX + pos.x - r.w / 2;
  //   const morphY = curY + pos.y - r.h / 2;

  //   bgGrp.place(r.bgGrp, v(morphX, morphY));
  //   fgGrp.place(r.fgGrp, v(morphX, morphY));

  //   for (const task of fgKeyedGroup) {
  //     task(fgGrp);
  //   }

  //   // Store bounding box for edge drawing
  //   morphBoxes.set(morphIdx, {
  //     x: morphX,
  //     y: morphY,
  //     w: r.w,
  //     h: r.h,
  //     centerX: curX + pos.x,
  //     centerY: curY + pos.y,
  //   });
  // }

  // // Draw edges between morphisms in the Hasse diagram (on edge layer, behind everything)
  // for (const [from, to] of diagram.edges) {
  //   const fromBox = morphBoxes.get(from);
  //   const toBox = morphBoxes.get(to);

  //   if (fromBox && toBox) {
  //     edgeGrp.do(() => {
  //       edgeGrp.strokeStyle = "black";
  //       edgeGrp.lineWidth = 3;
  //       edgeGrp.beginPath();
  //       // Draw from center to center of morphisms
  //       edgeGrp.moveTo(fromBox.centerX, fromBox.centerY);
  //       edgeGrp.lineTo(toBox.centerX, toBox.centerY);
  //       edgeGrp.stroke();
  //     });
  //   }
  // }

  // // Draw white circles behind each morphism visualization
  // for (const [morphIdx, box] of morphBoxes.entries()) {
  //   whiteBackgroundLyr.do(() => {
  //     whiteBackgroundLyr.fillStyle = "white";
  //     whiteBackgroundLyr.beginPath();
  //     // Use the larger of width/height as diameter, add some padding
  //     const radius = Math.max(box.w, box.h) / 2 + 10;
  //     whiteBackgroundLyr.arc(box.centerX, box.centerY, radius, 0, Math.PI * 2);
  //     whiteBackgroundLyr.fill();
  //   });
  // }

  // Clickables debug
  if (showClickablesDebug) {
    for (const clickable of _clickables) {
      debugRect(lyr, ...clickable.xywh);
    }
  }

  // Draw all commands
  lyr.draw();
}

// Auto-resize canvas to match container
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    c.width = width;
    c.height = height;
    draw(); // Redraw immediately after resize
  }
});
resizeObserver.observe(cContainer);

// Main render loop
function drawLoop() {
  requestAnimationFrame(drawLoop);
  draw();
}

// Start the render loop
if (true) {
  drawLoop();
} else {
  draw();
}

function debugRect(
  lyr: Layer,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string = "magenta",
) {
  lyr.do(() => {
    lyr.strokeStyle = color;
    lyr.beginPath();
    lyr.rect(x, y, w, h);
    lyr.stroke();
  });
}
