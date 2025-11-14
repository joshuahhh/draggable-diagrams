import { Delaunay } from "d3-delaunay";
import { easeElastic } from "d3-ease";
import _ from "lodash";
import { projectOntoConvexHull } from "./delaunay";
import { layer, Layer } from "./layer";
import { IPointerManager } from "./pointer";
import {
  drawInterpolatable,
  InterpolatableShape,
  lerpShapes,
  lerpShapes3,
  origToInterpolatable,
  Shape,
  shapeByKey,
} from "./shape";
import { assert, pipe } from "./utils";
import { Vec2 } from "./vec2";

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
  ): Shape;
  accessibleFrom(
    state: T,
    draggableKey: string,
    config: ManipulableConfig,
  ): AccessibleFromReturn<T>;
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

/**
 * accessibleFrom returns one or more "manifolds" – sets of states
 * that can be interpolated between continuously by dragging. Either
 * directly return one manifold, or an object with multiple
 * manifolds. Either way, note that a manifold can either return the
 * starting state or not, as is convenient – in either case the
 * starting state will be considered part of all manifolds.
 *
 * Note: So far, there only seem to be two patterns – either return a
 * single manifold, or a bunch of manifolds each going to a single
 * new state. Hmm.
 */
export type AccessibleFromReturn<T> = T[] | { manifolds: T[][] };

export type ManifoldPoint<T> = {
  state: T;
  shape: InterpolatableShape;
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
        type: "animating";
        startShape: InterpolatableShape;
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
      animationDuration: number;
    },
    manipulableConfig: Config,
  ): void {
    const state = this.state;
    const lyrDebug = layer(lyr);

    if (state.type === "dragging") {
      pointer.setCursor("grabbing");

      const { shapeToDraw, newState } = ((): {
        shapeToDraw?: InterpolatableShape;
        newState: T;
      } => {
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

        const newState = closestManifoldPt!.state;

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
          return { shapeToDraw: closestManifoldPt!.shape, newState };
        }

        if (bestManifoldProjection.type === "vertex") {
          const { ptIdx } = bestManifoldProjection;
          return {
            shapeToDraw: bestManifoldProjection.manifold.points[ptIdx].shape,
            newState,
          };
        } else if (bestManifoldProjection.type === "edge") {
          const { ptIdx0, ptIdx1, t } = bestManifoldProjection;
          return {
            shapeToDraw: lerpShapes(
              bestManifoldProjection.manifold.points[ptIdx0].shape,
              bestManifoldProjection.manifold.points[ptIdx1].shape,
              t,
            ),
            newState,
          };
        } else {
          const { ptIdx0, ptIdx1, ptIdx2, barycentric } =
            bestManifoldProjection;
          return {
            shapeToDraw: lerpShapes3(
              bestManifoldProjection.manifold.points[ptIdx0].shape,
              bestManifoldProjection.manifold.points[ptIdx1].shape,
              bestManifoldProjection.manifold.points[ptIdx2].shape,
              barycentric,
            ),
            newState,
          };
        }
      })();
      if (shapeToDraw) drawInterpolatable(lyr, shapeToDraw);
      pointer.addPointerUpHandler(() => {
        if (shapeToDraw) {
          this.state = {
            type: "animating",
            startShape: shapeToDraw,
            targetState: newState,
            startTime: Date.now(),
            duration: drawerConfig.animationDuration,
          };
        } else {
          this.state = { type: "idle", state: newState };
        }
      });
    } else if (state.type === "animating") {
      pointer.setCursor("default");

      const now = Date.now();
      const elapsed = now - state.startTime;
      const progress = Math.min(elapsed / state.duration, 1);
      const easedProgress = easeElastic(progress);

      const targetShape = origToInterpolatable(
        this.manipulable.render(state.targetState, null, manipulableConfig),
      );
      const interpolatedShape = lerpShapes(
        state.startShape,
        targetShape,
        easedProgress,
      );

      drawInterpolatable(lyr, interpolatedShape);

      if (progress >= 1) {
        this.state = { type: "idle", state: state.targetState };
      }
    } else if (state.type === "idle") {
      pointer.setCursor("default");

      const orig = this.manipulable.render(
        state.state,
        null,
        manipulableConfig,
      );
      const interpolatable = origToInterpolatable(orig);
      drawInterpolatable(lyr, interpolatable, {
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
    }

    lyr.place(lyrDebug);
  }

  private enterDraggingMode(
    state: T,
    draggableKey: string,
    pointerOffset: Vec2,
    manipulableConfig: Config,
  ) {
    const statesForManifolds = pipe(
      this.manipulable.accessibleFrom(state, draggableKey, manipulableConfig),
      (r) => (Array.isArray(r) ? [r] : r.manifolds),
    );

    const makeManifoldPoint = (state: T): ManifoldPoint<T> => {
      const shape = origToInterpolatable(
        this.manipulable.render(state, draggableKey, manipulableConfig),
      );
      const foundShape = shapeByKey(shape, draggableKey);
      assert(!!foundShape, "Draggable key not found in rendered shape");
      return { state, shape, offset: foundShape.offset };
    };

    const startingPoint = makeManifoldPoint(state);

    const manifolds = statesForManifolds.map((statesForManifold) => {
      const points = [
        startingPoint,
        ...statesForManifold
          .filter((s) => !_.isEqual(s, state))
          .map((state) => makeManifoldPoint(state)),
      ];
      const delaunay = Delaunay.from(points.map((info) => info.offset.arr()));
      return { points, delaunay };
    });
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
