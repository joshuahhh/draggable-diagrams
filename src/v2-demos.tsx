import { ComponentType } from "react";
import { Angle } from "./demo-diagrams-2/angle";
import { AngleViaTransform } from "./demo-diagrams-2/angle-via-transform";
import { Bezier } from "./demo-diagrams-2/bezier";
import { BluefishPerm } from "./demo-diagrams-2/bluefish-perm";
import { BluefishStatic } from "./demo-diagrams-2/bluefish-static";
import { Braid } from "./demo-diagrams-2/braid";
import { CanvasOfLists } from "./demo-diagrams-2/canvas-of-lists";
import { CanvasOfListsNested } from "./demo-diagrams-2/canvas-of-lists-nested";
import { Carousel } from "./demo-diagrams-2/carousel";
import { Clock } from "./demo-diagrams-2/clock";
import { ConstrainedPoint } from "./demo-diagrams-2/constrained-point";
import { ConstrainedSlider } from "./demo-diagrams-2/constrained-slider";
import { Dragon } from "./demo-diagrams-2/dragon";
import { Fifteen } from "./demo-diagrams-2/fifteen";
import { Graph } from "./demo-diagrams-2/graph";
import { GridPoly } from "./demo-diagrams-2/grid-poly";
import { Hanoi } from "./demo-diagrams-2/hanoi";
import { InsertAndRemove } from "./demo-diagrams-2/insert-and-remove";
import { Kanban } from "./demo-diagrams-2/kanban";
import { LinearTrack } from "./demo-diagrams-2/linear-track";
import { LinearTrackChained } from "./demo-diagrams-2/linear-track-chained";
import { ListOfLists } from "./demo-diagrams-2/list-of-lists";
import { ListOfListsSizes } from "./demo-diagrams-2/list-of-lists-sizes";
import { MultiCirclePoints } from "./demo-diagrams-2/multi-circle-points";
import { NodeWires } from "./demo-diagrams-2/node-wires";
import { NoolTree } from "./demo-diagrams-2/nool-tree";
import { OrbitingPlanet } from "./demo-diagrams-2/orbiting-planet";
import { OrbitingPlanetWithBackground } from "./demo-diagrams-2/orbiting-planet-with-background";
import { OrderPreserving } from "./demo-diagrams-2/order-preserving";
import { Outline } from "./demo-diagrams-2/outline";
import { Perm } from "./demo-diagrams-2/perm";
import { PermDouble } from "./demo-diagrams-2/perm-double";
import { PermFloating } from "./demo-diagrams-2/perm-floating";
import { RushHour } from "./demo-diagrams-2/rush-hour";
import { SimpleTriangle } from "./demo-diagrams-2/simple-triangle";
import { SimplestClicker } from "./demo-diagrams-2/simplest-clicker";
import { SimplestJust } from "./demo-diagrams-2/simplest-just";
import { Sokoban } from "./demo-diagrams-2/sokoban";
import { Spinny } from "./demo-diagrams-2/spinny";
import { StretchyRot } from "./demo-diagrams-2/stretchy-rot";
import { StretchyXY } from "./demo-diagrams-2/stretchy-xy";
import { Tiles } from "./demo-diagrams-2/tiles";
import { Todo } from "./demo-diagrams-2/todo";
import { Tromino } from "./demo-diagrams-2/tromino";

export type V2Demo = {
  id: string;
  Component: ComponentType;
};

export const v2Demos: V2Demo[] = [
  { id: "linear-track", Component: LinearTrack },
  { id: "linear-track-chained", Component: LinearTrackChained },
  { id: "simple-triangle", Component: SimpleTriangle },
  { id: "simplest-clicker", Component: SimplestClicker },
  { id: "order-preserving", Component: OrderPreserving },
  { id: "perm", Component: Perm },
  { id: "perm-floating", Component: PermFloating },
  { id: "perm-double", Component: PermDouble },
  { id: "list-of-lists", Component: ListOfLists },
  { id: "list-of-lists-sizes", Component: ListOfListsSizes },
  { id: "canvas-of-lists", Component: CanvasOfLists },
  { id: "canvas-of-lists-nested", Component: CanvasOfListsNested },
  { id: "kanban", Component: Kanban },
  { id: "insert-and-remove", Component: InsertAndRemove },
  { id: "tiles", Component: Tiles },
  { id: "grid-poly", Component: GridPoly },
  { id: "nool-tree", Component: NoolTree },
  { id: "outline", Component: Outline },
  { id: "braid", Component: Braid },
  { id: "todo", Component: Todo },
  { id: "carousel", Component: Carousel },
  { id: "rush-hour", Component: RushHour },
  { id: "fifteen", Component: Fifteen },
  { id: "hanoi", Component: Hanoi },
  { id: "sokoban", Component: Sokoban },
  { id: "spinny", Component: Spinny },
  { id: "graph", Component: Graph },
  { id: "tromino", Component: Tromino },
  { id: "angle", Component: Angle },
  { id: "angle-via-transform", Component: AngleViaTransform },
  { id: "bezier", Component: Bezier },
  { id: "stretchy-xy", Component: StretchyXY },
  { id: "stretchy-rot", Component: StretchyRot },
  { id: "clock", Component: Clock },
  { id: "dragon", Component: Dragon },
  { id: "orbiting-planet", Component: OrbitingPlanet },
  {
    id: "orbiting-planet-with-background",
    Component: OrbitingPlanetWithBackground,
  },
  { id: "constrained-slider", Component: ConstrainedSlider },
  { id: "constrained-point", Component: ConstrainedPoint },
  { id: "multi-circle-points", Component: MultiCirclePoints },
  { id: "node-wires", Component: NodeWires },
  { id: "simplest-just", Component: SimplestJust },
  { id: "bluefish-static", Component: BluefishStatic },
  { id: "bluefish-perm", Component: BluefishPerm },
];
