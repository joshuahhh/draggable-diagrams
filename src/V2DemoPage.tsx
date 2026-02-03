import { useState } from "react";
import { DebugManipulableDrawer } from "./DebugManipulableDrawer";
import { Angle } from "./demo-diagrams-2/angle";
import { AngleViaTransform } from "./demo-diagrams-2/angle-via-transform";
import { Bezier } from "./demo-diagrams-2/bezier";
import { Braid } from "./demo-diagrams-2/braid";
import { CanvasOfLists } from "./demo-diagrams-2/canvas-of-lists";
import { CanvasOfListsNested } from "./demo-diagrams-2/canvas-of-lists-nested";
import { Carousel } from "./demo-diagrams-2/carousel";
import { Clock } from "./demo-diagrams-2/clock";
import { Dragon } from "./demo-diagrams-2/dragon";
import { GridPoly } from "./demo-diagrams-2/grid-poly";
import { Hanoi } from "./demo-diagrams-2/hanoi";
import { InsertAndRemove } from "./demo-diagrams-2/insert-and-remove";
import { ListOfLists } from "./demo-diagrams-2/list-of-lists";
import { ListOfListsSizes } from "./demo-diagrams-2/list-of-lists-sizes";
import { NoolTree } from "./demo-diagrams-2/nool-tree";
import { OrbitingPlanet } from "./demo-diagrams-2/orbiting-planet";
import { OrbitingPlanetWithBackground } from "./demo-diagrams-2/orbiting-planet-with-background";
import { OrderPreserving } from "./demo-diagrams-2/order-preserving";
import { Perm } from "./demo-diagrams-2/perm";
import { PermDouble } from "./demo-diagrams-2/perm-double";
import { PermFloating } from "./demo-diagrams-2/perm-floating";
import { RushHour } from "./demo-diagrams-2/rush-hour";
import { Simplest } from "./demo-diagrams-2/simplest";
import { SimplestClicker } from "./demo-diagrams-2/simplest-clicker";
import { SimplestJust } from "./demo-diagrams-2/simplest-just";
import { ManipulableDrawer } from "./ManipulableDrawer2";

export function V2DemoPage() {
  const [debug, setDebug] = useState(false);

  const Drawer = debug ? DebugManipulableDrawer : ManipulableDrawer;

  return (
    <div className="p-8 pb-64">
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

      {/* --- vary-based demos --- */}

      <h2 className="text-xl font-semibold mb-2">angle</h2>
      <Drawer
        manipulable={Angle.manipulable}
        initialState={Angle.state1}
        width={250}
        height={250}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">angle-via-transform</h2>
      <Drawer
        manipulable={AngleViaTransform.manipulable}
        initialState={AngleViaTransform.state1}
        width={250}
        height={250}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">clock</h2>
      <Drawer
        manipulable={Clock.manipulable}
        initialState={Clock.state1}
        width={250}
        height={250}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">bezier</h2>
      <Drawer
        manipulable={Bezier.manipulable}
        initialState={Bezier.state1}
        width={400}
        height={250}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">dragon</h2>
      <Drawer
        manipulable={Dragon.manipulable}
        initialState={Dragon.state1}
        width={400}
        height={250}
      />

      {/* --- floating-based demos --- */}

      <h2 className="text-xl font-semibold mt-8 mb-2">perm-floating</h2>
      <Drawer
        manipulable={PermFloating.manipulable}
        initialState={PermFloating.state1}
        width={350}
        height={100}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">list-of-lists</h2>
      <Drawer
        manipulable={ListOfLists.manipulable}
        initialState={ListOfLists.state1}
        width={600}
        height={300}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">list-of-lists-sizes</h2>
      <Drawer
        manipulable={ListOfListsSizes.manipulable}
        initialState={ListOfListsSizes.state1}
        width={600}
        height={450}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">canvas-of-lists</h2>
      <Drawer
        manipulable={CanvasOfLists.manipulable}
        initialState={CanvasOfLists.state1}
        width={600}
        height={400}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">
        canvas-of-lists-nested
      </h2>
      <Drawer
        manipulable={CanvasOfListsNested.manipulable}
        initialState={CanvasOfListsNested.state1}
        width={600}
        height={400}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">hanoi</h2>
      <Drawer
        manipulable={Hanoi.manipulable}
        initialState={Hanoi.state3}
        width={600}
        height={200}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">insert-and-remove</h2>
      <Drawer
        manipulable={InsertAndRemove.manipulable}
        initialState={InsertAndRemove.state1}
        width={400}
        height={200}
      />

      {/* --- v2-only demos --- */}

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

      {/* --- span-based demos --- */}

      <h2 className="text-xl font-semibold mt-8 mb-2">
        order-preserving (3→3)
      </h2>
      <Drawer
        manipulable={OrderPreserving.manipulable}
        initialState={OrderPreserving.state3To3}
        width={600}
        height={400}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">
        order-preserving (7→7)
      </h2>
      <Drawer
        manipulable={OrderPreserving.manipulable}
        initialState={OrderPreserving.state7To7}
        width={800}
        height={600}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">nool-tree (state1)</h2>
      <Drawer
        manipulable={NoolTree.manipulable}
        initialState={NoolTree.state1}
        width={600}
        height={350}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">nool-tree (state2)</h2>
      <Drawer
        manipulable={NoolTree.manipulable}
        initialState={NoolTree.state2}
        width={600}
        height={350}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">simplest</h2>
      <Drawer
        manipulable={Simplest.manipulable}
        initialState={Simplest.state1}
        width={250}
        height={150}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">simplest-just</h2>
      <Drawer
        manipulable={SimplestJust.manipulable}
        initialState={SimplestJust.state1}
        width={250}
        height={150}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">perm</h2>
      <Drawer
        manipulable={Perm.manipulable}
        initialState={Perm.state1}
        width={350}
        height={100}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">perm-double</h2>
      <Drawer
        manipulable={PermDouble.manipulable}
        initialState={PermDouble.state1}
        width={250}
        height={200}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">grid-poly</h2>
      <Drawer
        manipulable={GridPoly.manipulable}
        initialState={GridPoly.state1}
        width={350}
        height={350}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">rush-hour</h2>
      <Drawer
        manipulable={RushHour.manipulable}
        initialState={RushHour.state1}
        width={350}
        height={350}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">braid</h2>
      <Drawer
        manipulable={Braid.manipulable}
        initialState={Braid.state1}
        width={250}
        height={400}
      />

      <h2 className="text-xl font-semibold mt-8 mb-2">carousel</h2>
      <Drawer
        manipulable={Carousel.manipulable}
        initialState={Carousel.state1}
        width={450}
        height={300}
      />

      {/* --- setState-only demos --- */}

      <h2 className="text-xl font-semibold mt-8 mb-2">simplest-clicker</h2>
      <Drawer
        manipulable={SimplestClicker.manipulable}
        initialState={SimplestClicker.state1}
        width={300}
        height={150}
      />
    </div>
  );
}
