import { layer } from "./layer";
import { ManipulableDrawer } from "./manipulable";
import { manipulableGridPoly } from "./manipulable-grid-poly";
import { manipulableInsertAndRemove } from "./manipulable-insert-and-remove";
import { manipulableOrderPreserving } from "./manipulable-order-preserving";
import { manipulablePerm } from "./manipulable-perm";
import { manipulablePermDouble } from "./manipulable-perm-double";
import { manipulableRushHour } from "./manipulable-rush-hour";
import { manipulableTiles } from "./manipulable-tiles";
import { PointerManager, pointerManagerWithOffset } from "./pointer";
import { buildHasseDiagram, tree4, tree7 } from "./trees";
import { Vec2 } from "./vec2";

// Helper to create a demo canvas
function createDemoCanvas(
  title: string,
  height: number = 400,
): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  container: HTMLDivElement;
} {
  const container = document.getElementById("demos-container")!;

  const demoItem = document.createElement("div");
  demoItem.className = "demo-item";

  const heading = document.createElement("h2");
  heading.textContent = title;
  demoItem.appendChild(heading);

  const canvas = document.createElement("canvas");
  canvas.className = "demo-canvas";
  canvas.style.height = `${height}px`;
  demoItem.appendChild(canvas);

  container.appendChild(demoItem);

  const ctx = canvas.getContext("2d")!;

  // Setup canvas with devicePixelRatio
  const setupCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
  };

  setupCanvas();

  // Re-setup on resize
  const resizeObserver = new ResizeObserver(() => {
    setupCanvas();
  });
  resizeObserver.observe(canvas);

  return { canvas, ctx, container: demoItem };
}

const domainTree = tree4;
const codomainTree = tree4;

const hasseDiagram = buildHasseDiagram(domainTree, codomainTree);
console.log("Hasse diagram contains:", hasseDiagram.nodes.length);

// Debug controls
const inputDebugView = document.getElementById(
  "debug-view",
) as HTMLInputElement;
const inputSnapRadius = document.getElementById(
  "snap-radius",
) as HTMLInputElement;

// Helper to draw a demo
function createDemo(
  title: string,
  drawer: ManipulableDrawer<any>,
  config: {
    height: number;
    padding?: number;
  },
) {
  const height = config.height;
  const padding = config.padding ?? 0;

  const { canvas, ctx } = createDemoCanvas(title, height + padding * 2);
  const pointer = new PointerManager(canvas);

  function draw() {
    pointer.prepareForDraw();
    canvas.style.cursor = "default";

    const lyr = layer(ctx);

    // Clear with white background
    lyr.fillStyle = "white";
    const rect = canvas.getBoundingClientRect();
    lyr.fillRect(0, 0, rect.width, rect.height);

    // Update debug settings
    drawer.config.debugView = inputDebugView.checked;
    drawer.config.snapRadius = Number(inputSnapRadius.value);

    // Draw the demo with padding (offset both layer and pointer)
    const paddingVec = Vec2(padding, padding);
    const lyrOffset = layer(ctx);
    lyr.place(lyrOffset, paddingVec);
    drawer.draw(lyrOffset, pointerManagerWithOffset(pointer, paddingVec));

    lyr.draw();
  }

  function drawLoop() {
    requestAnimationFrame(drawLoop);
    draw();
  }

  drawLoop();
}

createDemo(
  "Rush Hour",
  new ManipulableDrawer(manipulableRushHour, {
    w: 6,
    h: 6,
    tiles: {
      A: { x: 0, y: 0, w: 2, h: 1, dir: "h", color: "lightgreen" },
      B: { x: 0, y: 1, w: 1, h: 3, dir: "v", color: "purple" },
      C: { x: 1, y: 2, w: 2, h: 1, dir: "h", color: "red" },
      D: { x: 0, y: 4, w: 1, h: 2, dir: "v", color: "orange" },
      E: { x: 3, y: 1, w: 1, h: 3, dir: "v", color: "blue" },
      F: { x: 5, y: 0, w: 1, h: 3, dir: "v", color: "yellow" },
      G: { x: 4, y: 4, w: 2, h: 1, dir: "h", color: "lightblue" },
      H: { x: 2, y: 5, w: 3, h: 1, dir: "h", color: "green" },
    },
  }),
  { height: 300, padding: 20 },
);

createDemo(
  "15 puzzle",
  new ManipulableDrawer(manipulableTiles, {
    w: 4,
    h: 4,
    tiles: {
      "12": { x: 0, y: 0 },
      "1": { x: 1, y: 0 },
      "2": { x: 2, y: 0 },
      "15": { x: 3, y: 0 },
      "11": { x: 0, y: 1 },
      "6": { x: 1, y: 1 },
      "5": { x: 2, y: 1 },
      "8": { x: 3, y: 1 },
      "7": { x: 0, y: 2 },
      "10": { x: 1, y: 2 },
      "9": { x: 2, y: 2 },
      "4": { x: 3, y: 2 },
      "13": { x: 1, y: 3 },
      "14": { x: 2, y: 3 },
      "3": { x: 3, y: 3 },
    },
  }),
  { height: 200, padding: 20 },
);

createDemo(
  "Order preserving map",
  new ManipulableDrawer(manipulableOrderPreserving, {
    domainTree,
    codomainTree,
    hasseDiagram,
    curMorphIdx: 0,
  }),
  { height: 400, padding: 20 },
);

createDemo(
  "Order preserving map (big)",
  new ManipulableDrawer(manipulableOrderPreserving, {
    domainTree: tree7,
    codomainTree: tree7,
    hasseDiagram: buildHasseDiagram(tree7, tree7),
    curMorphIdx: 0,
  }),
  { height: 500, padding: 20 },
);

createDemo(
  "Grid polygon",
  new ManipulableDrawer(manipulableGridPoly, {
    w: 6,
    h: 6,
    points: [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ],
  }),
  { height: 250, padding: 20 },
);

createDemo(
  "Permutation",
  new ManipulableDrawer(manipulablePerm, {
    perm: ["A", "B", "C", "D", "E"],
  }),
  { height: 50, padding: 10 },
);

createDemo(
  "Permutation of permutations",
  new ManipulableDrawer(manipulablePermDouble, {
    rows: [
      ["A1", "B1", "C1"],
      ["A2", "B2", "C2"],
      ["A3", "B3", "C3"],
    ],
  }),
  { height: 200 },
);

createDemo(
  "Inserting & removing items (wip)",
  new ManipulableDrawer(manipulableInsertAndRemove, {
    store: [
      { key: "D", label: "🍎" },
      { key: "E", label: "🍌" },
      { key: "F", label: "🍇" },
    ],
    items: [
      { key: "A", label: "🍎" },
      { key: "B", label: "🍎" },
      { key: "C", label: "🍌" },
    ],
  }),
  { height: 150, padding: 10 },
);
