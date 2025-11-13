import { Delaunay } from "d3-delaunay";
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
import { assert, clamp } from "./utils";
import { Vec2 } from "./vec2";

/** A manipulable is a way of visualizing and interacting with
 * "state" (of some type T). */
export type Manipulable<T> = {
  render(state: T): Shape;
  accessibleFrom(state: T, draggableKey: string): AccessibleFromReturn<T>;
};

// TODO: think about this API
export type AccessibleFromReturn<T> = T[] | { manifolds: T[][] };

export type ManifoldPoint<T> = {
  state: T;
  shape: InterpolatableShape;
  offset: Vec2;
};

export type Manifold<T> = {
  points: ManifoldPoint<T>[];
  delaunay: Delaunay<Delaunay.Point>;
};

export class ManipulableDrawer<T> {
  private state:
    | {
        type: "idle";
        state: T;
      }
    | {
        type: "dragging";
        draggableKey: string;
        pointerOffset: Vec2;
        prevState: T;
        manifolds: Manifold<T>[];
        accessibleDeletionInfo: {
          state: T;
          shape: InterpolatableShape;
        } | null;
      };

  public config: { snapRadius: number; debugView: boolean };

  constructor(
    public manipulable: Manipulable<T>,
    state: T,
    config: Partial<typeof this.config> = {},
  ) {
    this.state = { type: "idle", state };
    this.config = { snapRadius: 20, debugView: false, ...config };
  }

  draw(lyr: Layer, pointer: IPointerManager): void {
    const state = this.state;
    const lyrDebug = layer(lyr);

    if (state.type === "dragging") {
      pointer.setCursor("grabbing");

      const { shapeToDraw, newState } = ((): {
        shapeToDraw: InterpolatableShape;
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
          if (this.config.debugView) {
            drawManifoldDebug(
              lyrDebug,
              proj.manifold,
              draggableDestPt,
              proj.projectedPt,
              this.config.snapRadius,
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
        if (state.accessibleDeletionInfo) {
          const deletionDist = bestManifoldProjection.dist;
          // console.log("deletionDist", deletionDist);
          if (deletionDist > 40) {
            const t = clamp((deletionDist - 40) / 20, 0, 1);
            return {
              shapeToDraw: lerpShapes(
                closestManifoldPt!.shape,
                state.accessibleDeletionInfo.shape,
                t,
              ),
              newState:
                t > 0.5
                  ? state.accessibleDeletionInfo.state
                  : closestManifoldPt!.state,
            };
          }
        }

        const newState = closestManifoldPt!.state;

        // check if it's time to snap
        if (
          bestManifoldProjection.projectedPt.dist(closestManifoldPt!.offset) <
          this.config.snapRadius
        ) {
          // TODO: maybe this should be optional?
          this.enterDraggingMode(
            newState,
            state.draggableKey,
            state.pointerOffset,
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
      drawInterpolatable(lyr, shapeToDraw);
      pointer.addPointerUpHandler(() => {
        this.state = { type: "idle", state: newState };
      });
    } else if (state.type === "idle") {
      pointer.setCursor("default");

      const orig = this.manipulable.render(state.state);
      const interpolatable = origToInterpolatable(orig);
      // console.log("interpol", interpolatable);
      drawInterpolatable(lyr, interpolatable, {
        pointer: pointer,
        onDragStart: (key, pointerOffset) => {
          this.enterDraggingMode(state.state, key, pointerOffset);
        },
      });
    }

    lyr.place(lyrDebug);
  }

  private enterDraggingMode(
    state: T,
    draggableKey: string,
    pointerOffset: Vec2,
  ) {
    const result = this.manipulable.accessibleFrom(state, draggableKey);
    const statesForManifolds = Array.isArray(result)
      ? [result]
      : result.manifolds;
    // TODO: I haven't thought about how manifolds work with deletions
    let accessibleDeletionInfo: {
      state: T;
      interpolatableShape: Shape;
    } | null = null;
    const manifolds = statesForManifolds.flatMap((statesForManifold) => {
      const points: ManifoldPoint<T>[] = statesForManifold.flatMap((state) => {
        const shape = origToInterpolatable(this.manipulable.render(state));
        const foundShape = shapeByKey(shape, draggableKey);
        if (foundShape) {
          return { state, shape, offset: foundShape.offset };
        } else {
          assert(!accessibleDeletionInfo, "Multiple deletions found");
          accessibleDeletionInfo = { state, interpolatableShape: shape };
          return [];
        }
      });
      const delaunay = Delaunay.from(points.map((info) => info.offset.arr()));
      return { points, delaunay };
    });
    this.state = {
      type: "dragging",
      draggableKey,
      pointerOffset,
      prevState: state,
      manifolds,
      accessibleDeletionInfo,
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
