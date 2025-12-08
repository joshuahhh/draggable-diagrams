import { ReactNode } from "react";
import { configurable, Configurable, ConfigurableProps } from "./configurable";
import { Angle } from "./demo-diagrams/angle";
import { AngleViaTransform } from "./demo-diagrams/angle-via-transform";
import { Bezier } from "./demo-diagrams/bezier";
import { Braid } from "./demo-diagrams/braid";
import { Clock } from "./demo-diagrams/clock";
import { Fifteen } from "./demo-diagrams/fifteen";
import { Graph } from "./demo-diagrams/graph";
import { GridPoly } from "./demo-diagrams/grid-poly";
import { InsertAndRemove } from "./demo-diagrams/insert-and-remove";
import { ListOfLists } from "./demo-diagrams/list-of-lists";
import { ListOfListsSizes } from "./demo-diagrams/list-of-lists-sizes";
import { NoolTree } from "./demo-diagrams/nool-tree";
import { OrderPreserving } from "./demo-diagrams/order-preserving";
import { Outline } from "./demo-diagrams/outline";
import { Perm } from "./demo-diagrams/perm";
import { PermDetach } from "./demo-diagrams/perm-detach";
import { PermDouble } from "./demo-diagrams/perm-double";
import { RushHour } from "./demo-diagrams/rush-hour";
import { SecondSimplest } from "./demo-diagrams/second-simplest";
import { Simplest } from "./demo-diagrams/simplest";
import { SimplestClicker } from "./demo-diagrams/simplest-clicker";
import { Sokoban } from "./demo-diagrams/sokoban";
import { Spinny } from "./demo-diagrams/spinny";
import { Tiles } from "./demo-diagrams/tiles";
import { Todo } from "./demo-diagrams/todo";
import { numsAtPaths } from "./DragSpec";
import {
  DrawerConfig,
  Manipulable,
  rotate,
  scale,
  translate,
} from "./manipulable";
import { hasKey } from "./utils";

export type DemoData<T extends object> = {
  id: string;
  title: string;
  notes?: ReactNode;
  manipulable:
    | {
        type: "constant";
        withConfig: () => Manipulable<T>;
      }
    | Configurable<Manipulable<T>, any>;
  initialStates: T[];
  height: number;
  padding?: number;
  initialDrawerConfig?: Partial<DrawerConfig>;
  sourceFile?: string;
};

function demoData<T extends object>(
  data: Omit<DemoData<T>, "manipulable"> & {
    manipulable: Manipulable<T> | Configurable<Manipulable<T>, any>;
  }
): SomeDemoData {
  const manipulable =
    hasKey(data.manipulable, "type") && data.manipulable.type === "configurable"
      ? data.manipulable
      : {
          type: "constant" as const,
          withConfig: () => data.manipulable as Manipulable<T>,
        };
  return someDemoData({ ...data, manipulable });
}
export type SomeDemoData = {
  run: <R>(doIt: <T extends object>(demoData: DemoData<T>) => R) => R;
};
export function someDemoData<T extends object>(
  demoData: DemoData<T>
): SomeDemoData {
  return { run: (doIt) => doIt(demoData) };
}

export function configurableManipulable<T extends object, Config>(
  props: ConfigurableProps<Config>,
  f: (
    config: Config,
    ...args: Parameters<Manipulable<T>>
  ) => ReturnType<Manipulable<T>>
): Configurable<Manipulable<T>, Config> {
  return configurable(
    props,
    (config) =>
      (...args) =>
        f(config, ...args)
  );
}

export const demos: SomeDemoData[] = [
  demoData({
    id: "simplest",
    title: "Simplest",
    manipulable: Simplest.manipulable,
    initialStates: [Simplest.state1],
    height: 100,
    padding: 20,
    sourceFile: "simplest.tsx",
  }),
  demoData({
    id: "second-simplest",
    title: "Second simplest",
    manipulable: SecondSimplest.manipulable,
    initialStates: [SecondSimplest.state1],
    height: 200,
    padding: 20,
    sourceFile: "second-simplest.tsx",
  }),
  demoData({
    id: "simplest-clicker",
    title: "Simplest clicker",
    manipulable: SimplestClicker.manipulable,
    initialStates: [SimplestClicker.state1],
    height: 200,
    padding: 20,
    sourceFile: "simplest-clicker.tsx",
  }),
  demoData({
    id: "todo",
    title: "Todo",
    manipulable: Todo.manipulable,
    initialStates: [Todo.state1],
    height: 400,
    padding: 20,
    sourceFile: "todo.tsx",
  }),
  demoData({
    id: "lonely-tile-on-a-grid",
    title: "Lonely tile on a grid",
    notes:
      "I'm trying to make dragging feel right here. Goal is for the tile to only drag orthogonally, AND to not jump discontinuously. This seems to require 'Relative Pointer Motion' mode (or divergent approaches).",
    manipulable: Tiles.manipulable,
    initialStates: [Tiles.stateLonely],
    height: 300,
    padding: 20,
    initialDrawerConfig: { relativePointerMotion: true },
    sourceFile: "tiles.tsx",
  }),
  demoData({
    id: "grid-polygon",
    title: "Grid polygon",
    manipulable: GridPoly.manipulable,
    initialStates: [GridPoly.state1],
    height: 300,
    padding: 20,
    sourceFile: "grid-poly.tsx",
  }),
  demoData({
    id: "perm",
    title: "Permutation",
    manipulable: Perm.manipulable,
    initialStates: [Perm.state1],
    height: 100,
    padding: 15,
    sourceFile: "perm.tsx",
  }),
  demoData({
    id: "perm-detach",
    title: "Permutation (detach-reattach)",
    manipulable: PermDetach.manipulable,
    initialStates: [PermDetach.state1],
    height: 100,
    padding: 15,
    sourceFile: "perm-detach.tsx",
  }),
  demoData({
    id: "perm-double",
    title: "Permutation of permutations",
    manipulable: PermDouble.manipulable,
    initialStates: [PermDouble.state1],
    height: 200,
    sourceFile: "perm-double.tsx",
  }),
  demoData({
    id: "list-of-lists",
    title: "List of lists",
    notes: "Uses detach-reattach.",
    manipulable: ListOfLists.manipulable,
    initialStates: [ListOfLists.state1],
    height: 220,
    sourceFile: "list-of-lists.tsx",
  }),
  demoData({
    id: "list-of-lists-sizes",
    title: "List of lists (different sizes)",
    notes: "Uses detach-reattach.",
    manipulable: ListOfListsSizes.manipulable,
    initialStates: [ListOfListsSizes.state1],
    height: 360,
    sourceFile: "list-of-lists.tsx",
  }),
  demoData({
    id: "spinny",
    title: "Spinny",
    notes: "Tests interpolation of rotations.",
    manipulable: Spinny.manipulable,
    initialStates: [Spinny.state1],
    height: 200,
    padding: 30,
    initialDrawerConfig: { relativePointerMotion: false },
    sourceFile: "spinny.tsx",
  }),
  demoData({
    id: "nool-tree",
    title: "Nool tree",
    manipulable: NoolTree.manipulable,
    initialStates: [NoolTree.state1, NoolTree.state2],
    height: 350,
    padding: 20,
    initialDrawerConfig: { snapRadius: 1, relativePointerMotion: true },
    sourceFile: "nool-tree.tsx",
  }),
  demoData({
    id: "tree-of-life",
    title: "Tree of Life",
    manipulable: Outline.manipulable,
    initialStates: [Outline.stateTreeOfLife],
    height: 1100,
    padding: 20,
    initialDrawerConfig: { snapRadius: 5 },
    sourceFile: "outline.tsx",
  }),
  demoData({
    id: "graph",
    title: "Graph",
    manipulable: Graph.manipulable,
    initialStates: [Graph.state1],
    height: 160,
    padding: 20,
    sourceFile: "graph.tsx",
  }),
  demoData({
    id: "angle",
    title: "Angle",
    manipulable: Angle.manipulable,
    initialStates: [Angle.state1],
    height: 200,
    padding: 20,
    sourceFile: "angle.tsx",
  }),
  demoData({
    id: "angle-via-transform",
    title: "Angle (via transform)",
    manipulable: AngleViaTransform.manipulable,
    initialStates: [AngleViaTransform.state1],
    height: 200,
    padding: 20,
    sourceFile: "angle-via-transform.tsx",
  }),
  demoData({
    id: "bezier",
    title: "Bezier Curve Editor",
    notes: (
      <>
        Drag the endpoints (red) or control points (yellow) orrrrr the curve
        (??). –{" "}
        <a
          href="https://www.orionreed.com/"
          className="hover:text-gray-700 hover:underline"
        >
          Orion Reed
        </a>
      </>
    ),
    manipulable: Bezier.manipulable,
    initialStates: [Bezier.state2],
    height: 200,
    padding: 20,
    sourceFile: "bezier.tsx",
  }),
  demoData({
    id: "stretchy-xy",
    title: "Stretchy (xy)",
    initialStates: [{ scaleX: 1, scaleY: 1 }],
    manipulable: ({ state: { scaleX, scaleY }, drag }) => (
      <g>
        {
          <circle
            transform={translate(100, 100) + scale(scaleX, scaleY)}
            cx={0}
            cy={0}
            r={50}
            fill="lightblue"
            data-on-drag={drag(numsAtPaths([["scaleX"], ["scaleY"]]))}
          />
        }
        <ellipse
          cx={100}
          cy={100}
          rx={50 * Math.abs(scaleX)}
          ry={50 * Math.abs(scaleY)}
          fill="none"
          stroke="black"
          strokeWidth={4}
        />
      </g>
    ),
    height: 200,
    padding: 20,
    sourceFile: "demos.tsx",
  }),
  demoData({
    id: "stretchy-rot",
    title: "Stretchy (rot)",
    initialStates: [{ angle: 0, scaleX: 1 }],
    manipulable: ({ state: { angle, scaleX }, drag }) => (
      <circle
        transform={
          translate(100, 100) + rotate(angle) + scale(scaleX, 1 / scaleX)
        }
        cx={0}
        cy={0}
        r={50}
        fill="lightblue"
        data-on-drag={drag(numsAtPaths([["angle"], ["scaleX"]]))}
      />
    ),
    height: 200,
    padding: 20,
    sourceFile: "demos.tsx",
  }),
  demoData({
    id: "clock",
    title: "Clock",
    manipulable: Clock.manipulable,
    initialStates: [Clock.state1],
    height: 200,
    padding: 20,
    sourceFile: "clock.tsx",
  }),
  demoData({
    id: "braids",
    title: "Braids",
    manipulable: Braid.manipulable,
    initialStates: [Braid.state1],
    height: 400,
    padding: 20,
    sourceFile: "braid.tsx",
  }),
  demoData({
    id: "order-preserving",
    title: "Order-preserving maps (tree3 → tree3)",
    notes: (
      <>
        Featuring multi-drag from{" "}
        <a
          href="https://elliot.website/"
          className="hover:text-gray-700 hover:underline"
        >
          Elliot Evans
        </a>
        .
      </>
    ),
    manipulable: OrderPreserving.manipulable,
    initialStates: [OrderPreserving.state3To3, OrderPreserving.state7To7],
    height: 400,
    padding: 20,
    sourceFile: "order-preserving.tsx",
  }),
  demoData({
    id: "rush-hour",
    title: "Rush Hour",
    manipulable: RushHour.manipulable,
    initialStates: [RushHour.state1],
    height: 320,
    padding: 20,
    sourceFile: "rush-hour.tsx",
  }),
  demoData({
    id: "15-puzzle",
    title: "15 puzzle",
    notes: "Weird experiment: I made the blank draggable",
    manipulable: Fifteen.manipulable,
    initialStates: [Fifteen.state1],
    height: 200,
    padding: 20,
    sourceFile: "fifteen.tsx",
  }),
  demoData({
    id: "inserting-removing-items",
    title: "Inserting & removing items",
    notes:
      "This shows kinda-hacky ways to insert and remove items from a draggable diagram. Much to consider.",
    manipulable: InsertAndRemove.manipulable,
    initialStates: [InsertAndRemove.state1],
    height: 150,
    padding: 10,
    sourceFile: "insert-and-remove.tsx",
  }),
  demoData({
    id: "sokoban",
    title: "Sokoban",
    manipulable: Sokoban.manipulable,
    initialStates: [Sokoban.state1],
    height: 500,
    padding: 20,
    initialDrawerConfig: { relativePointerMotion: true },
    sourceFile: "sokoban.tsx",
  }),
];
