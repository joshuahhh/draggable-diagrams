import _ from "lodash";
import { layer, type Layer } from "./layer";
import {
  codomainTree,
  domainTree,
  testMorphs,
  TreeMorph,
  TreeNode,
} from "./trees";
import { add, distance, v, type Vec2 } from "./vec2";
import { inXYWH, type XYWH } from "./xywh";

// Canvas setup
const c = document.getElementById("c") as HTMLCanvasElement;
const cContainer = document.getElementById("c-container") as HTMLDivElement;
const ctx = c.getContext("2d")!;

// Pan state
let pan: Vec2 = [0, 0];

// Debug state
let showClickablesDebug = false;

// Interaction state machine
type InteractionState =
  | { type: "not-dragging" }
  // if we're dragging, the drag may be "unconfirmed" – not sure if
  // it's a drag or a click (save the click callback for later)
  | {
      type: "unconfirmed";
      startPos: Vec2;
      callback: (() => void) | undefined;
    }
  | { type: "confirmed"; isPan: boolean; pointerType: string };

let ix: InteractionState = { type: "not-dragging" };

// Mouse tracking
let mouseX = 0;
let mouseY = 0;
let pointerType: string = "mouse";

const updateMouse = (e: PointerEvent) => {
  // clientX/Y works better than offsetX/Y for Chrome/Safari compatibility.
  const dragOffset =
    ix.type === "confirmed" && pointerType === "touch" ? 50 : 0;
  mouseX = e.clientX;
  mouseY = e.clientY - dragOffset;
  pointerType = e.pointerType;
};

// Clickable tracking (for future use)
let _clickables: {
  xywh: XYWH;
  callback: () => void;
}[] = [];

const hoveredClickable = () => {
  return _clickables.find(({ xywh }) => inXYWH(mouseX, mouseY, xywh));
};

// Keyboard event listeners
window.addEventListener("keydown", (e) => {
  if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    showClickablesDebug = !showClickablesDebug;
  }
});

// Pointer event listeners
c.addEventListener("pointermove", (e) => {
  updateMouse(e);

  if (ix.type === "unconfirmed") {
    if (distance(ix.startPos, [e.clientX, e.clientY]) > 4) {
      if (ix.callback) {
        ix.callback();
        ix = { type: "confirmed", isPan: false, pointerType };
      } else {
        ix = { type: "confirmed", isPan: true, pointerType };
      }
    }
  }

  if (ix.type === "confirmed" && ix.isPan) {
    pan = add(pan, [e.movementX, e.movementY]);
  }
});

c.addEventListener("pointerdown", (e) => {
  updateMouse(e);

  const callback = hoveredClickable()?.callback;
  ix = { type: "unconfirmed", startPos: [mouseX, mouseY], callback };
});

c.addEventListener("pointerup", (e) => {
  updateMouse(e);

  if (ix.type === "unconfirmed") {
    // a click!
    if (ix.callback) {
      ix.callback();
    }
  } else if (ix.type === "confirmed") {
    if (!ix.isPan) {
      // a drag!
      const callback = hoveredClickable()?.callback;
      if (callback) {
        callback();
      }
    }
    // end of a pan or drag; it's all good
  }
  ix = { type: "not-dragging" };
});

// Helper to add clickable region
const addClickHandler = (xywh: XYWH, callback: () => void) => {
  _clickables.push({ xywh, callback });
};

const BG_NODE_PADDING = 5;
const BG_NODE_GAP = 20;
const FG_NODE_SIZE = 20;
const FG_NODE_GAP = 10;

function drawBgSubtree(
  /** Top-left position for subtree */
  pos: Vec2,
  bgLyr: Layer,
  fgLyr: Layer,
  /** The background (codomain) node to draw */
  bgNode: TreeNode,
  /** All foreground (domain) nodes that are still looking for a
   * home, here or elsewhere */
  fgNodes: TreeNode[],
  morph: TreeMorph,
  /** An immutable record of where foreground nodes have been
   * positioned in ancestor background nodes */
  fgNodeCentersAbove: Record<string, Vec2>,
  /** The center of this background node's parent */
  parentBgNodeCenter?: Vec2,
): {
  maxX: number;
  maxY: number;
} {
  let [fgNodesHere, fgNodesBelow] = _.partition(
    fgNodes,
    (n) => morph[n.id] === bgNode.id,
  );

  const bgNodeR = drawBgNodeWithDomainStuffInside(
    pos,
    bgLyr,
    fgLyr,
    morph,
    bgNode,
    fgNodesHere,
    fgNodeCentersAbove,
  );

  fgNodesBelow.push(...bgNodeR.fgNodesBelow);

  // console.log(
  //   "Drawing background node",
  //   bgNode.id,
  //   "with",
  //   fgNodesHere.length,
  //   "foreground nodes here and",
  //   fgNodesBelow.length,
  //   "below",
  // );

  const thisBgNodeCenter: Vec2 = [
    (pos[0] + bgNodeR.maxX) / 2,
    (pos[1] + bgNodeR.maxY) / 2,
  ];

  // draw line from parent bg node to this bg node
  if (parentBgNodeCenter) {
    bgLyr.do(() => {
      bgLyr.strokeStyle = "lightgray";
      bgLyr.lineWidth = 4;
      bgLyr.beginPath();
      bgLyr.moveTo(parentBgNodeCenter[0], parentBgNodeCenter[1]);
      bgLyr.lineTo(thisBgNodeCenter[0], thisBgNodeCenter[1]);
      bgLyr.stroke();
    });
  }

  let x = pos[0];
  let y = bgNodeR.maxY + BG_NODE_GAP;
  let maxX = bgNodeR.maxX;
  let maxY = bgNodeR.maxY;

  for (const child of bgNode.children) {
    const childR = drawBgSubtree(
      [x, y],
      bgLyr,
      fgLyr,
      child,
      fgNodesBelow,
      morph,
      bgNodeR.fgNodeCentersAbove,
      thisBgNodeCenter,
    );

    x = childR.maxX + BG_NODE_GAP;
    maxX = Math.max(maxX, childR.maxX);
    maxY = Math.max(maxY, childR.maxY);
  }

  return { maxX, maxY };
}

/** Draw a background node with all relevant foreground nodes inside
 * – might be multiple subtrees */
function drawBgNodeWithDomainStuffInside(
  pos: Vec2,
  bgLyr: Layer,
  fgLyr: Layer,
  morph: TreeMorph,
  bgNode: TreeNode,
  /** The caller has already figured out which foreground nodes
   * should be drawn as roots here */
  fgNodesHere: TreeNode[],
  /** An immutable record of where foreground nodes have been
   * positioned in ancestor background nodes */
  fgNodeCentersAbove: Record<string, Vec2>,
): {
  maxX: number;
  maxY: number;
  /** An updated version of the fgNodeCentersAbove argument, now
   * including all the foreground nodes drawn by this function */
  fgNodeCentersAbove: Record<string, Vec2>;
  /** A list of foreground nodes that are descendents of nodes drawn
   * here, but which belong in lower-down background nodes */
  fgNodesBelow: TreeNode[];
} {
  let x = pos[0] + BG_NODE_PADDING;
  let y = pos[1] + BG_NODE_PADDING;

  let maxX = x + 10;
  let maxY = y + 10;

  const newFgNodeCentersAbove = { ...fgNodeCentersAbove };
  const fgNodesBelow: TreeNode[] = [];

  for (const fgNode of fgNodesHere) {
    const r = drawFgSubtreeInBgNode(
      fgLyr,
      fgNode,
      bgNode.id,
      morph,
      v(x, y),
      fgNodeCentersAbove,
    );

    x = Math.max(x, r.maxX + FG_NODE_GAP);
    maxX = Math.max(maxX, r.maxX);
    maxY = Math.max(maxY, r.maxY);

    Object.assign(newFgNodeCentersAbove, r.newFgNodeCentersAbove);
    fgNodesBelow.push(...r.fgNodesBelow);
  }

  maxX += BG_NODE_PADDING;
  maxY += BG_NODE_PADDING;

  // draw rect background
  bgLyr.do(() => {
    bgLyr.fillStyle = "lightgray";
    bgLyr.rect(pos[0], pos[1], maxX - pos[0], maxY - pos[1]);
    bgLyr.fill();
  });

  return {
    maxX,
    maxY,
    fgNodeCentersAbove: newFgNodeCentersAbove,
    fgNodesBelow,
  };
}

function drawFgSubtreeInBgNode(
  fgLyr: Layer,
  fgNode: TreeNode,
  bgNodeId: string,
  morph: TreeMorph,
  pos: Vec2,
  fgNodeCentersAbove: Record<string, Vec2>,
): {
  newFgNodeCentersAbove: Record<string, Vec2>;
  fgNodesBelow: TreeNode[];
  maxX: number;
  maxY: number;
} {
  // console.log("drawing domain node", fgNode.id, "at", pos);
  const newFgNodeCentersAbove = { ...fgNodeCentersAbove };
  const fgNodesBelow: TreeNode[] = [];

  const nodeCenter = add(pos, v(FG_NODE_SIZE / 2));
  fgLyr.fillStyle = "black";
  fgLyr.beginPath();
  fgLyr.arc(nodeCenter[0], nodeCenter[1], FG_NODE_SIZE / 2, 0, Math.PI * 2);
  fgLyr.fill();
  newFgNodeCentersAbove[fgNode.id] = nodeCenter;

  if (fgNode.parentId) {
    const parentNodeCenter = newFgNodeCentersAbove[fgNode.parentId];
    if (!parentNodeCenter) {
      throw new Error(
        `No center recorded for parent node ${fgNode.parentId} of node ${fgNode.id}`,
      );
    }
    fgLyr.do(() => {
      fgLyr.strokeStyle = "black";
      fgLyr.lineWidth = 2;
      fgLyr.beginPath();
      fgLyr.moveTo(parentNodeCenter[0], parentNodeCenter[1]);
      fgLyr.lineTo(nodeCenter[0], nodeCenter[1]);
      fgLyr.stroke();
    });
  }

  let x = pos[0];
  let y = pos[1] + FG_NODE_SIZE + FG_NODE_GAP;
  let maxX = x + FG_NODE_SIZE;
  let maxY = pos[1] + FG_NODE_SIZE;

  for (const child of fgNode.children) {
    if (morph[child.id] === bgNodeId) {
      const r = drawFgSubtreeInBgNode(
        fgLyr,
        child,
        bgNodeId,
        morph,
        v(x, y),
        newFgNodeCentersAbove,
      );
      Object.assign(newFgNodeCentersAbove, r.newFgNodeCentersAbove);
      fgNodesBelow.push(...r.fgNodesBelow);
      x = r.maxX + FG_NODE_GAP;
      maxX = Math.max(maxX, r.maxX);
      maxY = Math.max(maxY, r.maxY);
    } else {
      fgNodesBelow.push(child);
    }
  }

  return {
    newFgNodeCentersAbove,
    fgNodesBelow,
    maxX,
    maxY,
  };
}

// Drawing function
function draw() {
  // Reset clickables at the start of each frame
  _clickables = [];

  // Create main layer
  const lyr = layer(ctx);

  // Clear canvas with white background
  lyr.fillStyle = "white";
  lyr.fillRect(0, 0, c.width, c.height);

  let curX = pan[0] + 20;
  let curY = pan[1] + 20;

  const bgLyr = layer(ctx);
  lyr.place(bgLyr);
  const fgLyr = layer(ctx);
  lyr.place(fgLyr);

  for (const morph of testMorphs) {
    const result = drawBgSubtree(
      [curX, curY],
      bgLyr,
      fgLyr,
      codomainTree,
      [domainTree],
      morph,
      {},
    );
    curY = result.maxY + BG_NODE_GAP;
  }

  // Clickables debug
  if (showClickablesDebug) {
    lyr.save();
    lyr.strokeStyle = "rgba(255, 0, 255, 1)";
    lyr.lineWidth = 4;
    for (const clickable of _clickables) {
      lyr.strokeRect(...clickable.xywh);
    }
    lyr.restore();
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
