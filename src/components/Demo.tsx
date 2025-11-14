import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDemoContext } from "../DemoContext";
import { layer } from "../layer";
import { ManipulableDrawer } from "../manipulable";
import { PointerManager, pointerManagerWithOffset } from "../pointer";
import { Vec2 } from "../vec2";
import { Canvas } from "./Canvas";

interface DemoProps {
  id: string;
  title: string;
  drawer: ManipulableDrawer<any>;
  height: number;
  padding?: number;
  initialSnapRadius?: number;
}

export function Demo({
  id,
  title,
  drawer,
  height,
  padding = 0,
  initialSnapRadius = 10,
}: DemoProps) {
  const { debugView } = useDemoContext();
  const [snapRadius, setSnapRadius] = useState(initialSnapRadius);
  const pointerRef = useRef<PointerManager | null>(null);

  // Handle manipulable-specific config
  const manipulable = drawer.manipulable as any;
  const [manipulableConfig, setManipulableConfig] = useState(
    manipulable.defaultConfig || {},
  );

  // Update manipulable config when it changes
  if (manipulable.config) {
    manipulable.config = manipulableConfig;
  }

  // Memoize the draw callback to prevent unnecessary re-renders
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      // Initialize pointer manager on first draw
      if (!pointerRef.current) {
        pointerRef.current = new PointerManager(canvas);
      }

      const pointer = pointerRef.current;
      pointer.prepareForDraw();
      canvas.style.cursor = "default";

      const lyr = layer(ctx);

      // Clear with white background
      lyr.fillStyle = "white";
      const rect = canvas.getBoundingClientRect();
      lyr.fillRect(0, 0, rect.width, rect.height);

      // Update debug settings
      drawer.config.debugView = debugView;
      drawer.config.snapRadius = snapRadius;

      // Draw the demo with padding (offset both layer and pointer)
      const paddingVec = Vec2(padding, padding);
      const lyrOffset = layer(ctx);
      lyr.place(lyrOffset, paddingVec);
      drawer.draw(lyrOffset, pointerManagerWithOffset(pointer, paddingVec));

      lyr.draw();
    },
    [drawer, padding, debugView, snapRadius, manipulableConfig],
  );

  return (
    <div className="bg-white rounded-lg p-5 shadow-sm" id={id}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 m-0">
          <Link
            to={`/${id}`}
            className="no-underline text-gray-900 hover:text-gray-700 transition-colors"
          >
            {title}
          </Link>
        </h2>
        {drawer.manipulable.sourceFile && (
          <a
            href={`https://github.com/joshuahhh/draggable-diagrams/blob/main/src/${drawer.manipulable.sourceFile}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700 no-underline"
          >
            source
          </a>
        )}
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Canvas height={height + padding * 2} draw={draw} />
        </div>
        <div
          className={`${manipulable.renderConfig ? "w-64 md:w-52" : "w-48 md:w-32"} bg-gray-50 rounded p-3 flex flex-col gap-2`}
        >
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-gray-700">Snap Radius</span>
            <input
              type="range"
              min="0"
              max="20"
              value={snapRadius}
              onChange={(e) => setSnapRadius(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-gray-500 text-center">
              {snapRadius} pixels
            </span>
          </label>
          {manipulable.renderConfig && (
            <>
              <div className="border-t border-gray-300 my-1" />
              {manipulable.renderConfig(
                manipulableConfig,
                setManipulableConfig,
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
