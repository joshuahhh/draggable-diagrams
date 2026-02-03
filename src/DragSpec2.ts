import _ from "lodash";
import { SVGProps, cloneElement } from "react";
import { Manipulable, unsafeDrag } from "./manipulable2";
import { Delaunay } from "./math/delaunay";
import { minimize } from "./math/minimize";
import { Vec2 } from "./math/vec2";
import { PathIn, getAtPath, setAtPath } from "./paths";
import { translate } from "./svgx/helpers";
import {
  HoistedSvgx,
  accumulateTransforms,
  findByPathInHoisted,
  getAccumulatedTransform,
  hoistSvg,
  hoistedExtract,
  hoistedMerge,
  hoistedSetAttributes,
  hoistedShiftZIndices,
  hoistedTransform,
} from "./svgx/hoist";
import { lerpHoisted, lerpHoisted3 } from "./svgx/lerp";
import { assignPaths, findByPath } from "./svgx/path";
import { localToGlobal, parseTransform } from "./svgx/transform";
import { assert, assertNever, pipe, throwError } from "./utils";

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

export function vary<T>(
  state: T,
  ...paramPaths: PathIn<T, number>[]
): DragSpec<T> {
  return { type: "vary", state, paramPaths };
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

// # Behavior

export type DragFrame = {
  pointer: Vec2;
  pointerStart: Vec2;
};

export type DragResult<T> = {
  rendered: HoistedSvgx;
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
  floatHoisted: HoistedSvgx | null;
};

function renderStateReadOnly<T extends object>(
  ctx: BehaviorContext<T>,
  state: T
): HoistedSvgx {
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
    hoistSvg
  );
}

function getElementPosition<T extends object>(
  ctx: BehaviorContext<T>,
  hoisted: HoistedSvgx
): Vec2 {
  const element = findByPathInHoisted(ctx.draggedPath, hoisted);
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
    const { draggedId, floatHoisted } = ctx;
    assert(
      draggedId !== null,
      "Floating drags require the dragged element to have an id"
    );
    assert(floatHoisted !== null, "Floating drags require floatHoisted");
    const hoisted = renderStateReadOnly(ctx, spec.state);
    const elementPos = getElementPosition(ctx, hoisted);
    const hasElement = hoisted.byId.has(draggedId);
    let backdrop: HoistedSvgx;
    if (!hasElement) {
      backdrop = hoisted;
    } else if (spec.ghost !== undefined) {
      const ghostId = "ghost-" + draggedId;
      const ghost = cloneElement(hoisted.byId.get(draggedId)!, {
        ...spec.ghost,
        id: ghostId,
      });
      const byId = new Map(hoisted.byId);
      byId.delete(draggedId);
      byId.set(ghostId, ghost);
      backdrop = { byId, descendents: hoisted.descendents };
    } else {
      backdrop = hoistedExtract(hoisted, draggedId).remaining;
    }

    return (frame) => {
      const floatPositioned = hoistedTransform(
        floatHoisted,
        translate(frame.pointer.sub(frame.pointerStart))
      );
      const rendered = hoistedMerge(
        backdrop,
        pipe(
          floatPositioned,
          (h) => hoistedSetAttributes(h, { "data-transition": false }),
          (h) => hoistedShiftZIndices(h, 1000000)
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

    return (frame) => {
      const objectiveFn = (params: number[]) => {
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
        if (!element) return Infinity;
        const accTransform = getAccumulatedTransform(element);
        const transforms = parseTransform(accTransform || "");
        const pos = localToGlobal(transforms, ctx.pointerLocal);
        return pos.dist2(frame.pointer);
      };

      const r = minimize(objectiveFn, curParams);
      curParams = r.solution;

      const newState = stateFromParams(curParams);
      const rendered = renderStateReadOnly(ctx, newState);
      return {
        rendered,
        dropState: newState,
        distance: Math.sqrt(r.f),
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
      hoisted: renderStateReadOnly(ctx, state),
    }));
    const positions = renderedStates.map((rs) =>
      getElementPosition(ctx, rs.hoisted)
    );
    const delaunay = new Delaunay(positions);

    return (frame) => {
      const projection = delaunay.projectOntoConvexHull(frame.pointer);

      let rendered: HoistedSvgx;
      if (projection.type === "vertex") {
        rendered = renderedStates[projection.ptIdx].hoisted;
      } else if (projection.type === "edge") {
        rendered = lerpHoisted(
          renderedStates[projection.ptIdx0].hoisted,
          renderedStates[projection.ptIdx1].hoisted,
          projection.t
        );
      } else {
        rendered = lerpHoisted3(
          renderedStates[projection.ptIdx0].hoisted,
          renderedStates[projection.ptIdx1].hoisted,
          renderedStates[projection.ptIdx2].hoisted,
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
