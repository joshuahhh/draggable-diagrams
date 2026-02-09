import { Link } from "react-router-dom";
import { DemoSettingsBar, DemoSettingsProvider } from "./DemoContext";
import { v2Demos } from "./v2-demos";

export function V2SingleDemoPage({ id }: { id: string }) {
  const demo = v2Demos.find((d) => d.id === id);

  if (!demo) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-center py-10 px-5 max-w-3xl mx-auto">
          <h1 className="text-3xl font-normal text-gray-800">
            Demo not found
          </h1>
          <div className="mt-5">
            <Link
              to="/v2"
              className="text-blue-600 text-sm hover:text-blue-700"
            >
              &larr; Back to all demos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DemoSettingsProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="text-center py-10 px-5 max-w-3xl mx-auto">
          <Link to="/" className="text-gray-500 text-sm no-underline">
            <h1 className="text-3xl font-normal text-gray-800">
              Draggable Diagrams
            </h1>
          </Link>
        </div>
        <div className="text-center py-2.5 px-5 max-w-3xl mx-auto">
          <Link
            to="/v2"
            className="text-blue-600 text-sm hover:text-blue-700 no-underline"
          >
            &larr; Back to all demos
          </Link>
        </div>
        <div className="flex flex-col gap-5 px-5 pb-5 max-w-3xl mx-auto flex-1 w-full">
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 m-0">
                {demo.id}
              </h2>
              <a
                href={`https://github.com/joshuahhh/draggable-diagrams/blob/main/src/demo-diagrams-2/${demo.id}.tsx`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-700 no-underline hover:underline"
              >
                source
              </a>
            </div>
            <demo.Component />
          </div>
        </div>
        <DemoSettingsBar />
      </div>
    </DemoSettingsProvider>
  );
}
