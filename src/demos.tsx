import { ReactElement } from "react";
import { Demo } from "./components/Demo";
import { DemoSvg } from "./components/DemoSvg";
import { numsAtPaths, straightTo } from "./DragSpec";
import { manipulableAngle, stateAngle } from "./manipulable-angle";
import { manipulableAngleSvg } from "./manipulable-angle-svg";
import { manipulableAngleViaTransform } from "./manipulable-angle-via-transform";
import {
  manipulableAngleViaTransformSvg,
  stateAngleViaTransformSvg,
} from "./manipulable-angle-via-transform-svg";
import { manipulableBraid } from "./manipulable-braid";
import { manipulableClock, stateClock } from "./manipulable-clock";
import { manipulableClockSvg, stateClockSvg } from "./manipulable-clock-svg";
import { manipulableFifteen, stateFifteen } from "./manipulable-fifteen";
import { manipulableFlippy, stateFlippy1 } from "./manipulable-flippy";
import { manipulableGraph, stateGraph } from "./manipulable-graph";
import { manipulableGraphSvg, stateGraphSvg } from "./manipulable-graph-svg";
import { manipulableGridPoly, stateGridPoly1 } from "./manipulable-grid-poly";
import { manipulableGridPolySvg } from "./manipulable-grid-poly-svg";
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
  ConfigPanelNoolTree,
  defaultConfigNool,
  manipulableNoolTreeSvg,
  stateNoolTreeSvg1,
  stateNoolTreeSvg2,
} from "./manipulable-nool-tree-svg";
import {
  manipulableOrderPreserving,
  stateOrderPreserving1,
  stateOrderPreserving2,
} from "./manipulable-order-preserving";
import { manipulableOutline, stateOutline1 } from "./manipulable-outline";
import {
  manipulableOutlineSvg,
  stateOutline1 as stateOutline1Svg,
  stateOutlineTreeOfLife,
} from "./manipulable-outline-svg";
import { manipulablePerm, statePerm1 } from "./manipulable-perm";
import {
  manipulablePermDouble,
  statePermDouble1,
} from "./manipulable-perm-double";
import { manipulablePermDoubleSvg } from "./manipulable-perm-double-svg";
import { manipulablePermSvg } from "./manipulable-perm-svg";
import { manipulableRushHour, stateRushHour1 } from "./manipulable-rush-hour";
import {
  manipulableSecondSimplest,
  stateSecondSimplest1,
} from "./manipulable-second-simplest";
import {
  manipulableSecondSimplestSvg,
  stateSecondSimplestSvg,
} from "./manipulable-second-simplest-svg";
import { manipulableSimplest, stateSimplest1 } from "./manipulable-simplest";
import {
  manipulableSimplestClickerSvg,
  stateSimplestClickerSvg,
} from "./manipulable-simplest-clicker";
import { manipulableSokoban, stateSokoban1 } from "./manipulable-sokoban";
import { manipulableSpinny } from "./manipulable-spinny";
import { manipulableSpinnyOld, stateSpinny1 } from "./manipulable-spinny-old";
import {
  manipulableSpinnySvg,
  stateSpinny1 as stateSpinny1Svg,
} from "./manipulable-spinny-svg";
import { rotate, scale, translate } from "./manipulable-svg";
import { manipulableTiles, stateTilesLonely } from "./manipulable-tiles";
import { manipulableTilesSvg } from "./manipulable-tiles-svg";
import { manipulableTodo, stateTodo1 } from "./manipulable-todo";

export const demos: ReactElement[] = [
  <Demo
    id="simplest"
    title="Simplest"
    manipulable={manipulableSimplest}
    initialState={stateSimplest1}
    height={100}
    padding={20}
  />,
  <Demo
    id="second-simplest"
    title="Second simplest"
    manipulable={manipulableSecondSimplest}
    initialState={stateSecondSimplest1}
    height={120}
    padding={20}
  />,
  <DemoSvg
    id="second-simplest-svg"
    title="Second simplest (SVG)"
    manipulableSvg={manipulableSecondSimplestSvg}
    initialState={stateSecondSimplestSvg}
    height={200}
    padding={20}
  />,
  <DemoSvg
    id="second-simplest-svg-on-drag"
    title="Second simplest (SVG, as data-on-drag)"
    initialState={{ value: 0 }}
    manipulableSvg={({ state, drag }) => (
      <rect
        id="switch"
        transform={translate(state.value * 100, 20 * (-1) ** state.value + 20)}
        x={0}
        y={0}
        width={100}
        height={100}
        data-on-drag={drag(() => [
          state.value > 0 && straightTo({ value: state.value - 1 }),
          state.value < 3 && straightTo({ value: state.value + 1 }),
        ])}
      />
    )}
    height={200}
    padding={20}
  />,
  <DemoSvg
    id="simplest-clicker-svg"
    title="Simplest clicker (SVG)"
    manipulableSvg={manipulableSimplestClickerSvg}
    initialState={stateSimplestClickerSvg}
    height={200}
    padding={20}
  />,
  <DemoSvg
    id="todo"
    title="Todo"
    manipulableSvg={manipulableTodo}
    initialState={stateTodo1}
    height={400}
    padding={20}
  />,
  <Demo
    id="order-preserving-map"
    title="Order preserving map"
    manipulable={manipulableOrderPreserving}
    initialState={stateOrderPreserving1}
    height={400}
    padding={20}
  />,
  <Demo
    id="order-preserving-map-big"
    title="Order preserving map (big)"
    manipulable={manipulableOrderPreserving}
    initialState={stateOrderPreserving2}
    height={650}
    padding={20}
  />,
  <Demo
    id="rush-hour"
    title="Rush Hour"
    manipulable={manipulableRushHour}
    initialState={stateRushHour1}
    height={300}
    padding={20}
  />,
  <Demo
    id="15-puzzle"
    title="15 puzzle"
    notes="Weird experiment: I made the blank draggable"
    manipulable={manipulableFifteen}
    initialState={stateFifteen}
    height={200}
    padding={20}
    initialRelativePointerMotion={true}
  />,
  <Demo
    id="lonely-tile-on-a-grid"
    title="Lonely tile on a grid"
    notes="I'm trying to make dragging feel right here. Goal is for the tile to only drag orthogonally, AND to not jump discontinuously. This seems to require 'Relative Pointer Motion' mode (or divergent approaches)."
    manipulable={manipulableTiles}
    initialState={stateTilesLonely}
    height={300}
    padding={20}
    initialRelativePointerMotion={true}
  />,
  <DemoSvg
    id="lonely-tile-on-a-grid-svg"
    title="Lonely tile on a grid (SVG)"
    notes="I'm trying to make dragging feel right here. Goal is for the tile to only drag orthogonally, AND to not jump discontinuously. This seems to require 'Relative Pointer Motion' mode (or divergent approaches)."
    manipulableSvg={manipulableTilesSvg}
    initialState={stateTilesLonely}
    height={300}
    padding={20}
    initialRelativePointerMotion={true}
  />,
  <Demo
    id="grid-polygon"
    title="Grid polygon"
    manipulable={manipulableGridPoly}
    initialState={stateGridPoly1}
    height={250}
    padding={20}
  />,
  <DemoSvg
    id="grid-polygon-svg"
    title="Grid polygon (SVG)"
    manipulableSvg={manipulableGridPolySvg}
    initialState={stateGridPoly1}
    height={300}
    padding={20}
  />,
  <Demo
    id="permutation"
    title="Permutation"
    manipulable={manipulablePerm}
    initialState={statePerm1}
    height={50}
    padding={15}
  />,
  <DemoSvg
    id="permutation-svg"
    title="Permutation (SVG)"
    manipulableSvg={manipulablePermSvg}
    initialState={statePerm1}
    height={100}
    padding={15}
  />,
  <Demo
    id="permutation-of-permutations"
    title="Permutation of permutations"
    manipulable={manipulablePermDouble}
    initialState={statePermDouble1}
    height={200}
  />,
  <DemoSvg
    id="permutation-of-permutations-svg"
    title="Permutation of permutations (SVG)"
    manipulableSvg={manipulablePermDoubleSvg}
    initialState={statePermDouble1}
    height={200}
  />,
  <Demo
    id="spinny"
    title="Spinny"
    manipulable={manipulableSpinny}
    initialState={stateSpinny1}
    height={200}
    padding={30}
    initialRelativePointerMotion={false}
  />,
  <DemoSvg
    id="spinny-svg"
    title="Spinny (SVG)"
    manipulableSvg={manipulableSpinnySvg}
    initialState={stateSpinny1Svg}
    height={200}
    padding={30}
    initialRelativePointerMotion={false}
  />,
  <Demo
    id="spinny-old"
    title="Spinny (Old)"
    manipulable={manipulableSpinnyOld}
    initialState={stateSpinny1}
    height={200}
    padding={30}
    initialRelativePointerMotion={false}
  />,
  <Demo
    id="flippy"
    title="Flippy"
    manipulable={manipulableFlippy}
    initialState={stateFlippy1}
    height={200}
    padding={30}
    initialChainDrags={false}
    initialRelativePointerMotion={false}
  />,
  <Demo
    id="inserting-removing-items"
    title="Inserting & removing items"
    manipulable={manipulableInsertAndRemove}
    initialState={stateInsertAndRemove1}
    height={150}
    padding={10}
  />,
  <Demo
    id="nool-tree"
    title="Nool tree"
    manipulable={manipulableNoolTree}
    initialState={stateNoolTree1}
    height={350}
    padding={20}
    initialSnapRadius={1}
    initialRelativePointerMotion={true}
  />,
  <Demo
    id="nool-tree-simpler"
    title="Nool tree, simpler"
    manipulable={manipulableNoolTree}
    initialState={stateNoolTree2}
    height={200}
    padding={20}
    initialSnapRadius={1}
    initialRelativePointerMotion={true}
  />,
  <DemoSvg
    id="nool-tree-svg"
    title="Nool tree (SVG)"
    manipulableSvg={manipulableNoolTreeSvg}
    initialState={stateNoolTreeSvg1}
    height={350}
    padding={20}
    initialSnapRadius={1}
    initialRelativePointerMotion={true}
    defaultConfig={defaultConfigNool}
    ConfigPanel={ConfigPanelNoolTree}
  />,
  <DemoSvg
    id="nool-tree-simpler-svg"
    title="Nool tree, simpler (SVG)"
    manipulableSvg={manipulableNoolTreeSvg}
    initialState={stateNoolTreeSvg2}
    height={200}
    padding={20}
    initialSnapRadius={1}
    initialRelativePointerMotion={true}
    defaultConfig={defaultConfigNool}
    ConfigPanel={ConfigPanelNoolTree}
  />,
  <Demo
    id="outline"
    title="Outline"
    manipulable={manipulableOutline}
    initialState={stateOutline1}
    height={400}
    padding={20}
    initialSnapRadius={5}
  />,
  <DemoSvg
    id="outline-svg"
    title="Outline (SVG)"
    manipulableSvg={manipulableOutlineSvg}
    initialState={stateOutline1Svg}
    height={400}
    padding={20}
    initialSnapRadius={5}
  />,
  <DemoSvg
    id="tree-of-life"
    title="Tree of Life"
    manipulableSvg={manipulableOutlineSvg}
    initialState={stateOutlineTreeOfLife}
    height={1100}
    padding={20}
    initialSnapRadius={5}
  />,
  <Demo
    id="sokoban"
    title="Sokoban"
    manipulable={manipulableSokoban}
    initialState={stateSokoban1}
    height={500}
    padding={20}
    initialRelativePointerMotion={true}
  />,
  <Demo
    id="graph"
    title="Graph"
    manipulable={manipulableGraph}
    initialState={stateGraph}
    height={200}
    padding={20}
  />,
  <DemoSvg
    id="graph-svg"
    title="Graph (SVG)"
    manipulableSvg={manipulableGraphSvg}
    initialState={stateGraphSvg}
    height={200}
    padding={20}
  />,
  <Demo
    id="angle"
    title="Angle"
    manipulable={manipulableAngle}
    initialState={stateAngle}
    height={200}
    padding={20}
  />,
  <DemoSvg
    id="angle-svg"
    title="Angle (SVG)"
    manipulableSvg={manipulableAngleSvg}
    initialState={stateAngle}
    height={200}
    padding={20}
  />,
  <Demo
    id="angle-via-transform"
    title="Angle (via transform)"
    manipulable={manipulableAngleViaTransform}
    initialState={stateAngle}
    height={200}
    padding={20}
  />,
  <DemoSvg
    id="angle-via-transform-svg"
    title="Angle (via transform, SVG)"
    manipulableSvg={manipulableAngleViaTransformSvg}
    initialState={stateAngleViaTransformSvg}
    height={200}
    padding={20}
  />,
  <DemoSvg
    id="stretchy-xy"
    title="Stretchy (xy)"
    initialState={{ scaleX: 1, scaleY: 1 }}
    manipulableSvg={({ state: { scaleX, scaleY }, draggable }) => (
      <g>
        {draggable(
          <circle
            transform={translate(100, 100) + scale(scaleX, scaleY)}
            cx={0}
            cy={0}
            r={50}
            fill="lightblue"
          />,
          numsAtPaths([["scaleX"], ["scaleY"]]),
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
  />,
  <DemoSvg
    id="stretchy-rot"
    title="Stretchy (rot)"
    initialState={{ angle: 0, scaleX: 1 }}
    manipulableSvg={({ state: { angle, scaleX }, draggable }) =>
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
        numsAtPaths([["angle"], ["scaleX"]]),
      )
    }
    height={200}
    padding={20}
  />,
  <Demo
    id="clock"
    title="Clock"
    manipulable={manipulableClock}
    initialState={stateClock}
    height={200}
    padding={20}
  />,
  <DemoSvg
    id="clock-svg"
    title="Clock (SVG)"
    manipulableSvg={manipulableClockSvg}
    initialState={stateClockSvg}
    height={200}
    padding={20}
  />,
  <DemoSvg
    id="braids"
    title="Braids"
    manipulableSvg={manipulableBraid}
    initialState={{ n: 2, seq: [] as const, buds: true }}
    height={200}
    padding={20}
  />,
];
