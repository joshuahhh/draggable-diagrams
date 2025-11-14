import { ReactNode } from "react";
import { Demo } from "./components/Demo";
import { ManipulableDrawer } from "./manipulable";
import { manipulableFifteen, stateFifteen } from "./manipulable-fifteen";
import { manipulableGridPoly, stateGridPoly1 } from "./manipulable-grid-poly";
import {
  manipulableInsertAndRemove,
  stateInsertAndRemove1,
} from "./manipulable-insert-and-remove";
import {
  manipulableNoolTree,
  stateNoolTree1,
  stateNoolTree2,
} from "./manipulable-nool-tree";
import {
  manipulableOrderPreserving,
  stateOrderPreserving1,
  stateOrderPreserving2,
} from "./manipulable-order-preserving";
import { manipulablePerm, statePerm1 } from "./manipulable-perm";
import {
  manipulablePermDouble,
  statePermDouble1,
} from "./manipulable-perm-double";
import { manipulableRushHour, stateRushHour1 } from "./manipulable-rush-hour";
import { manipulableSimplest, stateSimplest1 } from "./manipulable-simplest";
import { manipulableSokoban, stateSokoban1 } from "./manipulable-sokoban";
import { manipulableTiles, stateTilesLonely } from "./manipulable-tiles";

export interface DemoEntry {
  id: string;
  node: ReactNode;
}

export const demos: DemoEntry[] = [
  {
    id: "rush-hour",
    node: (
      <Demo
        id="rush-hour"
        title="Rush Hour"
        drawer={new ManipulableDrawer(manipulableRushHour, stateRushHour1)}
        height={300}
        padding={20}
      />
    ),
  },
  {
    id: "15-puzzle",
    node: (
      <Demo
        id="15-puzzle"
        title="15 puzzle (with weird draggable blank for fun)"
        drawer={new ManipulableDrawer(manipulableFifteen, stateFifteen)}
        height={200}
        padding={20}
      />
    ),
  },
  {
    id: "lonely-tile-on-a-grid-goal-is-for-it-to-only-slide-orthogonally",
    node: (
      <Demo
        id="lonely-tile-on-a-grid-goal-is-for-it-to-only-slide-orthogonally"
        title="Lonely tile on a grid; goal is for it to only slide orthogonally"
        drawer={new ManipulableDrawer(manipulableTiles, stateTilesLonely)}
        height={300}
        padding={20}
      />
    ),
  },
  {
    id: "order-preserving-map",
    node: (
      <Demo
        id="order-preserving-map"
        title="Order preserving map"
        drawer={
          new ManipulableDrawer(
            manipulableOrderPreserving,
            stateOrderPreserving1,
          )
        }
        height={260}
        padding={20}
      />
    ),
  },
  {
    id: "order-preserving-map-big",
    node: (
      <Demo
        id="order-preserving-map-big"
        title="Order preserving map (big)"
        drawer={
          new ManipulableDrawer(
            manipulableOrderPreserving,
            stateOrderPreserving2,
          )
        }
        height={500}
        padding={20}
      />
    ),
  },
  {
    id: "grid-polygon",
    node: (
      <Demo
        id="grid-polygon"
        title="Grid polygon"
        drawer={new ManipulableDrawer(manipulableGridPoly, stateGridPoly1)}
        height={250}
        padding={20}
      />
    ),
  },
  {
    id: "permutation",
    node: (
      <Demo
        id="permutation"
        title="Permutation"
        drawer={new ManipulableDrawer(manipulablePerm, statePerm1)}
        height={50}
        padding={10}
      />
    ),
  },
  {
    id: "permutation-of-permutations",
    node: (
      <Demo
        id="permutation-of-permutations"
        title="Permutation of permutations"
        drawer={new ManipulableDrawer(manipulablePermDouble, statePermDouble1)}
        height={200}
      />
    ),
  },
  {
    id: "inserting-removing-items-wip",
    node: (
      <Demo
        id="inserting-removing-items-wip"
        title="Inserting & removing items (WIP)"
        drawer={
          new ManipulableDrawer(
            manipulableInsertAndRemove,
            stateInsertAndRemove1,
          )
        }
        height={150}
        padding={10}
      />
    ),
  },
  {
    id: "nool-tree",
    node: (
      <Demo
        id="nool-tree"
        title="Nool tree"
        drawer={new ManipulableDrawer(manipulableNoolTree, stateNoolTree1)}
        height={350}
        padding={20}
        initialSnapRadius={1}
      />
    ),
  },
  {
    id: "nool-tree-simpler",
    node: (
      <Demo
        id="nool-tree-simpler"
        title="Nool tree, simpler"
        drawer={new ManipulableDrawer(manipulableNoolTree, stateNoolTree2)}
        height={200}
        padding={20}
        initialSnapRadius={1}
      />
    ),
  },
  {
    id: "sokoban-wip",
    node: (
      <Demo
        id="sokoban-wip"
        title="Sokoban (WIP)"
        drawer={new ManipulableDrawer(manipulableSokoban, stateSokoban1)}
        height={500}
        padding={20}
      />
    ),
  },
  {
    id: "simplest",
    node: (
      <Demo
        id="simplest"
        title="Simplest"
        drawer={new ManipulableDrawer(manipulableSimplest, stateSimplest1)}
        height={150}
        padding={20}
      />
    ),
  },
];
