import { Link } from "react-router-dom";
import { DemoSettingsBar, DemoSettingsProvider } from "./demo-ui";
import { DemoCard, demos } from "./demos";

export function DemoPage() {
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
        <div className="flex flex-col gap-5 px-5 pb-5 max-w-3xl mx-auto flex-1 w-full">
          {demos.map((demo) => (
            <div key={demo.id} id={demo.id}>
              <DemoCard demo={demo} linkTitle />
            </div>
          ))}
        </div>
        <DemoSettingsBar />
      </div>
    </DemoSettingsProvider>
  );
}
