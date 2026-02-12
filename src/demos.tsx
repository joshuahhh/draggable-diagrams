import { ComponentType } from "react";
import { AltToCopy } from "./demo-diagrams/alt-to-copy";
import { Angle } from "./demo-diagrams/angle";
import { AngleViaTransform } from "./demo-diagrams/angle-via-transform";
import { Bezier } from "./demo-diagrams/bezier";
import { BluefishPerm } from "./demo-diagrams/bluefish-perm";
import { BluefishStatic } from "./demo-diagrams/bluefish-static";
import { Braid } from "./demo-diagrams/braid";
import { CanvasOfLists } from "./demo-diagrams/canvas-of-lists";
import { CanvasOfListsNested } from "./demo-diagrams/canvas-of-lists-nested";
import { Carousel } from "./demo-diagrams/carousel";
import { ClickAndDrag } from "./demo-diagrams/click-and-drag";
import { Clock } from "./demo-diagrams/clock";
import { ConstrainedPoint } from "./demo-diagrams/constrained-point";
import { ConstrainedSlider } from "./demo-diagrams/constrained-slider";
import { DragToCopy } from "./demo-diagrams/drag-to-copy";
import { Dragon } from "./demo-diagrams/dragon";
import { Fifteen } from "./demo-diagrams/fifteen";
import { Graph } from "./demo-diagrams/graph";
import { GridPoly } from "./demo-diagrams/grid-poly";
import { Hanoi } from "./demo-diagrams/hanoi";
import { InsertAndRemove } from "./demo-diagrams/insert-and-remove";
import { Kanban } from "./demo-diagrams/kanban";
import { LinearTrack } from "./demo-diagrams/linear-track";
import { LinearTrackChained } from "./demo-diagrams/linear-track-chained";
import { ListOfLists } from "./demo-diagrams/list-of-lists";
import { ListOfListsSizes } from "./demo-diagrams/list-of-lists-sizes";
import { MultiCirclePoints } from "./demo-diagrams/multi-circle-points";
import { NodeWires } from "./demo-diagrams/node-wires";
import { NoolTree } from "./demo-diagrams/nool-tree";
import { OrbitingPlanet } from "./demo-diagrams/orbiting-planet";
import { OrbitingPlanetWithBackground } from "./demo-diagrams/orbiting-planet-with-background";
import { OrderPreserving } from "./demo-diagrams/order-preserving";
import { Outline } from "./demo-diagrams/outline";
import { Perm } from "./demo-diagrams/perm";
import { PermDouble } from "./demo-diagrams/perm-double";
import { PermFloating } from "./demo-diagrams/perm-floating";
import { RushHour } from "./demo-diagrams/rush-hour";
import { SimpleTriangle } from "./demo-diagrams/simple-triangle";
import { SimplestClicker } from "./demo-diagrams/simplest-clicker";
import { SimplestJust } from "./demo-diagrams/simplest-just";
import { Sokoban } from "./demo-diagrams/sokoban";
import { Spinny } from "./demo-diagrams/spinny";
import { SproutingTree } from "./demo-diagrams/sprouting-tree";
import { StretchyRot } from "./demo-diagrams/stretchy-rot";
import { StretchyXY } from "./demo-diagrams/stretchy-xy";
import { Tiles } from "./demo-diagrams/tiles";
import { Todo } from "./demo-diagrams/todo";
import { Tromino } from "./demo-diagrams/tromino";

export type Demo = {
  id: string;
  Component: ComponentType;
};

export const demos: Demo[] = [
  { id: "linear-track", Component: LinearTrack },
  { id: "linear-track-chained", Component: LinearTrackChained },
  { id: "simple-triangle", Component: SimpleTriangle },
  { id: "simplest-clicker", Component: SimplestClicker },
  { id: "click-and-drag", Component: ClickAndDrag },
  { id: "drag-to-copy", Component: DragToCopy },
  { id: "alt-to-copy", Component: AltToCopy },
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
  { id: "sprouting-tree", Component: SproutingTree },
  { id: "simplest-just", Component: SimplestJust },
  { id: "bluefish-static", Component: BluefishStatic },
  { id: "bluefish-perm", Component: BluefishPerm },
];
