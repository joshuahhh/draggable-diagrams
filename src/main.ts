// Canvas setup
const c = document.getElementById("c") as HTMLCanvasElement;
const cContainer = document.getElementById("c-container") as HTMLDivElement;
const ctx = c.getContext("2d")!;

// Drawing function
function draw() {
  // Clear canvas
  ctx.fillStyle = "#1b1b19";
  ctx.fillRect(0, 0, c.width, c.height);

  // Draw some text
  ctx.fillStyle = "white";
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Hello, mathematical structures!", c.width / 2, c.height / 2);
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
