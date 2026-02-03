import { useState } from "react";
import {
  OverlayLegend,
  SpatialOverlaySvg,
  useOverlayData,
} from "./DragSpecSpatialOverlay";
import { DragSpecTreeView } from "./DragSpecTreeView";
import { DebugDragInfo, ManipulableDrawer } from "./ManipulableDrawer2";
import { Manipulable } from "./manipulable2";

export function DebugManipulableDrawer<T extends object>({
  manipulable,
  initialState,
  width,
  height,
  showTree,
  showOverlay,
}: {
  manipulable: Manipulable<T>;
  initialState: T;
  width: number;
  height: number;
  showTree: boolean;
  showOverlay: boolean;
}) {
  const [debugInfo, setDebugInfo] = useState<DebugDragInfo<T>>({
    type: "idle",
  });

  const overlayData = useOverlayData(
    showOverlay && debugInfo.type === "dragging" ? debugInfo.spec : null,
    showOverlay && debugInfo.type === "dragging" ? debugInfo.behaviorCtx : null,
    showOverlay && debugInfo.type === "dragging"
      ? debugInfo.pointerStart
      : null,
    width,
    height
  );

  const dragging = debugInfo.type === "dragging" ? debugInfo : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4 items-start">
        <div className="relative">
          <ManipulableDrawer
            manipulable={manipulable}
            initialState={initialState}
            width={width}
            height={height}
            onDebugDragInfo={setDebugInfo}
          />
          {showOverlay && overlayData && (
            <SpatialOverlaySvg
              data={overlayData}
              width={width}
              height={height}
            />
          )}
        </div>
        {showTree && (
          <div className="w-72 shrink-0">
            {dragging ? (
              <div className="flex flex-col gap-2">
                <div className="text-xs text-slate-500 font-mono">
                  activePath: {dragging.activePath}
                </div>
                <DragSpecTreeView
                  spec={dragging.spec}
                  activePath={dragging.activePath}
                  colorMap={overlayData?.colorMap}
                />
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">
                Drag an element to see its spec tree
              </div>
            )}
          </div>
        )}
      </div>
      {showOverlay && !showTree && overlayData && (
        <OverlayLegend data={overlayData} />
      )}
    </div>
  );
}
