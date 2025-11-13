import { layer } from "./layer";
import { ManipulableDrawer } from "./manipulable";
import { manipulableGridPoly } from "./manipulable-grid-poly";
import { manipulableInsertAndRemove } from "./manipulable-insert-and-remove";
import { manipulableNoolTree } from "./manipulable-nool-tree";
import { manipulableOrderPreserving } from "./manipulable-order-preserving";
import { manipulablePerm } from "./manipulable-perm";
import { manipulablePermDouble } from "./manipulable-perm-double";
import { manipulableRushHour } from "./manipulable-rush-hour";
import { manipulableSimplest } from "./manipulable-simplest";
import { makeSokobanState, manipulableSokoban } from "./manipulable-sokoban";
import { manipulableTiles } from "./manipulable-tiles";
import { PointerManager, pointerManagerWithOffset } from "./pointer";
import { buildHasseDiagram, tree3, tree7 } from "./trees";
import { Vec2 } from "./vec2";

// Helper to create a demo ID from title
function createDemoId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
  const demoId = createDemoId(title);
  demoItem.id = demoId;

  const heading = document.createElement("h2");
  const link = document.createElement("a");
  link.href = `${window.location.pathname}#${demoId}`;
  link.textContent = title;
  link.style.textDecoration = "none";
  link.style.color = "inherit";
  link.style.cursor = "pointer";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const newUrl = `${window.location.pathname}#${demoId}`;
    window.history.pushState(null, "", newUrl);
    window.location.reload();
  });
  heading.appendChild(link);
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

// Define all demos upfront (without creating them yet)
const allDemos: Array<{
  title: string;
  createDrawer: () => ManipulableDrawer<any>;
  config: { height: number; padding?: number };
}> = [
  {
    title: "Rush Hour",
    createDrawer: () =>
      new ManipulableDrawer(manipulableRushHour, {
        w: 6,
        h: 6,
        cars: {
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
    config: { height: 300, padding: 20 },
  },
  {
    title: "15 puzzle",
    createDrawer: () =>
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
    config: { height: 200, padding: 20 },
  },
  {
    title: "Lonely tile on a grid; goal is for it to only slide orthogonally",
    createDrawer: () =>
      new ManipulableDrawer(manipulableTiles, {
        w: 5,
        h: 5,
        tiles: {
          A: { x: 2, y: 2 },
        },
      }),
    config: { height: 300, padding: 20 },
  },
  {
    title: "Order preserving map",
    createDrawer: () =>
      new ManipulableDrawer(manipulableOrderPreserving, {
        domainTree: tree3,
        codomainTree: tree3,
        hasseDiagram: buildHasseDiagram(tree3, tree3),
        curMorphIdx: 0,
      }),
    config: { height: 260, padding: 20 },
  },
  {
    title: "Order preserving map (big)",
    createDrawer: () =>
      new ManipulableDrawer(manipulableOrderPreserving, {
        domainTree: tree7,
        codomainTree: tree7,
        hasseDiagram: buildHasseDiagram(tree7, tree7),
        curMorphIdx: 0,
      }),
    config: { height: 500, padding: 20 },
  },
  {
    title: "Grid polygon",
    createDrawer: () =>
      new ManipulableDrawer(manipulableGridPoly, {
        w: 6,
        h: 6,
        points: [
          { x: 1, y: 1 },
          { x: 4, y: 2 },
          { x: 3, y: 5 },
          { x: 1, y: 4 },
        ],
      }),
    config: { height: 250, padding: 20 },
  },
  {
    title: "Permutation",
    createDrawer: () =>
      new ManipulableDrawer(manipulablePerm, {
        perm: ["A", "B", "C", "D", "E"],
      }),
    config: { height: 50, padding: 10 },
  },
  {
    title: "Permutation of permutations",
    createDrawer: () =>
      new ManipulableDrawer(manipulablePermDouble, {
        rows: [
          ["A1", "B1", "C1"],
          ["A2", "B2", "C2"],
          ["A3", "B3", "C3"],
        ],
      }),
    config: { height: 200 },
  },
  {
    title: "Inserting & removing items (WIP)",
    createDrawer: () =>
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
    config: { height: 150, padding: 10 },
  },
  {
    title: "Nool tree",
    createDrawer: () =>
      new ManipulableDrawer(manipulableNoolTree, {
        id: "root",
        label: "+",
        children: [
          {
            id: "root/1",
            label: "+",
            children: [
              {
                id: "root/1/1",
                label: "+",
                children: [
                  {
                    id: "root/1/1/1",
                    label: "⛅",
                    children: [],
                  },
                  {
                    id: "root/1/1/2",
                    label: "-",
                    children: [
                      {
                        id: "root/1/1/2/1",
                        label: "🍄",
                        children: [],
                      },
                    ],
                  },
                ],
              },
              {
                id: "root/1/2",
                label: "🍄",
                children: [],
              },
            ],
          },
          {
            id: "root/2",
            label: "+",
            children: [
              {
                id: "root/2/1",
                label: "×",
                children: [
                  {
                    id: "root/2/1/1",
                    label: "🎲",
                    children: [],
                  },
                  {
                    id: "root/2/1/2",
                    label: "🦠",
                    children: [],
                  },
                ],
              },
              {
                id: "root/2/2",
                label: "×",
                children: [
                  {
                    id: "root/2/2/1",
                    label: "🎲",
                    children: [],
                  },
                  {
                    id: "root/2/2/2",
                    label: "🐝",
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      }),
    config: { height: 350, padding: 20 },
  },
  {
    title: "Nool tree, simpler",
    createDrawer: () =>
      new ManipulableDrawer(manipulableNoolTree, {
        id: "+1",
        label: "+",
        children: [
          {
            id: "+2",
            label: "+",
            children: [
              {
                id: "A",
                label: "A",
                children: [],
              },
              {
                id: "B",
                label: "B",
                children: [],
              },
            ],
          },
          {
            id: "+3",
            label: "+",
            children: [
              {
                id: "C",
                label: "C",
                children: [],
              },
              {
                id: "D",
                label: "D",
                children: [],
              },
            ],
          },
          // {
          //   id: "C",
          //   label: "C",
          //   children: [],
          // },
        ],
      }),
    config: { height: 200, padding: 20 },
  },
  {
    title: "Sokoban (WIP)",
    createDrawer: () =>
      new ManipulableDrawer(
        manipulableSokoban,
        makeSokobanState(`  #####
###   #
#gpb  #
### bg#
#g##b #
# # g ##
#b Bbbg#
#   g  #
########`),
      ),
    config: { height: 500, padding: 20 },
  },
  {
    title: "Simplest",
    createDrawer: () => new ManipulableDrawer(manipulableSimplest, true),
    config: { height: 150, padding: 20 },
  },
];

// Determine which demos to create based on the URL hash
const hash = window.location.hash.slice(1);
const demosToCreate = hash
  ? allDemos.filter((demo) => createDemoId(demo.title) === hash)
  : allDemos;

// Only create the demos that should be displayed
demosToCreate.forEach((demo) => {
  createDemo(demo.title, demo.createDrawer(), demo.config);
});

// If viewing a single demo, add a back link
if (hash && demosToCreate.length > 0) {
  const pageHeader = document.getElementById("page-header")!;
  const demosContainer = document.getElementById("demos-container")!;

  const backLink = document.createElement("div");
  backLink.id = "back-link";
  backLink.style.textAlign = "center";
  backLink.style.padding = "10px 20px";
  backLink.style.maxWidth = "1200px";
  backLink.style.margin = "0 auto";

  const link = document.createElement("a");
  link.href = window.location.pathname; // Link back without hash
  link.textContent = "← Back to all demos";
  link.style.textDecoration = "none";
  link.style.color = "#0066cc";
  link.style.fontSize = "14px";
  link.style.cursor = "pointer";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    window.history.pushState(null, "", window.location.pathname);
    window.location.reload();
  });

  backLink.appendChild(link);
  pageHeader.parentNode!.insertBefore(backLink, demosContainer);
}

// Listen for browser back/forward button
window.addEventListener("popstate", () => {
  window.location.reload();
});
