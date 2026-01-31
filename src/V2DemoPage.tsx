import { useState } from "react";
import { CanvasOfLists } from "./demo-diagrams-2/canvas-of-lists";
import { ListOfLists } from "./demo-diagrams-2/list-of-lists";
import { ManipulableDrawer } from "./ManipulableDrawer2";
import { OrbitingPlanet } from "./demo-diagrams-2/orbiting-planet";
import { OrbitingPlanetWithBackground } from "./demo-diagrams-2/orbiting-planet-with-background";
import { DebugManipulableDrawer } from "./DebugManipulableDrawer";

export function V2DemoPage() {
  const [debug, setDebug] = useState(false);

  const Drawer = debug ? DebugManipulableDrawer : ManipulableDrawer;

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">v2 Demos</h1>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
          />
          Debug
        </label>
      </div>

      <h2 className="text-xl font-semibold mb-2">list-of-lists</h2>
      <Drawer
        manipulable={ListOfLists.manipulable}
        initialState={ListOfLists.state1}
        width={600}
        height={300}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">canvas-of-lists</h2>
      <Drawer
        manipulable={CanvasOfLists.manipulable}
        initialState={CanvasOfLists.state1}
        width={600}
        height={400}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">orbiting-planet</h2>
      <Drawer
        manipulable={OrbitingPlanet.manipulable}
        initialState={OrbitingPlanet.state1}
        width={450}
        height={400}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">
        orbiting-planet-with-background
      </h2>
      <Drawer
        manipulable={OrbitingPlanetWithBackground.manipulable}
        initialState={OrbitingPlanetWithBackground.state1}
        width={450}
        height={400}
      />
    </div>
  );
}
