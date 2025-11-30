import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DemoContext } from "./DemoContext";
import { demos } from "./demos";
import { ErrorBoundary } from "./ErrorBoundary";
import { PrettyPrint } from "./pretty-print";

function DemoList() {
  const [debugView, setDebugView] = useState(false);

  return (
    <DemoContext.Provider value={{ debugView }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="text-center py-10 px-5 max-w-3xl mx-auto">
          <h1 className="text-3xl font-normal text-gray-800">
            Draggable diagrams
          </h1>
        </div>
        <div className="flex flex-col gap-5 px-5 pb-5 max-w-3xl mx-auto flex-1">
          {demos.map((demo) => (
            <ErrorBoundary
              key={demo.id}
              fallback={<div>Error loading demo: {demo.id}</div>}
            >
              {demo.node}
            </ErrorBoundary>
          ))}
        </div>
        <div className="sticky bottom-0 bg-white/95 py-4 px-5 border-t border-gray-200 flex gap-5 items-center justify-center shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={debugView}
              onChange={(e) => setDebugView(e.target.checked)}
            />
            Debug View
          </label>
        </div>
      </div>
    </DemoContext.Provider>
  );
}

function SingleDemo() {
  const { id } = useParams<{ id: string }>();
  const [debugView, setDebugView] = useState(false);

  const demo = demos.find((d) => d.id === id);

  const [dragState, setDragState] = useState<any>(null);
  const lastExcitingDragStateRef = useRef<any>(null);
  if (dragState?.type === "dragging") {
    lastExcitingDragStateRef.current = dragState;
  }

  if (!demo) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-center py-10 px-5 max-w-3xl mx-auto">
          <h1 className="text-3xl font-normal text-gray-800">Demo not found</h1>
          <div className="mt-5">
            <Link to="/" className="text-blue-600 text-sm hover:text-blue-700">
              ← Back to all demos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="text-center py-10 px-5 max-w-3xl mx-auto">
        <h1 className="text-3xl font-normal text-gray-800">
          Draggable diagrams
        </h1>
      </div>
      <div className="text-center py-2.5 px-5 max-w-3xl mx-auto">
        <Link
          to="/"
          className="text-blue-600 text-sm hover:text-blue-700 no-underline"
        >
          ← Back to all demos
        </Link>
      </div>
      <div className="flex flex-col gap-5 px-5 pb-5 max-w-3xl mx-auto min-w-1/2">
        <DemoContext.Provider
          value={{ debugView, onDragStateChange: setDragState }}
        >
          {demo.node}
        </DemoContext.Provider>
      </div>
      {true && debugView ? (
        <div className="px-5 max-w-3xl mx-auto w-full flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {<PrettyPrint value={lastExcitingDragStateRef.current} />}
        </div>
      ) : (
        <div className="flex-1" />
      )}
      <div className="sticky bottom-0 bg-white/95 py-4 px-5 border-t border-gray-200 flex gap-5 items-center justify-center shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={debugView}
            onChange={(e) => setDebugView(e.target.checked)}
          />
          Debug View
        </label>
      </div>
    </div>
  );
}

export function DemoLayout() {
  const { id } = useParams<{ id: string }>();

  return id ? <SingleDemo /> : <DemoList />;
}
