import _ from "lodash";
import { SVGProps, cloneElement } from "react";
import { Manipulable, unsafeDrag } from "./manipulable2";
import { Delaunay } from "./math/delaunay";
import { minimize } from "./math/minimize";
import { Vec2 } from "./math/vec2";
import { PathIn, getAtPath, setAtPath } from "./paths";
import { translate } from "./svgx/helpers";
import {
  LayeredSvgx,
  accumulateTransforms,
  findByPathInLayered,
  getAccumulatedTransform,
  layerSvg,
  layeredExtract,
  layeredMerge,
  layeredSetAttributes,
  layeredShiftZIndices,
  layeredTransform,
} from "./svgx/layers";
import { lerpLayered, lerpLayered3 } from "./svgx/lerp";
import { assignPaths, findByPath } from "./svgx/path";
import { localToGlobal, parseTransform } from "./svgx/transform";
import { Many, assert, assertNever, manyToArray, pipe, throwError } from "./utils";

// # DragSpec
//
// v2 drag spec: a composable algebra for floating + params drags.
// Plain data, no classes. Combinators are functions that produce new specs.
//
// Now includes span/manifold support.

// ## Data representation

export type DragSpec<T> =
  | DragSpecJust<T>
  | DragSpecFloating<T>
  | DragSpecClosest<T>
  | DragSpecWithBackground<T>
  | DragSpecAndThen<T>
  | DragSpecVary<T>
  | DragSpecWithDistance<T>
  | DragSpecSpan<T>;

export type DragSpecJust<T> = {
  type: "just";
  state: T;
};

export type DragSpecFloating<T> = {
  type: "floating";
  state: T;
  ghost: SVGProps<SVGElement> | undefined;
};

export type DragSpecClosest<T> = {
  type: "closest";
  specs: DragSpec<T>[];
};

export type DragSpecWithBackground<T> = {
  type: "with-background";
  foreground: DragSpec<T>;
  background: DragSpec<T>;
  radius: number;
};

export type DragSpecAndThen<T> = {
  type: "and-then";
  spec: DragSpec<T>;
  andThen: T;
};

export type DragSpecVary<T> = {
  type: "vary";
  state: T;
  paramPaths: PathIn<T, number>[];
  constraint?: (state: T) => Many<number>;
  constrainByParams?: boolean;
};

export type DragSpecWithDistance<T> = {
  type: "with-distance";
  spec: DragSpec<T>;
  f: (distance: number) => number;
};

export type DragSpecSpan<T> = {
  type: "span";
  states: T[];
};

// ## Constructors

export function just<T>(state: T): DragSpec<T> {
  return { type: "just", state };
}

export function floating<T>(
  state: T,
  { ghost }: { ghost?: SVGProps<SVGElement> | undefined } = {}
): DragSpec<T> {
  return { type: "floating", state, ghost };
}

export function floatings<T>(
  states: T[],
  { ghost }: { ghost?: SVGProps<SVGElement> | undefined } = {}
): DragSpec<T>[] {
  return states.map((s) => floating(s, { ghost }));
}

export function closest<T>(specs: DragSpec<T>[]): DragSpec<T> {
  return { type: "closest", specs };
}

export function withBackground<T>(
  foreground: DragSpec<T>,
  background: DragSpec<T>,
  { radius = 50 }: { radius?: number } = {}
): DragSpec<T> {
  return { type: "with-background", foreground, background, radius };
}

export function andThen<T>(spec: DragSpec<T>, andThen: T): DragSpec<T> {
  return { type: "and-then", spec, andThen };
}

export type VaryOptions<T> = {
  constraint?: (state: T) => Many<number>;
  /** Use parameter-space distance in pullback (faster, but less accurate) */
  constrainByParams?: boolean;
};

export function vary<T>(
  state: T,
  ...paramPaths: PathIn<T, number>[]
): DragSpec<T>;
export function vary<T>(
  state: T,
  ...args: [...PathIn<T, number>[], VaryOptions<T>]
): DragSpec<T>;
export function vary(state: unknown, ...args: unknown[]): DragSpec<any> {
  const last = args[args.length - 1];
  if (
    args.length > 0 &&
    last &&
    !Array.isArray(last) &&
    typeof last === "object"
  ) {
    const { constraint, constrainByParams } = last as VaryOptions<any>;
    return {
      type: "vary",
      state,
      paramPaths: args.slice(0, -1) as any,
      constraint,
      constrainByParams,
    };
  }
  return { type: "vary", state, paramPaths: args as any };
}

export function withDistance<T>(
  spec: DragSpec<T>,
  f: (distance: number) => number
): DragSpec<T> {
  return { type: "with-distance", spec, f };
}

export function span<T>(states: T[]): DragSpec<T> {
  assert(states.length > 0, "span requires at least one state");
  return { type: "span", states };
}

/** Constraint helper: returns a - b, so a < b when result ≤ 0 */
export function lessThan(a: number, b: number): number {
  return a - b;
}

// # Behavior

export type DragFrame = {
  pointer: Vec2;
  pointerStart: Vec2;
};

export type DragResult<T> = {
  rendered: LayeredSvgx;
  dropState: T;
  distance: number;
  activePath: string;
};

export type DragBehavior<T> = (frame: DragFrame) => DragResult<T>;

export type BehaviorContext<T extends object> = {
  manipulable: Manipulable<T>;
  draggedPath: string;
  draggedId: string | null;
  pointerLocal: Vec2;
  floatLayered: LayeredSvgx | null;
};

function renderStateReadOnly<T extends object>(
  ctx: BehaviorContext<T>,
  state: T
): LayeredSvgx {
  return pipe(
    ctx.manipulable({
      state,
      drag: unsafeDrag,
      draggedId: ctx.draggedId,
      ghostId: null,
      setState: throwError,
    }),
    assignPaths,
    accumulateTransforms,
    layerSvg
  );
}

function getElementPosition<T extends object>(
  ctx: BehaviorContext<T>,
  layered: LayeredSvgx
): Vec2 {
  const element = findByPathInLayered(ctx.draggedPath, layered);
  if (!element) return Vec2(Infinity, Infinity);
  const accTransform = getAccumulatedTransform(element);
  const transforms = parseTransform(accTransform || "");
  return localToGlobal(transforms, ctx.pointerLocal);
}

export function dragSpecToBehavior<T extends object>(
  spec: DragSpec<T>,
  ctx: BehaviorContext<T>
): DragBehavior<T> {
  if (spec.type === "just") {
    const rendered = renderStateReadOnly(ctx, spec.state);
    const elementPos = getElementPosition(ctx, rendered);
    return (frame) => ({
      rendered,
      dropState: spec.state,
      distance: frame.pointer.dist(elementPos),
      activePath: "just",
    });
  } else if (spec.type === "floating") {
    const { draggedId, floatLayered } = ctx;
    assert(
      draggedId !== null,
      "Floating drags require the dragged element to have an id"
    );
    assert(floatLayered !== null, "Floating drags require floatLayered");
    const layered = renderStateReadOnly(ctx, spec.state);
    const elementPos = getElementPosition(ctx, layered);
    const hasElement = layered.byId.has(draggedId);
    let backdrop: LayeredSvgx;
    if (!hasElement) {
      backdrop = layered;
    } else if (spec.ghost !== undefined) {
      const ghostId = "ghost-" + draggedId;
      const ghost = cloneElement(layered.byId.get(draggedId)!, {
        ...spec.ghost,
        id: ghostId,
      });
      const byId = new Map(layered.byId);
      byId.delete(draggedId);
      byId.set(ghostId, ghost);
      backdrop = { byId, descendents: layered.descendents };
    } else {
      backdrop = layeredExtract(layered, draggedId).remaining;
    }

    return (frame) => {
      const floatPositioned = layeredTransform(
        floatLayered,
        translate(frame.pointer.sub(frame.pointerStart))
      );
      const rendered = layeredMerge(
        backdrop,
        pipe(
          floatPositioned,
          (h) => layeredSetAttributes(h, { "data-transition": false }),
          (h) => layeredShiftZIndices(h, 1000000)
        )
      );
      return {
        rendered,
        dropState: spec.state,
        distance: frame.pointer.dist(elementPos),
        activePath: "floating",
      };
    };
  } else if (spec.type === "closest") {
    const subBehaviors = spec.specs.map((s) => dragSpecToBehavior(s, ctx));
    return (frame) => {
      const subResults = subBehaviors.map((b) => b(frame));
      const best = _.minBy(subResults, (r) => r.distance)!;
      const bestIdx = subResults.indexOf(best);
      return { ...best, activePath: `closest/${bestIdx}/${best.activePath}` };
    };
  } else if (spec.type === "with-background") {
    const foregroundBehavior = dragSpecToBehavior(spec.foreground, ctx);
    const backdropBehavior = dragSpecToBehavior(spec.background, ctx);
    return (frame) => {
      const foregroundResult = foregroundBehavior(frame);
      if (foregroundResult.distance > spec.radius) {
        const bgResult = backdropBehavior(frame);
        return { ...bgResult, activePath: `bg/${bgResult.activePath}` };
      }
      return {
        ...foregroundResult,
        activePath: `fg/${foregroundResult.activePath}`,
      };
    };
  } else if (spec.type === "and-then") {
    const subBehavior = dragSpecToBehavior(spec.spec, ctx);
    return (frame) => {
      const result = subBehavior(frame);
      return { ...result, dropState: spec.andThen };
      // activePath passes through from child
    };
  } else if (spec.type === "vary") {
    let curParams = spec.paramPaths.map((path) => getAtPath(spec.state, path));

    const stateFromParams = (params: number[]): T => {
      let s = spec.state;
      for (let i = 0; i < spec.paramPaths.length; i++) {
        s = setAtPath(s, spec.paramPaths[i], params[i]);
      }
      return s;
    };

    // Compute the element position for a given set of params
    const getElementPos = (params: number[]): Vec2 => {
      const candidateState = stateFromParams(params);
      const content = pipe(
        ctx.manipulable({
          state: candidateState,
          drag: unsafeDrag,
          draggedId: ctx.draggedId,
          ghostId: null,
          setState: throwError,
        }),
        assignPaths,
        accumulateTransforms
      );
      const element = findByPath(ctx.draggedPath, content);
      if (!element) return Vec2(Infinity, Infinity);
      const accTransform = getAccumulatedTransform(element);
      const transforms = parseTransform(accTransform || "");
      return localToGlobal(transforms, ctx.pointerLocal);
    };

    return (frame) => {
      const baseObjectiveFn = (params: number[]) => {
        const pos = getElementPos(params);
        return pos.dist2(frame.pointer);
      };

      const r = minimize(baseObjectiveFn, curParams);
      let resultParams = r.solution;

      // Evaluate constraint: flatten Many<number> to array, take max (most violated)
      const evalConstraint = (params: number[]): number => {
        const gs = manyToArray(spec.constraint!(stateFromParams(params)));
        return gs.length === 0 ? -Infinity : Math.max(...gs);
      };

      // If the unconstrained optimum violates the constraint (g > 0),
      // do a second optimization to find the closest feasible point.
      // Objective: max(0, g(x)) + ε·dist²
      // The max(0,g) term dominates until we reach g≤0, then the
      // distance term finds the closest feasible point to the optimum.
      if (spec.constraint && evalConstraint(resultParams) > 0) {
        const x0 = resultParams.slice();
        const pos0 = spec.constrainByParams ? null : getElementPos(resultParams);
        const pullbackFn = (params: number[]) => {
          const g = evalConstraint(params);
          const penalty = g > 0 ? g : 0;
          let dist2: number;
          if (spec.constrainByParams) {
            // Parameter-space distance (faster)
            dist2 = 0;
            for (let i = 0; i < params.length; i++) {
              dist2 += (params[i] - x0[i]) ** 2;
            }
          } else {
            // Diagram-space distance (more accurate)
            const pos = getElementPos(params);
            dist2 = pos.dist2(pos0!);
          }
          return penalty + 1e-4 * dist2;
        };
        const r2 = minimize(pullbackFn, resultParams);
        resultParams = r2.solution;
      }

      curParams = resultParams;
      const newState = stateFromParams(resultParams);
      const rendered = renderStateReadOnly(ctx, newState);
      return {
        rendered,
        dropState: newState,
        distance: Math.sqrt(baseObjectiveFn(resultParams)),
        activePath: "vary",
      };
    };
  } else if (spec.type === "with-distance") {
    const subBehavior = dragSpecToBehavior(spec.spec, ctx);
    return (frame) => {
      const result = subBehavior(frame);
      const scaledDistance = spec.f(result.distance);
      return { ...result, distance: scaledDistance };
    };
  } else if (spec.type === "span") {
    const renderedStates = spec.states.map((state) => ({
      state,
      layered: renderStateReadOnly(ctx, state),
    }));
    const positions = renderedStates.map((rs) =>
      getElementPosition(ctx, rs.layered)
    );
    const delaunay = new Delaunay(positions);

    return (frame) => {
      const projection = delaunay.projectOntoConvexHull(frame.pointer);

      let rendered: LayeredSvgx;
      if (projection.type === "vertex") {
        rendered = renderedStates[projection.ptIdx].layered;
      } else if (projection.type === "edge") {
        rendered = lerpLayered(
          renderedStates[projection.ptIdx0].layered,
          renderedStates[projection.ptIdx1].layered,
          projection.t
        );
      } else {
        rendered = lerpLayered3(
          renderedStates[projection.ptIdx0].layered,
          renderedStates[projection.ptIdx1].layered,
          renderedStates[projection.ptIdx2].layered,
          projection.barycentric
        );
      }

      // Drop state: closest rendered state by pointer distance
      const closestIdx = positions.reduce(
        (bestIdx, pos, idx) =>
          pos.dist(frame.pointer) < positions[bestIdx].dist(frame.pointer)
            ? idx
            : bestIdx,
        0
      );

      return {
        rendered,
        dropState: renderedStates[closestIdx].state,
        distance: projection.dist,
        activePath: "span",
      };
    };
  } else {
    assertNever(spec);
  }
}
