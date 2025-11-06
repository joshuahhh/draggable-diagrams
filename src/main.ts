import _ from "lodash";
import { layer, type Layer } from "./layer";
import {
  drawShape,
  group,
  Group,
  KeyedGroup,
  keyedGroup,
  lerpShapes,
  placeGroup,
  PointInGroup,
  pointInGroup,
  resolveLazy,
  resolvePointInGroup,
  Shape,
} from "./shape";
import {
  biggerTree,
  buildHasseDiagram,
  nodesInTree,
  TreeMorph,
  TreeNode,
} from "./trees";
import { clamp } from "./utils";
import { Vec2 } from "./vec2";
import { inXYWH, type XYWH } from "./xywh";

// Canvas setup
const c = document.getElementById("c") as HTMLCanvasElement;
const cContainer = document.getElementById("c-container") as HTMLDivElement;
const ctx = c.getContext("2d")!;

// Pan state
let pan = Vec2(80, 80);

// Debug state
let showClickablesDebug = false;

// Pointer tracking
let isDragging = false;
let hoverPointer = Vec2(0);
let dragPointer: Vec2 | null = null;

const updatePointer = (e: PointerEvent) => {
  // clientX/Y works better than offsetX/Y for Chrome/Safari compatibility.
  hoverPointer = Vec2(e.clientX, e.clientY);
  dragPointer = isDragging ? hoverPointer : null;
};

// Clickable tracking (for future use)
let _clickables: {
  xywh: XYWH;
  onClick: () => void;
}[] = [];

let _onPointerUps: (() => void)[] = [];

const hoveredClickable = () => {
  return (
    hoverPointer &&
    _clickables.find(({ xywh }) => inXYWH(...hoverPointer!.arr(), xywh))
  );
};

// Pointer event listeners
c.addEventListener("pointermove", (e) => {
  updatePointer(e);
});

c.addEventListener("pointerdown", (e) => {
  isDragging = true;
  updatePointer(e);

  const clickable = hoveredClickable();
  if (clickable) {
    clickable.onClick();
  }
});

c.addEventListener("pointerup", (e) => {
  isDragging = false;
  updatePointer(e);

  _onPointerUps.forEach((f) => f());
});

// Helper to add clickable region
const addClickHandler = (xywh: XYWH, onClick: () => void) => {
  _clickables.push({ xywh, onClick });
};
const addPointerUpHandler = (onUp: () => void) => {
  _onPointerUps.push(onUp);
};

// Keyboard event listeners
window.addEventListener("keydown", (e) => {
  if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    showClickablesDebug = !showClickablesDebug;
  }
  if (e.key === "Escape") {
    selectedNodeId = null;
    dragOffset = null;
  }
});

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

    placeGroup(bgGrp, childR.bgGrp, Vec2(x, y));
    placeGroup(fgGrp, childR.fgGrp, Vec2(x, y));

    x += childR.w + BG_NODE_GAP;
    maxX = Math.max(maxX, x - BG_NODE_GAP);
    maxY = Math.max(maxY, y + childR.h);

    childRootCenters.push(resolvePointInGroup(bgGrp, childR.rootCenter));
  }

  const bgNodeOffset = Vec2(
    childRootCenters.length > 0
      ? (childRootCenters[0].x +
          childRootCenters[childRootCenters.length - 1].x) /
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
    placeGroup(fgGrpInRect, r.fgGrp, Vec2(x, y));

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
      placeGroup(fgGrpChildren, r.fgGrp, Vec2(childrenX, 0));
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
            Vec2(childrenXBefore, 0),
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
      Vec2((FG_NODE_SIZE - childrenX) / 2, FG_NODE_SIZE + FG_NODE_GAP),
    );
  } else {
    nodeX = childrenX / 2;
    placeGroup(fgGrp, fgGrpChildren, Vec2(0, FG_NODE_SIZE + FG_NODE_GAP));
  }

  const nodeCenter = Vec2(nodeX, FG_NODE_SIZE / 2);
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

const domainTree = biggerTree;
const codomainTree = biggerTree;

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
let dragOffset: Vec2 | null = null;

// Drawing function
function draw() {
  // Reset clickables at the start of each frame
  _clickables = [];
  _onPointerUps = [];

  c.style.cursor = "default";

  // Create main layer
  const lyr = layer(ctx);

  // Clear canvas with white background
  lyr.fillStyle = "white";
  lyr.fillRect(0, 0, c.width, c.height);

  const lyrPan = layer(ctx);
  lyr.place(lyrPan, pan);

  function getCircle(grp: Shape, id: string): Shape & { type: "circle" } {
    return (grp as KeyedGroup).shapes[id] as Shape & {
      type: "circle";
    };
  }

  const curDrawnTree = drawnTrees[curMorphIdx];

  let drewSomething = false;
  let adjMorphDots: {
    adjMorphIdx: number;
    circle: Shape & { type: "circle" };
    dot: number;
  }[] = [];
  if (selectedNodeId) {
    const pointerInLyrPan = dragPointer!.sub(pan);

    c.style.cursor = "grabbing";
    addPointerUpHandler(() => {
      selectedNodeId = null;
      dragOffset = null;
    });
    const selectedCircle = getCircle(curDrawnTree.fgGrp, selectedNodeId);
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
    // const adjMorphIdxes = _.range(hasseDiagram.nodes.length);
    const toPointer = pointerInLyrPan.sub(selectedCircle.center).norm();
    // which adjacent morphism maximizes the dot product with toPointer?
    adjMorphDots = adjMorphIdxes.map((adjMorphIdx) => {
      const adjDrawn = drawnTrees[adjMorphIdx];
      const adjCircle = getCircle(adjDrawn.fgGrp, selectedNodeId!);
      const toAdjCircle = adjCircle.center.sub(selectedCircle.center).norm();
      return {
        adjMorphIdx,
        circle: adjCircle,
        dot: toPointer.dot(toAdjCircle),
      };
    });
    const bestAdjMorphIdx = _.maxBy(
      adjMorphDots.filter(({ dot }) => dot > 0.5),
      "dot",
    )?.adjMorphIdx;

    if (bestAdjMorphIdx !== undefined) {
      const adjDrawn = drawnTrees[bestAdjMorphIdx];
      const adjCircle = getCircle(adjDrawn.fgGrp, selectedNodeId);
      const totalVec = adjCircle.center.sub(selectedCircle.center);
      const pointerVec = pointerInLyrPan
        .sub(selectedCircle.center)
        .sub(dragOffset!);
      const t = clamp(0, 1, pointerVec.dot(totalVec) / totalVec.dot(totalVec));

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
    }
  }

  if (!drewSomething) {
    let cleanup = () => {};
    if (!selectedNodeId) {
      for (const node of nodesInTree(codomainTree)) {
        const fgNode = getCircle(curDrawnTree.fgGrp, node.id);
        const bbox: XYWH = [
          ...pan
            .add(fgNode.center)
            .sub(Vec2(FG_NODE_SIZE / 2))
            .arr(),
          FG_NODE_SIZE,
          FG_NODE_SIZE,
        ];
        if (inXYWH(...hoverPointer.arr(), bbox)) {
          c.style.cursor = "grab";
        }
        addClickHandler(bbox, () => {
          const pointerInLyrPan = dragPointer!.sub(pan);
          selectedNodeId = node.id;
          dragOffset = pointerInLyrPan.sub(fgNode.center);
        });
      }
    } else {
      const fgNode = getCircle(curDrawnTree.fgGrp, selectedNodeId!);
      const originalCenter = fgNode.center;
      cleanup = () => (fgNode.center = originalCenter);

      const pointerInLyrPan = dragPointer!.sub(pan);
      const desiredCenter = pointerInLyrPan.sub(dragOffset!);
      const desireVector = desiredCenter.sub(fgNode.center);
      const maxMoveDistance = FG_NODE_SIZE / 8;
      const desireVectorForVis =
        desireVector.len() === 0
          ? Vec2(0)
          : desireVector
              .norm()
              .mul(
                maxMoveDistance *
                  Math.tanh((0.05 * desireVector.len()) / maxMoveDistance),
              );
      const desiredCenterForVis = fgNode.center.add(desireVectorForVis);
      fgNode.center = desiredCenterForVis;
    }
    drawShape(lyrPan, curDrawnTree.bgGrp);
    drawShape(lyrPan, curDrawnTree.fgGrp);
    cleanup();
  }

  if (false) {
    for (const { circle } of adjMorphDots) {
      // draw dashed circle at adjCircle.center for debugging
      lyrPan.do(() => {
        lyrPan.strokeStyle = "red";
        lyrPan.setLineDash([5, 5]);
        lyrPan.beginPath();
        lyrPan.arc(...circle.center.arr(), circle.radius, 0, 2 * Math.PI);
        lyrPan.stroke();
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
