import { useState } from "react";
import { HashRouter, Link, Route, Routes, useParams } from "react-router-dom";
import { DemoProvider } from "./DemoContext";
import { demos } from "./demos";

function DemoList() {
  const [debugView, setDebugView] = useState(false);
  const [snapRadius, setSnapRadius] = useState(10);

  return (
    <DemoProvider debugView={debugView} snapRadius={snapRadius}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="text-center py-10 px-5 max-w-3xl mx-auto">
          <h1 className="text-3xl font-normal text-gray-800">
            Draggable diagrams
          </h1>
        </div>
        <div className="flex flex-col gap-5 px-5 pb-5 max-w-3xl mx-auto flex-1">
          {demos.map((demo) => (
            <div key={demo.id}>{demo.node}</div>
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="range"
              min="0"
              max="20"
              value={snapRadius}
              onChange={(e) => setSnapRadius(Number(e.target.value))}
            />
            Snap Radius
          </label>
        </div>
      </div>
    </DemoProvider>
  );
}

function SingleDemo() {
  const { id } = useParams<{ id: string }>();
  const [debugView, setDebugView] = useState(false);
  const [snapRadius, setSnapRadius] = useState(0);

  const demo = demos.find((d) => d.id === id);

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
    <DemoProvider debugView={debugView} snapRadius={snapRadius}>
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
        <div className="flex flex-col gap-5 px-5 pb-5 max-w-3xl mx-auto flex-1">
          {demo.node}
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="range"
              min="0"
              max="20"
              value={snapRadius}
              onChange={(e) => setSnapRadius(Number(e.target.value))}
            />
            Snap Radius
          </label>
        </div>
      </div>
    </DemoProvider>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DemoList />} />
        <Route path="/:id" element={<SingleDemo />} />
      </Routes>
    </HashRouter>
  );
}
