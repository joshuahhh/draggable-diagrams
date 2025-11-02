import { add, distance, type Vec2 } from "./vec2";
import { layer, type Layer } from "./layer";
import { type XYWH, inXYWH, tm, bm, mm } from "./util";

// Canvas setup
const c = document.getElementById("c") as HTMLCanvasElement;
const cContainer = document.getElementById("c-container") as HTMLDivElement;
const ctx = c.getContext("2d")!;

// Pan state
let pan: Vec2 = [0, 0];

// Text color state
let textColor = "black";

// Debug state
let showClickablesDebug = false;

// Tree data structure
type TreeNode = {
  id: string;
  children: TreeNode[];
};

// Domain tree (parent with two children)
const domainTree: TreeNode = {
  id: "d0",
  children: [
    { id: "d1", children: [] },
    { id: "d2", children: [] },
  ],
};

// Codomain tree (3 layers)
const codomainTree: TreeNode = {
  id: "root",
  children: [
    {
      id: "a",
      children: [
        { id: "a1", children: [] },
        { id: "a2", children: [] },
      ],
    },
    {
      id: "b",
      children: [
        { id: "b1", children: [] },
        { id: "b2", children: [] },
        { id: "b3", children: [] },
      ],
    },
    {
      id: "c",
      children: [{ id: "c1", children: [] }],
    },
  ],
};

// Test case 1: Domain spread across multiple codomain nodes
const testMap1: Record<string, string> = {
  d0: "root",
  d1: "a",
  d2: "b",
};

// Test case 2: Entire domain maps to one codomain node
const testMap2: Record<string, string> = {
  d0: "root",
  d1: "root",
  d2: "root",
};

// Test case 3: Domain spanning parent and leaf
const testMap3: Record<string, string> = {
  d0: "root",
  d1: "a1",
  d2: "a1",
};

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

// Tree layout constants
const NODE_RADIUS = 30;
const VERTICAL_GAP = 80;
const HORIZONTAL_GAP = 20;
const BACKGROUND_EDGE_WIDTH = 15;

// Foreground (mapped) tree constants
const MAPPED_NODE_RADIUS = 15;
const MAPPED_EDGE_WIDTH = 5;

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

// Helper: get all domain nodes that map to a specific codomain node
function getDomainNodesAtCodomainNode(
  domainTree: TreeNode,
  map: Record<string, string>,
  codomainNodeId: string
): TreeNode[] {
  const result: TreeNode[] = [];

  function traverse(node: TreeNode) {
    if (map[node.id] === codomainNodeId) {
      result.push(node);
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(domainTree);
  return result;
}

// Helper: get domain subtree rooted at a node, but only including nodes that map to target codomain node
function getDomainSubtreeAtCodomainNode(
  domainNode: TreeNode,
  map: Record<string, string>,
  codomainNodeId: string
): TreeNode {
  // Filter children to only those that also map to this codomain node
  const filteredChildren = domainNode.children
    .filter((child) => map[child.id] === codomainNodeId)
    .map((child) => getDomainSubtreeAtCodomainNode(child, map, codomainNodeId));

  return {
    id: domainNode.id,
    children: filteredChildren,
  };
}

// Compute custom node sizes for codomain based on mapped domain content
function computeCodomainNodeSizes(
  codomainTree: TreeNode,
  domainTree: TreeNode,
  map: Record<string, string>
): Map<string, number> {
  const nodeSizes = new Map<string, number>();

  function traverse(node: TreeNode) {
    // Get all domain nodes that map to this codomain node
    const domainNodesHere = getDomainNodesAtCodomainNode(domainTree, map, node.id);

    // For each domain node, get its filtered subtree and measure it
    let maxRadius = NODE_RADIUS; // Default size
    for (const domainNode of domainNodesHere) {
      const filteredSubtree = getDomainSubtreeAtCodomainNode(
        domainNode,
        map,
        node.id
      );
      // Measure with small node radius for domain nodes
      const bbox = measureDomainSubtree(filteredSubtree);
      // We want the codomain node to contain this domain subtree
      // So its radius should be at least half the diagonal of the bounding box
      const diagonal = Math.sqrt(bbox[2] ** 2 + bbox[3] ** 2);
      const requiredRadius = diagonal / 2 + 10; // Add some padding
      maxRadius = Math.max(maxRadius, requiredRadius);
    }

    nodeSizes.set(node.id, maxRadius);

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(codomainTree);
  return nodeSizes;
}

// Measure domain subtree with small nodes
function measureDomainSubtree(node: TreeNode): XYWH {
  const nodeSize = MAPPED_NODE_RADIUS * 2;

  if (node.children.length === 0) {
    return [0, 0, nodeSize, nodeSize];
  }

  const childBoxes = node.children.map((child) => measureDomainSubtree(child));

  const childrenWidth =
    childBoxes.reduce((sum, box) => sum + box[2], 0) +
    HORIZONTAL_GAP * 0.5 * (node.children.length - 1); // Smaller gaps for domain

  const width = Math.max(nodeSize, childrenWidth);

  const maxChildHeight = Math.max(...childBoxes.map((box) => box[3]));
  const height = nodeSize + VERTICAL_GAP * 0.5 + maxChildHeight; // Smaller vertical gap

  return [0, 0, width, height];
}

// Draw subtree and return bounding box
// Pass null for lyr to only measure without drawing
// nodeSizes: optional map of custom node sizes (radius) by node id
function drawSubtree(
  lyr: Layer | null,
  node: TreeNode,
  pos: Vec2,
  nodeSizes?: Map<string, number>
): XYWH {
  const nodeRadius = nodeSizes?.get(node.id) ?? NODE_RADIUS;
  const nodeSize = nodeRadius * 2;

  if (node.children.length === 0) {
    // Leaf node: just the node itself
    if (lyr) {
      const nodeCenter: Vec2 = [pos[0] + nodeRadius, pos[1] + nodeRadius];
      lyr.fillStyle = "lightgrey";
      lyr.beginPath();
      lyr.arc(nodeCenter[0], nodeCenter[1], nodeRadius, 0, Math.PI * 2);
      lyr.fill();
    }
    return [pos[0], pos[1], nodeSize, nodeSize];
  }

  // Recursively get child bounding boxes (measurement pass)
  const childBoxes = node.children.map((child) =>
    drawSubtree(null, child, [0, 0], nodeSizes)
  );

  // Calculate total width needed for children
  const childrenWidth =
    childBoxes.reduce((sum, box) => sum + box[2], 0) +
    HORIZONTAL_GAP * (node.children.length - 1);

  // Width is max of node width and children width
  const width = Math.max(nodeSize, childrenWidth);

  // Height is node + gap + max child height
  const maxChildHeight = Math.max(...childBoxes.map((box) => box[3]));
  const height = nodeSize + VERTICAL_GAP + maxChildHeight;

  if (lyr) {
    // Calculate node center (center of bounding box)
    const nodeCenter: Vec2 = [pos[0] + width / 2, pos[1] + nodeRadius];

    // Calculate starting X for children (centered below parent)
    let childX = pos[0] + (width - childrenWidth) / 2;
    const childY = pos[1] + nodeRadius * 2 + VERTICAL_GAP;

    // Draw edges to children first (so they appear behind nodes)
    for (let i = 0; i < node.children.length; i++) {
      const childBox = childBoxes[i];
      const childRadius = nodeSizes?.get(node.children[i].id) ?? NODE_RADIUS;
      // Child center is in the middle of its bounding box
      const childCenter: Vec2 = [childX + childBox[2] / 2, childY + childRadius];

      // Draw edge
      lyr.strokeStyle = "lightgrey";
      lyr.lineWidth = BACKGROUND_EDGE_WIDTH;
      lyr.beginPath();
      lyr.moveTo(nodeCenter[0], nodeCenter[1]);
      lyr.lineTo(childCenter[0], childCenter[1]);
      lyr.stroke();

      childX += childBox[2] + HORIZONTAL_GAP;
    }

    // Draw node
    lyr.fillStyle = "lightgrey";
    lyr.beginPath();
    lyr.arc(nodeCenter[0], nodeCenter[1], nodeRadius, 0, Math.PI * 2);
    lyr.fill();

    // Draw children
    childX = pos[0] + (width - childrenWidth) / 2;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childBox = childBoxes[i];
      drawSubtree(lyr, child, [childX, childY], nodeSizes);
      childX += childBox[2] + HORIZONTAL_GAP;
    }
  }

  return [pos[0], pos[1], width, height];
};

// Helper to find node center position in a tree
// Returns the center position of a node with given id in the tree drawn at basePos
function getNodeCenter(
  tree: TreeNode,
  nodeId: string,
  basePos: Vec2
): Vec2 | null {
  const bbox = drawSubtree(null, tree, [0, 0]);

  function search(node: TreeNode, pos: Vec2): Vec2 | null {
    const nodeBbox = drawSubtree(null, node, [0, 0]);
    const [_, __, width, height] = nodeBbox;

    if (node.id === nodeId) {
      return [pos[0] + width / 2, pos[1] + NODE_RADIUS];
    }

    if (node.children.length === 0) {
      return null;
    }

    const childBoxes = node.children.map((child) =>
      drawSubtree(null, child, [0, 0])
    );

    const childrenWidth =
      childBoxes.reduce((sum, box) => sum + box[2], 0) +
      HORIZONTAL_GAP * (node.children.length - 1);

    let childX = pos[0] + (width - childrenWidth) / 2;
    const childY = pos[1] + NODE_RADIUS * 2 + VERTICAL_GAP;

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childBox = childBoxes[i];
      const result = search(child, [childX, childY]);
      if (result) return result;
      childX += childBox[2] + HORIZONTAL_GAP;
    }

    return null;
  }

  return search(tree, basePos);
}

// Draw domain subtree with small nodes (for inside codomain nodes)
function drawDomainSubtree(
  lyr: Layer | null,
  node: TreeNode,
  pos: Vec2
): XYWH {
  const nodeSize = MAPPED_NODE_RADIUS * 2;

  if (node.children.length === 0) {
    if (lyr) {
      const nodeCenter: Vec2 = [pos[0] + MAPPED_NODE_RADIUS, pos[1] + MAPPED_NODE_RADIUS];
      lyr.fillStyle = "black";
      lyr.beginPath();
      lyr.arc(nodeCenter[0], nodeCenter[1], MAPPED_NODE_RADIUS, 0, Math.PI * 2);
      lyr.fill();
    }
    return [pos[0], pos[1], nodeSize, nodeSize];
  }

  const childBoxes = node.children.map((child) =>
    drawDomainSubtree(null, child, [0, 0])
  );

  const horizontalGap = HORIZONTAL_GAP * 0.5;
  const verticalGap = VERTICAL_GAP * 0.5;

  const childrenWidth =
    childBoxes.reduce((sum, box) => sum + box[2], 0) +
    horizontalGap * (node.children.length - 1);

  const width = Math.max(nodeSize, childrenWidth);

  const maxChildHeight = Math.max(...childBoxes.map((box) => box[3]));
  const height = nodeSize + verticalGap + maxChildHeight;

  if (lyr) {
    const nodeCenter: Vec2 = [pos[0] + width / 2, pos[1] + MAPPED_NODE_RADIUS];

    let childX = pos[0] + (width - childrenWidth) / 2;
    const childY = pos[1] + MAPPED_NODE_RADIUS * 2 + verticalGap;

    // Draw edges first
    for (let i = 0; i < node.children.length; i++) {
      const childBox = childBoxes[i];
      const childCenter: Vec2 = [childX + childBox[2] / 2, childY + MAPPED_NODE_RADIUS];

      lyr.strokeStyle = "black";
      lyr.lineWidth = MAPPED_EDGE_WIDTH;
      lyr.beginPath();
      lyr.moveTo(nodeCenter[0], nodeCenter[1]);
      lyr.lineTo(childCenter[0], childCenter[1]);
      lyr.stroke();

      childX += childBox[2] + horizontalGap;
    }

    // Draw node
    lyr.fillStyle = "black";
    lyr.beginPath();
    lyr.arc(nodeCenter[0], nodeCenter[1], MAPPED_NODE_RADIUS, 0, Math.PI * 2);
    lyr.fill();

    // Draw children
    childX = pos[0] + (width - childrenWidth) / 2;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childBox = childBoxes[i];
      drawDomainSubtree(lyr, child, [childX, childY]);
      childX += childBox[2] + horizontalGap;
    }
  }

  return [pos[0], pos[1], width, height];
}

// Draw domain nodes inside their corresponding codomain nodes
function drawDomainInCodomain(
  lyr: Layer,
  codomainTree: TreeNode,
  codomainPos: Vec2,
  domainTree: TreeNode,
  map: Record<string, string>,
  nodeSizes: Map<string, number>
) {
  function traverseCodomain(codomainNode: TreeNode, pos: Vec2) {
    const codomainBbox = drawSubtree(null, codomainNode, [0, 0], nodeSizes);
    const [_, __, width, height] = codomainBbox;
    const nodeRadius = nodeSizes.get(codomainNode.id) ?? NODE_RADIUS;
    const nodeCenter: Vec2 = [pos[0] + width / 2, pos[1] + nodeRadius];

    // Find all domain nodes that map to this codomain node
    const domainNodesHere = getDomainNodesAtCodomainNode(
      domainTree,
      map,
      codomainNode.id
    );

    // Draw each domain subtree inside this codomain node
    for (const domainNode of domainNodesHere) {
      const filteredSubtree = getDomainSubtreeAtCodomainNode(
        domainNode,
        map,
        codomainNode.id
      );
      const domainBbox = measureDomainSubtree(filteredSubtree);
      // Center the domain subtree inside the codomain node
      const domainPos: Vec2 = [
        nodeCenter[0] - domainBbox[2] / 2,
        nodeCenter[1] - domainBbox[3] / 2,
      ];
      drawDomainSubtree(lyr, filteredSubtree, domainPos);
    }

    // Recurse to children
    if (codomainNode.children.length > 0) {
      const childBoxes = codomainNode.children.map((child) =>
        drawSubtree(null, child, [0, 0], nodeSizes)
      );

      const childrenWidth =
        childBoxes.reduce((sum, box) => sum + box[2], 0) +
        HORIZONTAL_GAP * (codomainNode.children.length - 1);

      let childX = pos[0] + (width - childrenWidth) / 2;
      const childY = pos[1] + nodeRadius * 2 + VERTICAL_GAP;

      for (let i = 0; i < codomainNode.children.length; i++) {
        const child = codomainNode.children[i];
        const childBox = childBoxes[i];
        traverseCodomain(child, [childX, childY]);
        childX += childBox[2] + HORIZONTAL_GAP;
      }
    }
  }

  traverseCodomain(codomainTree, codomainPos);
}

// Draw text at a specific position
function drawText(lyr: Layer, pos: Vec2) {
  lyr.fillStyle = textColor;
  lyr.font = "32px sans-serif";
  lyr.textAlign = "center";
  lyr.textBaseline = "middle";
  const text = "Hello, mathematical structures!";
  const textX = pos[0];
  const textY = pos[1];
  lyr.fillText(text, textX, textY);

  // Measure text and register clickable area
  // We need to use the real context for measureText since Layer doesn't support it
  ctx.font = "32px sans-serif";
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 32; // approximate height from font size
  addClickHandler(
    [
      textX - textWidth / 2,
      textY - textHeight / 2,
      textWidth,
      textHeight,
    ],
    () => {
      textColor = textColor === "black" ? "grey" : "black";
    }
  );
}

// Draw a single map visualization
function drawMapVisualization(
  lyr: Layer | null,
  pos: Vec2,
  map: Record<string, string>
): XYWH {
  // Compute custom node sizes based on mapped domain content
  const nodeSizes = computeCodomainNodeSizes(codomainTree, domainTree, map);

  if (lyr) {
    // Draw codomain tree (background) with custom sizes
    drawSubtree(lyr, codomainTree, pos, nodeSizes);

    // Draw domain nodes inside codomain nodes
    drawDomainInCodomain(lyr, codomainTree, pos, domainTree, map, nodeSizes);
  }

  // Return bounding box
  return drawSubtree(null, codomainTree, [0, 0], nodeSizes);
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

  // Get bounding boxes (without drawing)
  const bbox1 = drawMapVisualization(null, [0, 0], testMap1);
  const bbox2 = drawMapVisualization(null, [0, 0], testMap2);
  const bbox3 = drawMapVisualization(null, [0, 0], testMap3);

  // Layout three test cases horizontally
  const spacing = 50;
  const totalWidth = bbox1[2] + bbox2[2] + bbox3[2] + spacing * 2;
  const startX = c.width / 2 - totalWidth / 2;
  const startY = 100;

  // Draw all three
  let currentX = startX;
  drawMapVisualization(lyr, add(pan, [currentX, startY]), testMap1);
  currentX += bbox1[2] + spacing;
  drawMapVisualization(lyr, add(pan, [currentX, startY]), testMap2);
  currentX += bbox2[2] + spacing;
  drawMapVisualization(lyr, add(pan, [currentX, startY]), testMap3);

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
drawLoop();
