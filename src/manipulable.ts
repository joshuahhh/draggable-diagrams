import { Delaunay } from "d3-delaunay";
import { easeElastic } from "d3-ease";
import _ from "lodash";
import { projectOntoConvexHull } from "./delaunay";
import { layer, Layer } from "./layer";
import { IPointerManager } from "./pointer";
import {
  Diagram,
  drawDiagram,
  flatShapeByDraggableKey,
  lerpDiagrams,
  lerpDiagrams3,
} from "./shape";
import { assert, assertNever, hasKey, Many, manyToArray, pipe } from "./utils";
import { Vec2 } from "./vec2";
// @ts-ignore
import { minimize } from "./minimize";
import { getAtPath, PathIn, setAtPath } from "./paths";

/** A manipulable is a way of visualizing and interacting with
 * "state" (of some type T).
 *
 * I'm sorry for the type-tomfoolery here. ManipulableBase is the
 * real spiritual core of the whole thing. Then there are some
 * shenanigans for config-dependence that should get cleverly
 * simplified someday.
 */
export type Manipulable<T, ManipulableConfig = undefined> = [
  ManipulableConfig,
] extends [undefined]
  ? ManipulableBase<T, ManipulableConfig>
  : ManipulableWithConfig<T, ManipulableConfig>;

export type ManipulableBase<T, ManipulableConfig> = {
  render(
    state: T,
    draggableKey: string | null,
    config: ManipulableConfig,
  ): Diagram;
  onDrag(
    state: T,
    draggableKey: string,
    config: ManipulableConfig,
  ): DragSpec<T>;
  cleanTransientState?(state: T): T;
  sourceFile?: string;
};

export type ManipulableWithConfig<T, ManipulableConfig> = ManipulableBase<
  T,
  ManipulableConfig
> & {
  defaultConfig: ManipulableConfig;
  renderConfig: (
    config: ManipulableConfig,
    setConfig: (config: ManipulableConfig) => void,
  ) => React.ReactNode;
};

export function hasConfig<T, ManipulableConfig>(
  manipulable: Manipulable<T, ManipulableConfig>,
): manipulable is ManipulableWithConfig<T, ManipulableConfig> {
  return (manipulable as any).defaultConfig !== undefined;
}

export function manipulableDefaultConfig<T, ManipulableConfig>(
  manipulable: Manipulable<T, ManipulableConfig>,
): ManipulableConfig {
  // this is totally well-typed I swear
  return (manipulable as any).defaultConfig;
}

// TODO: more sophisticated combos
export type DragSpec<T> = Many<DragSpecManifold<T>> | DragSpecParams<T>;

export type DragSpecManifold<T> = { type: "manifold"; states: T[] };

export type DragSpecParams<T> =
  | { type: "param-paths"; paramPaths: PathIn<T, number>[] }
  | {
      type: "params";
      initParams: number[];
      stateFromParams: (...params: number[]) => T;
    };

export function span<T>(...manyStates: Many<T>[]): DragSpecManifold<T> {
  return { type: "manifold", states: manyToArray(manyStates) };
}
export function straightTo<T>(state: T): DragSpecManifold<T> {
  return { type: "manifold", states: [state] };
}
export function params<T>(
  initParams: number[],
  stateFromParams: (...params: number[]) => T,
): DragSpecParams<T> {
  return { type: "params", initParams, stateFromParams };
}
export function numsAtPaths<T>(
  paramPaths: PathIn<T, number>[],
): DragSpecParams<T> {
  return { type: "param-paths", paramPaths };
}
export function numAtPath<T>(paramPath: PathIn<T, number>): DragSpecParams<T> {
  return { type: "param-paths", paramPaths: [paramPath] };
}

export type Path = (string | number)[];

export type ManifoldPoint<T> = {
  state: T;
  diagram: Diagram;
  offset: Vec2;
};

export type Manifold<T> = {
  // .points[0] is always the starting point
  points: ManifoldPoint<T>[];
  // points in .delaunay are indexed parallel to .points
  delaunay: Delaunay<Delaunay.Point>;
};

export class ManipulableDrawer<T, Config = unknown> {
  private state:
    | {
        type: "idle";
        state: T;
      }
    | {
        type: "dragging";
        draggableKey: string;
        pointerOffset: Vec2;
        startingPoint: ManifoldPoint<T>;
        manifolds: Manifold<T>[];
        // TODO: handle deletion
        // accessibleDeletionInfo: {
        //   state: T;
        //   shape: InterpolatableShape;
        // } | null;
      }
    | {
        type: "dragging-params";
        draggableKey: string;
        pointerOffset: Vec2;
        curParams: number[];
        stateFromParams: (...params: number[]) => T;
      }
    | {
        type: "animating";
        startDiagram: Diagram;
        targetState: T;
        startTime: number;
        duration: number;
      };

  constructor(
    public manipulable: Manipulable<T, Config>,
    state: T,
  ) {
    this.state = { type: "idle", state };
  }

  draw(
    lyr: Layer,
    pointer: IPointerManager,
    drawerConfig: {
      snapRadius: number;
      debugView: boolean;
      transitionWhileDragging: boolean;
      relativePointerMotion: boolean;
      animationDuration: number;
    },
    manipulableConfig: Config,
  ): void {
    const state = this.state;
    const lyrDebug = layer(lyr);

    if (state.type === "dragging") {
      pointer.setCursor("grabbing");

      const { diagramToDraw, newState } = pipe(null, () => {
        const draggableDestPt = pointer.dragPointer!.sub(state.pointerOffset);

        const manifoldProjections = state.manifolds.map((manifold) => {
          return {
            ...projectOntoConvexHull(manifold.delaunay, draggableDestPt),
            manifold,
          };
        });
        manifoldProjections.forEach((proj) => {
          if (drawerConfig.debugView) {
            drawManifoldDebug(
              lyrDebug,
              proj.manifold,
              draggableDestPt,
              proj.projectedPt,
              drawerConfig.snapRadius,
            );
          }
        });
        const bestManifoldProjection = _.minBy(
          manifoldProjections,
          (proj) => proj.dist,
        )!;

        if (drawerConfig.relativePointerMotion) {
          state.pointerOffset = pointer.dragPointer!.sub(
            bestManifoldProjection.projectedPt,
          );
        }

        const closestManifoldPt = _.minBy(
          state.manifolds.flatMap((m) => m.points),
          (info) => draggableDestPt.dist(info.offset),
        )!;

        // check if it's time to delete
        // TODO: make this work better lol
        // if (state.accessibleDeletionInfo) {
        //   const deletionDist = bestManifoldProjection.dist;
        //   if (deletionDist > 40) {
        //     const t = clamp((deletionDist - 40) / 20, 0, 1);
        //     return {
        //       shapeToDraw: lerpShapes(
        //         closestManifoldPt!.shape,
        //         state.accessibleDeletionInfo.shape,
        //         t,
        //       ),
        //       newState:
        //         t > 0.5
        //           ? state.accessibleDeletionInfo.state
        //           : closestManifoldPt!.state,
        //     };
        //   }
        // }

        const newState = pipe(
          closestManifoldPt!.state,
          (s) => this.manipulable.cleanTransientState?.(s) ?? s,
        );

        // check if it's time to snap
        if (
          drawerConfig.transitionWhileDragging &&
          bestManifoldProjection.projectedPt.dist(closestManifoldPt!.offset) <
            drawerConfig.snapRadius
        ) {
          this.enterDraggingMode(
            newState,
            state.draggableKey,
            state.pointerOffset,
            manipulableConfig,
          );
          return { diagramToDraw: closestManifoldPt!.diagram, newState };
        }

        if (bestManifoldProjection.type === "vertex") {
          const { ptIdx } = bestManifoldProjection;
          return {
            diagramToDraw:
              bestManifoldProjection.manifold.points[ptIdx].diagram,
            newState,
          };
        } else if (bestManifoldProjection.type === "edge") {
          const { ptIdx0, ptIdx1, t } = bestManifoldProjection;
          // console.log(
          //   "case: edge",
          //   bestManifoldProjection.manifold.points[ptIdx0].diagram,
          //   bestManifoldProjection.manifold.points[ptIdx1].diagram,
          // );
          return {
            diagramToDraw: lerpDiagrams(
              bestManifoldProjection.manifold.points[ptIdx0].diagram,
              bestManifoldProjection.manifold.points[ptIdx1].diagram,
              t,
            ),
            newState,
          };
        } else {
          const { ptIdx0, ptIdx1, ptIdx2, barycentric } =
            bestManifoldProjection;
          return {
            diagramToDraw: lerpDiagrams3(
              bestManifoldProjection.manifold.points[ptIdx0].diagram,
              bestManifoldProjection.manifold.points[ptIdx1].diagram,
              bestManifoldProjection.manifold.points[ptIdx2].diagram,
              barycentric,
            ),
            newState,
          };
        }
      });
      if (diagramToDraw) drawDiagram(diagramToDraw, lyr);
      pointer.addPointerUpHandler(() => {
        if (diagramToDraw) {
          this.state = {
            type: "animating",
            startDiagram: diagramToDraw,
            targetState: newState,
            startTime: Date.now(),
            duration: drawerConfig.animationDuration,
          };
        } else {
          this.state = { type: "idle", state: newState };
        }
      });
    } else if (state.type === "dragging-params") {
      pointer.setCursor("grabbing");
      const draggableDestPt = pointer.dragPointer!.sub(state.pointerOffset);

      // TODO: would be nice to save this fn, but it varies with
      // draggableDestPt
      const objectiveFn = (params: number[]) => {
        const candidateState = state.stateFromParams(...params);
        const diagram = this.manipulable.render(
          candidateState,
          state.draggableKey,
          manipulableConfig,
        );
        const foundShape = flatShapeByDraggableKey(diagram, state.draggableKey);
        assert(!!foundShape, "Draggable key not found in rendered shape");
        return draggableDestPt.dist2(foundShape.transform);
      };

      const r = minimize(objectiveFn, state.curParams);
      state.curParams = r.solution;

      const newState = state.stateFromParams(...state.curParams);
      const diagram = this.manipulable.render(
        newState,
        state.draggableKey,
        manipulableConfig,
      );
      drawDiagram(diagram, lyr);

      pointer.addPointerUpHandler(() => {
        this.state = { type: "idle", state: newState };
      });
    } else if (state.type === "animating") {
      pointer.setCursor("default");

      const now = Date.now();
      const elapsed = now - state.startTime;
      const progress = Math.min(elapsed / state.duration, 1);
      const easedProgress = easeElastic(progress);

      const targetDiagram = this.manipulable.render(
        state.targetState,
        null,
        manipulableConfig,
      );
      const interpolatedDiagram = lerpDiagrams(
        state.startDiagram,
        targetDiagram,
        easedProgress,
      );

      drawDiagram(interpolatedDiagram, lyr);

      if (progress >= 1) {
        this.state = { type: "idle", state: state.targetState };
      }
    } else if (state.type === "idle") {
      pointer.setCursor("default");

      const diagram = this.manipulable.render(
        state.state,
        null,
        manipulableConfig,
      );
      drawDiagram(diagram, lyr, {
        pointer: pointer,
        onDragStart: (key, pointerOffset) => {
          this.enterDraggingMode(
            state.state,
            key,
            pointerOffset,
            manipulableConfig,
          );
        },
      });
    } else {
      assertNever(state);
    }

    lyr.place(lyrDebug);
  }

  private enterDraggingMode(
    state: T,
    draggableKey: string,
    pointerOffset: Vec2,
    manipulableConfig: Config,
  ) {
    // first check if the draggable has been removed from the diagram
    // TODO: perf?
    const diagram = this.manipulable.render(
      state,
      draggableKey,
      manipulableConfig,
    );
    if (!flatShapeByDraggableKey(diagram, draggableKey)) {
      this.state = { type: "idle", state };
      return;
    }

    const dragSpec = this.manipulable.onDrag(
      state,
      draggableKey,
      manipulableConfig,
    );

    if (hasKey(dragSpec, "initParams")) {
      this.state = {
        type: "dragging-params",
        draggableKey,
        pointerOffset,
        curParams: dragSpec.initParams,
        stateFromParams: dragSpec.stateFromParams,
      };
      return;
    }

    if (hasKey(dragSpec, "paramPaths")) {
      this.state = {
        type: "dragging-params",
        draggableKey,
        pointerOffset,
        curParams: dragSpec.paramPaths.map((path) => getAtPath(state, path)),
        stateFromParams: (...params: number[]) => {
          let newState = state;
          dragSpec.paramPaths.forEach((path, idx) => {
            newState = setAtPath(newState, path, params[idx]);
          });
          return newState;
        },
      };
      return;
    }

    const manifoldSpecs = manyToArray(dragSpec);

    const makeManifoldPoint = (state: T): ManifoldPoint<T> => {
      const diagram = this.manipulable.render(
        state,
        draggableKey,
        manipulableConfig,
      );
      const foundFlatShape = flatShapeByDraggableKey(diagram, draggableKey);
      assert(!!foundFlatShape, "Draggable key not found in rendered shape");
      return { state, diagram, offset: foundFlatShape.transform };
    };

    const startingPoint = makeManifoldPoint(state);

    const manifolds = manifoldSpecs.map(({ states }) => {
      const points = [
        startingPoint,
        ...states
          .filter((s) => !_.isEqual(s, state))
          .map((state) => makeManifoldPoint(state)),
      ];
      const delaunay = Delaunay.from(points.map((info) => info.offset.arr()));
      return { points, delaunay };
    });
    // console.log("manifolds:", manifolds);
    this.state = {
      type: "dragging",
      draggableKey,
      pointerOffset,
      startingPoint,
      manifolds,
    };
  }
}

function drawManifoldDebug(
  lyrDebug: Layer,
  manifold: Manifold<unknown>,
  draggableDestPt: Vec2,
  projectedDestPt: Vec2,
  snapRadius: number,
) {
  for (const { offset } of manifold.points) {
    lyrDebug.do(() => {
      lyrDebug.beginPath();
      lyrDebug.arc(...offset.arr(), snapRadius, 0, 2 * Math.PI);
      lyrDebug.fillStyle = "red";
      lyrDebug.fill();
    });
  }

  lyrDebug.do(() => {
    lyrDebug.strokeStyle = "red";
    lyrDebug.lineWidth = 2;
    const { triangles, points } = manifold.delaunay;
    for (let i = 0; i < triangles.length; i += 3) {
      const ax = points[2 * triangles[i]];
      const ay = points[2 * triangles[i] + 1];
      const bx = points[2 * triangles[i + 1]];
      const by = points[2 * triangles[i + 1] + 1];
      const cx = points[2 * triangles[i + 2]];
      const cy = points[2 * triangles[i + 2] + 1];
      lyrDebug.beginPath();
      lyrDebug.moveTo(ax, ay);
      lyrDebug.lineTo(bx, by);
      lyrDebug.lineTo(cx, cy);
      lyrDebug.lineTo(ax, ay);
      lyrDebug.stroke();
    }
  });

  lyrDebug.do(() => {
    lyrDebug.strokeStyle = "blue";
    lyrDebug.lineWidth = 2;
    lyrDebug.beginPath();
    lyrDebug.arc(...projectedDestPt.arr(), 10, 0, 2 * Math.PI);
    lyrDebug.stroke();
    // draw line to projection
    lyrDebug.beginPath();
    lyrDebug.moveTo(...draggableDestPt.arr());
    lyrDebug.lineTo(...projectedDestPt.arr());
    lyrDebug.stroke();
  });
}
