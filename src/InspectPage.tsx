import { Fragment, useEffect, useState } from "react";
import { demos } from "./demos";
import { ErrorBoundary } from "./ErrorBoundary";
import {
  DragState,
  Manifold,
  ManifoldPoint,
  ManipulableDrawer,
} from "./ManipulableDrawer";
import { PrettyPrint } from "./pretty-print";
import { drawHoisted } from "./svgx/hoist";

export function InspectPage({
  id,
  stateIndex,
}: {
  id: string;
  stateIndex: string;
}) {
  const demo = demos.find((d) => d.run((demo) => demo.id === id));
  const [dragState, setDragState] = useState<DragState<unknown> | null>(null);
  const [currentState, setCurrentState] = useState<unknown>(null);
  const [debugMode, setDebugMode] = useState(false);

  // Prevent body scroll on this page
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!dragState) return;

    if (dragState.type === "idle") {
      setCurrentState(dragState.state);
    } else if (dragState.type === "drag-manifolds") {
      setCurrentState(dragState.startingPoint.state);
    } else if (dragState.type === "drag-detach-reattach") {
      setCurrentState(dragState.startingPoint.state);
    }
  }, [dragState]);

  if (!demo) {
    return <div>Demo not found: {id}</div>;
  }

  return demo.run((demo) => {
    const stateIdx = parseInt(stateIndex);
    if (
      isNaN(stateIdx) ||
      stateIdx < 0 ||
      stateIdx >= demo.initialStates.length
    ) {
      return (
        <div>
          Invalid state index: {stateIndex} (demo has{" "}
          {demo.initialStates.length} state(s))
        </div>
      );
    }

    const initialState = demo.initialStates[stateIdx];
    const displayState = currentState ?? initialState;

    return (
      <div className="h-screen bg-gray-50 p-8 flex flex-col overflow-hidden">
        <h1 className="text-2xl font-bold mb-4">
          Inspect: {demo.title} (example state {stateIndex})
        </h1>
        <div className="flex gap-8 flex-1 min-h-0">
          {/* Left side: diagram and state */}
          <div className="w-1/2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500">Cmd-P to pause/resume</div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                />
                Debug Mode
              </label>
            </div>
            <div style={{ padding: demo.padding }}>
              <ErrorBoundary>
                <ManipulableDrawer
                  manipulable={demo.manipulable.withConfig(
                    demo.manipulable.type === "configurable"
                      ? demo.manipulable.defaultConfig
                      : undefined
                  )}
                  initialState={initialState}
                  drawerConfig={demo.initialDrawerConfig}
                  height={demo.height}
                  debugMode={debugMode}
                  onDragStateChange={setDragState}
                />
              </ErrorBoundary>
            </div>
            <div className="mt-4">
              <h2 className="text-lg font-semibold mb-2">State</h2>
              <PrettyPrint value={displayState} />
            </div>
          </div>

          {/* Right side */}
          <div className="w-1/2 flex flex-col min-h-0">
            {dragState &&
              (dragState.type === "drag-manifolds" ? (
                <RHSDragManifoldsMode
                  dragState={dragState}
                  demoHeight={demo.height}
                  demoPadding={demo.padding}
                />
              ) : dragState.type === "drag-detach-reattach" ? (
                <RHSDragDetachReattachMode
                  dragState={dragState}
                  demoHeight={demo.height}
                  demoPadding={demo.padding}
                />
              ) : dragState.type !== "idle" ? (
                <>
                  <h2 className="text-lg font-semibold mb-2">
                    Drag State: {dragState.type}
                  </h2>
                  <div className="overflow-y-auto">
                    <PrettyPrint value={dragState} />
                  </div>
                </>
              ) : null)}
          </div>
        </div>
      </div>
    );
  });
}

function RHSDragManifoldsMode({
  dragState,
  demoHeight,
  demoPadding,
}: {
  dragState: DragState<unknown> & { type: "drag-manifolds" };
  demoHeight: number;
  demoPadding?: number;
}) {
  return (
    <>
      <h2 className="text-lg font-semibold mb-2">
        Manifold Points (
        {dragState.manifolds.reduce(
          (sum: number, m: Manifold<unknown>) => sum + m.points.length,
          0
        )}{" "}
        total)
      </h2>
      <div className="flex flex-col gap-4 overflow-y-auto overflow-x-hidden">
        {dragState.manifolds.map(
          (manifold: Manifold<unknown>, manifoldIdx: number) => (
            <Fragment key={manifoldIdx}>
              <div className="text-xs font-medium text-gray-600 mt-2">
                Manifold {manifoldIdx} ({manifold.points.length} points)
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {manifold.points.map(
                  (point: ManifoldPoint<unknown>, pointIdx: number) => (
                    <ManifoldPointCard
                      key={pointIdx}
                      point={point}
                      pointIdx={pointIdx}
                      demoHeight={demoHeight}
                      demoPadding={demoPadding}
                    />
                  )
                )}
              </div>
            </Fragment>
          )
        )}
      </div>
    </>
  );
}

function RHSDragDetachReattachMode({
  dragState,
  demoHeight,
  demoPadding,
}: {
  dragState: DragState<unknown> & { type: "drag-detach-reattach" };
  demoHeight: number;
  demoPadding?: number;
}) {
  return (
    <>
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-2">Dragged Element</h2>
          <div className="border border-gray-200 rounded p-2 bg-white">
            <div style={{ padding: demoPadding }}>
              <svg
                width="100%"
                height="100"
                viewBox={`0 0 ${demoHeight * 1.5} ${demoHeight}`}
                style={{ border: "1px solid black" }}
              >
                {drawHoisted(dragState.draggedHoisted)}
              </svg>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-2">Detached Background</h2>
          <div className="border border-gray-200 rounded p-2 bg-white">
            <div style={{ padding: demoPadding }}>
              <svg
                width="100%"
                height="100"
                viewBox={`0 0 ${demoHeight * 1.5} ${demoHeight}`}
                style={{ border: "1px solid black" }}
              >
                {drawHoisted(dragState.detachedHoisted)}
              </svg>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-2">
        Reattachment Points ({dragState.reattachedPoints.length} total)
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto overflow-x-hidden">
        {dragState.reattachedPoints.map(
          (point: ManifoldPoint<unknown>, pointIdx: number) => (
            <ManifoldPointCard
              key={pointIdx}
              point={point}
              pointIdx={pointIdx}
              demoHeight={demoHeight}
              demoPadding={demoPadding}
            />
          )
        )}
      </div>
    </>
  );
}

function ManifoldPointCard({
  point,
  pointIdx,
  demoHeight,
  demoPadding,
}: {
  point: ManifoldPoint<any>;
  pointIdx: number;
  demoHeight: number;
  demoPadding?: number;
}) {
  const hasAndThen = point.andThen !== undefined;
  return (
    <div
      className={`border border-gray-200 rounded p-2 bg-white ${
        hasAndThen ? "lg:col-span-2" : ""
      }`}
      style={{
        display: "grid",
        gridTemplateColumns: hasAndThen ? "1fr auto 1fr" : "1fr",
        gap: "0.5rem",
      }}
    >
      {/* Column 1: Label */}
      <div className="text-xs text-gray-500 mb-1">P{pointIdx}</div>
      {hasAndThen && (
        <>
          <div></div>
          <div></div>
        </>
      )}

      {/* Column 1: SVG */}
      <div style={{ padding: demoPadding }}>
        <svg
          width="100%"
          height="100"
          viewBox={`0 0 ${demoHeight * 1.5} ${demoHeight}`}
          className="overflow-visible select-none touch-none"
          style={{ border: "1px solid black" }}
        >
          {drawHoisted(point.hoisted)}
          <circle
            cx={point.position.x}
            cy={point.position.y}
            r={(5 * demoHeight) / 100}
            fill="red"
          />
        </svg>
      </div>
      {hasAndThen && (
        <>
          <div></div>
          <div></div>
        </>
      )}

      {/* Column 1: State (or all 3 columns if andThen) */}
      <div
        className="mt-1 text-xs relative"
        style={hasAndThen ? { gridColumn: "1 / -1" } : undefined}
      >
        {hasAndThen && (
          <div className="absolute left-1/2 top-0 -translate-x-1/2 flex flex-col items-center text-gray-600 text-xs bg-white z-10 px-2">
            <svg width="50" height="20" className="mb-1">
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
                </marker>
              </defs>
              <line
                x1="0"
                y1="10"
                x2="50"
                y2="10"
                stroke="currentColor"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            </svg>
            <div>andThen</div>
          </div>
        )}
        <div
          className="max-h-32 overflow-y-auto"
          style={
            hasAndThen
              ? {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4rem",
                }
              : undefined
          }
        >
          <PrettyPrint value={point.state} className="text-[10px]" />
          {hasAndThen && (
            <PrettyPrint value={point.andThen} className="text-[10px]" />
          )}
        </div>
      </div>
    </div>
  );
}
