import { ReactElement } from "react";
import { Demo } from "./Demo";
import { Angle } from "./demo-diagrams/angle";
import { AngleViaTransform } from "./demo-diagrams/angle-via-transform";
import { Bezier } from "./demo-diagrams/bezier";
import { Braid } from "./demo-diagrams/braid";
import { Clock } from "./demo-diagrams/clock";
import { Fifteen } from "./demo-diagrams/fifteen";
import { Graph } from "./demo-diagrams/graph";
import { GridPoly } from "./demo-diagrams/grid-poly";
import { InsertAndRemove } from "./demo-diagrams/insert-and-remove";
import { NoolTree } from "./demo-diagrams/nool-tree";
import { OrderPreserving } from "./demo-diagrams/order-preserving";
import { Outline } from "./demo-diagrams/outline";
import { Perm } from "./demo-diagrams/perm";
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
import { rotate, scale, translate } from "./manipulable";

export const demos: ReactElement[] = [
  <Demo
    id="simplest"
    title="Simplest"
    manipulable={Simplest.manipulable}
    initialState={Simplest.state1}
    height={100}
    padding={20}
    sourceFile="simplest.tsx"
  />,
  <Demo
    id="second-simplest"
    title="Second simplest"
    manipulable={SecondSimplest.manipulable}
    initialState={SecondSimplest.state1}
    height={200}
    padding={20}
    sourceFile="second-simplest.tsx"
  />,
  <Demo
    id="simplest-clicker"
    title="Simplest clicker"
    manipulable={SimplestClicker.manipulable}
    initialState={SimplestClicker.state1}
    height={200}
    padding={20}
    sourceFile="simplest-clicker.tsx"
  />,
  <Demo
    id="todo"
    title="Todo"
    manipulable={Todo.manipulable}
    initialState={Todo.state1}
    height={400}
    padding={20}
    sourceFile="todo.tsx"
  />,
  <Demo
    id="lonely-tile-on-a-grid"
    title="Lonely tile on a grid"
    notes="I'm trying to make dragging feel right here. Goal is for the tile to only drag orthogonally, AND to not jump discontinuously. This seems to require 'Relative Pointer Motion' mode (or divergent approaches)."
    manipulable={Tiles.manipulable}
    initialState={Tiles.stateLonely}
    height={300}
    padding={20}
    initialRelativePointerMotion={true}
    sourceFile="tiles.tsx"
  />,
  <Demo
    id="grid-polygon"
    title="Grid polygon"
    manipulable={GridPoly.manipulable}
    initialState={GridPoly.state1}
    height={300}
    padding={20}
    sourceFile="grid-poly.tsx"
  />,
  <Demo
    id="permutation"
    title="Permutation"
    manipulable={Perm.manipulable}
    initialState={Perm.state1}
    height={100}
    padding={15}
    sourceFile="perm.tsx"
  />,
  <Demo
    id="permutation-of-permutations"
    title="Permutation of permutations"
    manipulable={PermDouble.manipulable}
    initialState={PermDouble.state1}
    height={200}
    sourceFile="perm-double.tsx"
  />,
  <Demo
    id="spinny"
    title="Spinny"
    notes="Tests interpolation of rotations."
    manipulable={Spinny.manipulable}
    initialState={Spinny.state1}
    height={200}
    padding={30}
    initialRelativePointerMotion={false}
    sourceFile="spinny.tsx"
  />,
  <Demo
    id="nool-tree"
    title="Nool tree"
    manipulable={NoolTree.manipulable}
    initialState={NoolTree.state1}
    height={350}
    padding={20}
    initialSnapRadius={1}
    initialRelativePointerMotion={true}
    defaultConfig={NoolTree.defaultConfig}
    ConfigPanel={NoolTree.ConfigPanel}
    sourceFile="nool-tree.tsx"
  />,
  <Demo
    id="nool-tree-simpler"
    title="Nool tree, simpler"
    manipulable={NoolTree.manipulable}
    initialState={NoolTree.state2}
    height={200}
    padding={20}
    initialSnapRadius={1}
    initialRelativePointerMotion={true}
    defaultConfig={NoolTree.defaultConfig}
    ConfigPanel={NoolTree.ConfigPanel}
    sourceFile="nool-tree.tsx"
  />,
  <Demo
    id="tree-of-life"
    title="Tree of Life"
    manipulable={Outline.manipulable}
    initialState={Outline.stateTreeOfLife}
    height={1100}
    padding={20}
    initialSnapRadius={5}
    sourceFile="outline.tsx"
  />,
  <Demo
    id="graph"
    title="Graph"
    manipulable={Graph.manipulable}
    initialState={Graph.state1}
    height={160}
    padding={20}
    sourceFile="graph.tsx"
  />,
  <Demo
    id="angle"
    title="Angle"
    manipulable={Angle.manipulable}
    initialState={Angle.state1}
    height={200}
    padding={20}
    sourceFile="angle.tsx"
  />,
  <Demo
    id="angle-via-transform"
    title="Angle (via transform)"
    manipulable={AngleViaTransform.manipulable}
    initialState={AngleViaTransform.state1}
    height={200}
    padding={20}
    sourceFile="angle-via-transform.tsx"
  />,
  <Demo
    id="bezier"
    title="Bezier Curve Editor"
    notes={
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
    }
    manipulable={Bezier.manipulable}
    initialState={Bezier.state2}
    height={200}
    padding={20}
    sourceFile="bezier.tsx"
  />,
  <Demo
    id="stretchy-xy"
    title="Stretchy (xy)"
    initialState={{ scaleX: 1, scaleY: 1 }}
    manipulable={({ state: { scaleX, scaleY }, draggable }) => (
      <g>
        {draggable(
          <circle
            transform={translate(100, 100) + scale(scaleX, scaleY)}
            cx={0}
            cy={0}
            r={50}
            fill="lightblue"
          />,
          numsAtPaths([["scaleX"], ["scaleY"]])
        )}
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
    )}
    height={200}
    padding={20}
    sourceFile="demos.tsx"
  />,
  <Demo
    id="stretchy-rot"
    title="Stretchy (rot)"
    initialState={{ angle: 0, scaleX: 1 }}
    manipulable={({ state: { angle, scaleX }, draggable }) =>
      draggable(
        <circle
          transform={
            translate(100, 100) + rotate(angle) + scale(scaleX, 1 / scaleX)
          }
          cx={0}
          cy={0}
          r={50}
          fill="lightblue"
        />,
        numsAtPaths([["angle"], ["scaleX"]])
      )
    }
    height={200}
    padding={20}
    sourceFile="demos.tsx"
  />,
  <Demo
    id="clock"
    title="Clock"
    manipulable={Clock.manipulable}
    initialState={Clock.state1}
    height={200}
    padding={20}
    sourceFile="clock.tsx"
  />,
  <Demo
    id="braids"
    title="Braids"
    manipulable={Braid.manipulable}
    initialState={Braid.state1}
    height={400}
    padding={20}
    sourceFile="braid.tsx"
  />,
  <Demo
    id="order-preserving"
    title="Order-preserving maps (tree3 → tree3)"
    notes={
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
    }
    manipulable={OrderPreserving.manipulable}
    initialState={OrderPreserving.state3To3}
    height={400}
    padding={20}
    defaultConfig={{ ...OrderPreserving.defaultConfig, showTradRep: true }}
    ConfigPanel={OrderPreserving.ConfigPanel}
    sourceFile="order-preserving.tsx"
  />,
  <Demo
    id="order-preserving-large"
    title="Order-preserving maps (tree7 → tree7)"
    notes={
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
    }
    manipulable={OrderPreserving.manipulable}
    initialState={OrderPreserving.state7To7}
    height={700}
    padding={20}
    defaultConfig={OrderPreserving.defaultConfig}
    ConfigPanel={OrderPreserving.ConfigPanel}
    sourceFile="order-preserving.tsx"
  />,
  <Demo
    id="rush-hour"
    title="Rush Hour"
    manipulable={RushHour.manipulable}
    initialState={RushHour.state1}
    height={300}
    padding={20}
    defaultConfig={RushHour.defaultConfig}
    ConfigPanel={RushHour.ConfigPanel}
    sourceFile="rush-hour.tsx"
  />,
  <Demo
    id="15-puzzle"
    title="15 puzzle"
    notes="Weird experiment: I made the blank draggable"
    manipulable={Fifteen.manipulable}
    initialState={Fifteen.state1}
    height={200}
    padding={20}
    sourceFile="fifteen.tsx"
  />,
  <Demo
    id="inserting-removing-items"
    title="Inserting & removing items"
    notes="This shows kinda-hacky ways to insert and remove items from a draggable diagram. Much to consider."
    manipulable={InsertAndRemove.manipulable}
    initialState={InsertAndRemove.state1}
    height={150}
    padding={10}
    sourceFile="insert-and-remove.tsx"
  />,
  <Demo
    id="sokoban"
    title="Sokoban"
    manipulable={Sokoban.manipulable}
    initialState={Sokoban.state1}
    height={500}
    padding={20}
    initialRelativePointerMotion={true}
    defaultConfig={Sokoban.defaultConfig}
    ConfigPanel={Sokoban.ConfigPanel}
    sourceFile="sokoban.tsx"
  />,
];
