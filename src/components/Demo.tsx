import { ReactNode, useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ConfigCheckbox } from "../config-controls";
import { useDemoContext } from "../DemoContext";
import { layer } from "../layer";
import {
  hasConfig,
  manipulableDefaultConfig,
  ManipulableDrawer,
} from "../manipulable";
import { PointerManager, pointerManagerWithOffset } from "../pointer";
import { Vec2 } from "../vec2";
import { Canvas } from "./Canvas";

interface DemoProps {
  id: string;
  title: string;
  notes?: ReactNode;
  drawer: ManipulableDrawer<any, any>;
  height: number;
  padding?: number;
  initialSnapRadius?: number;
  initialTransitionWhileDragging?: boolean;
  initialRelativePointerMotion?: boolean;
}

export function Demo({
  id,
  title,
  notes,
  drawer,
  height,
  padding = 0,
  initialSnapRadius = 10,
  initialTransitionWhileDragging = true,
  initialRelativePointerMotion = false,
}: DemoProps) {
  const { debugView } = useDemoContext();
  const [snapRadius, setSnapRadius] = useState(initialSnapRadius);
  const [transitionWhileDragging, setTransitionWhileDragging] = useState(
    initialTransitionWhileDragging,
  );
  const [relativePointerMotion, setRelativePointerMotion] = useState(
    initialRelativePointerMotion,
  );
  const [manipulableConfig, setManipulableConfig] = useState(
    manipulableDefaultConfig(drawer.manipulable),
  );
  const pointerRef = useRef<PointerManager | null>(null);

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

      // Draw the demo with padding (offset both layer and pointer)
      const paddingVec = Vec2(padding, padding);
      const lyrOffset = layer(ctx);
      lyr.place(lyrOffset, paddingVec);
      drawer.draw(
        lyrOffset,
        pointerManagerWithOffset(pointer, paddingVec),
        {
          debugView,
          snapRadius,
          transitionWhileDragging,
          relativePointerMotion,
          animationDuration: 300,
        },
        manipulableConfig,
      );

      lyr.draw();
    },
    [
      drawer,
      padding,
      debugView,
      snapRadius,
      transitionWhileDragging,
      relativePointerMotion,
      manipulableConfig,
    ],
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
      {notes && <div className="mt-2 text-sm text-gray-600">{notes}</div>}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Canvas height={height + padding * 2} draw={draw} />
        </div>
        <div
          className={`${hasConfig(drawer.manipulable) ? "w-64 md:w-52" : "w-48 md:w-32"} bg-gray-50 rounded p-3 flex flex-col gap-2`}
        >
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-gray-700">Snap radius</span>
            <input
              type="range"
              min="0"
              max="50"
              value={snapRadius}
              onChange={(e) => setSnapRadius(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-gray-500 text-center">
              {snapRadius} pixels
            </span>
          </label>
          <ConfigCheckbox
            label="Chain drags automatically"
            value={transitionWhileDragging}
            onChange={setTransitionWhileDragging}
          />
          <ConfigCheckbox
            label="Relative pointer motion"
            value={relativePointerMotion}
            onChange={setRelativePointerMotion}
          />
          {hasConfig(drawer.manipulable) && (
            <>
              <div className="border-t border-gray-300 my-1" />
              {drawer.manipulable.renderConfig(
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
