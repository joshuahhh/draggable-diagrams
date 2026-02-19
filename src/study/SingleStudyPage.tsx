import { Link } from "react-router-dom";
import { DemoSettingsBar, DemoSettingsProvider } from "../demo/ui";
import { studiesById } from "./registry";

export function SingleStudyPage({ id }: { id: string }) {
  const study = studiesById.get(id);

  if (!study) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-center py-10 px-5 max-w-3xl mx-auto">
          <h1 className="text-3xl font-normal text-gray-800">
            Study not found
          </h1>
          <div className="mt-5">
            <Link
              to="/study"
              className="text-blue-600 text-sm hover:text-blue-700"
            >
              &larr; Back to all studies
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { Component } = study;

  return (
    <DemoSettingsProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="text-center py-10 px-5 max-w-3xl mx-auto">
          <Link to="/" className="text-gray-500 text-sm no-underline">
            <h1 className="text-3xl font-normal text-gray-800">Draggables</h1>
          </Link>
          <p className="mt-2">
            <Link
              to="/study"
              className="text-blue-600 text-sm hover:text-blue-700 no-underline"
            >
              &larr; Back to all studies
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-5 px-5 pb-5 max-w-3xl mx-auto flex-1 w-full">
          <h2 className="text-xl font-semibold text-gray-900">
            <span className="text-gray-400 font-mono text-sm mr-2">
              {String(study.number).padStart(2, "0")}
            </span>
            {study.name}
          </h2>
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <Component />
          </div>
        </div>
        <DemoSettingsBar />
      </div>
    </DemoSettingsProvider>
  );
}
