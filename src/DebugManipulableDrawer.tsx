import { useState } from "react";
import { DebugDragInfo, ManipulableDrawer } from "./ManipulableDrawer2";
import { Manipulable } from "./manipulable2";
import { DragSpecTreeView } from "./DragSpecTreeView";

export function DebugManipulableDrawer<T extends object>({
  manipulable,
  initialState,
  width,
  height,
}: {
  manipulable: Manipulable<T>;
  initialState: T;
  width: number;
  height: number;
}) {
  const [debugInfo, setDebugInfo] = useState<DebugDragInfo<T>>({
    type: "idle",
  });

  return (
    <div className="flex gap-4 items-start">
      <div className="relative">
        <ManipulableDrawer
          manipulable={manipulable}
          initialState={initialState}
          width={width}
          height={height}
          onDebugDragInfo={setDebugInfo}
        />
      </div>
      <div className="w-72 shrink-0">
        {debugInfo.type === "dragging" ? (
          <div className="flex flex-col gap-2">
            <div className="text-xs text-slate-500 font-mono">
              activePath: {debugInfo.activePath}
            </div>
            <DragSpecTreeView
              spec={debugInfo.spec}
              activePath={debugInfo.activePath}
            />
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">
            Drag an element to see its spec tree
          </div>
        )}
      </div>
    </div>
  );
}
