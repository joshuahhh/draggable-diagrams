import { CanvasOfLists } from "./demo-diagrams-2/canvas-of-lists";
import { ListOfLists } from "./demo-diagrams-2/list-of-lists";
import { ManipulableDrawer } from "./ManipulableDrawer2";
import { OrbitingPlanet } from "./demo-diagrams-2/orbiting-planet";
import { OrbitingPlanetWithBackground } from "./demo-diagrams-2/orbiting-planet-with-background";

export function V2DemoPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">v2 Demos</h1>

      <h2 className="text-xl font-semibold mb-2">list-of-lists</h2>
      <ManipulableDrawer
        manipulable={ListOfLists.manipulable}
        initialState={ListOfLists.state1}
        width={600}
        height={300}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">canvas-of-lists</h2>
      <ManipulableDrawer
        manipulable={CanvasOfLists.manipulable}
        initialState={CanvasOfLists.state1}
        width={600}
        height={400}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">orbiting-planet</h2>
      <ManipulableDrawer
        manipulable={OrbitingPlanet.manipulable}
        initialState={OrbitingPlanet.state1}
        width={450}
        height={400}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">
        orbiting-planet-with-background
      </h2>
      <ManipulableDrawer
        manipulable={OrbitingPlanetWithBackground.manipulable}
        initialState={OrbitingPlanetWithBackground.state1}
        width={450}
        height={400}
      />
    </div>
  );
}
