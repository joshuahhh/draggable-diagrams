import _ from "lodash";
import { SVGProps, cloneElement } from "react";
import { Draggable } from "./draggable";
import {
  Transition,
  TransitionLike,
  resolveTransitionLike,
} from "./DraggableRenderer";
import { Delaunay } from "./math/delaunay";
import { minimize } from "./math/minimize";
import { Vec2 } from "./math/vec2";
import { PathIn, getAtPath, setAtPath } from "./paths";
import { Svgx } from "./svgx";
import { path as svgPath, translate } from "./svgx/helpers";
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
import {
  Many,
  assert,
  assertNever,
  manyToArray,
  pipe,
  throwError,
} from "./utils";

// # DragSpec
//
// v2 drag spec: a composable algebra for floating + params drags.
// Plain data, no classes. Combinators are functions that produce new specs.
//
// Now includes span/manifold support.

// ## Data representation

// Brand marker so jsx.d.ts can reference DragSpec without a generic parameter.
declare const _dragSpecBrand: unique symbol;
export type DragSpecBrand = { readonly [_dragSpecBrand]: true };

// Fluent methods available on every DragSpec value.
export interface DragSpecMethods<T> {
  andThen(state: T): DragSpec<T>;
  withBackground<B>(
    background: DragSpec<B>,
    opts?: { radius?: number },
  ): DragSpec<T | B>;
  withSnapRadius(
    radius: number,
    options?: { transition?: boolean; chain?: boolean },
  ): DragSpec<T>;
  withDropTransition(transition?: TransitionLike): DragSpec<T>;
  withDistance(f: (distance: number) => number): DragSpec<T>;
}

export type DragSpecData<T> =
  | DragSpecJust<T>
  | DragSpecFloating<T>
  | DragSpecClosest<T>
  | DragSpecWithBackground<T>
  | DragSpecAndThen<T>
  | DragSpecVary<T>
  | DragSpecWithDistance<T>
  | DragSpecWithSnapRadius<T>
  | DragSpecWithDropTransition<T>
  | DragSpecSpan<T>
  | DragSpecTransitionToAndThen<T>;

export type DragSpec<T> = DragSpecData<T> & DragSpecMethods<T> & DragSpecBrand;

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

export type DragSpecWithSnapRadius<T> = {
  type: "with-snap-radius";
  spec: DragSpec<T>;
  radius: number;
  transition: boolean;
  chain: boolean;
};

export type DragSpecWithDropTransition<T> = {
  type: "with-drop-transition";
  spec: DragSpec<T>;
  transition: Transition | undefined;
};

export type DragSpecAndThen<T> = {
  type: "and-then";
  spec: DragSpec<T>;
  andThenState: T;
};

// Interface (not type) so constraint can use method syntax, which is bivariant.
// This allows DragSpec<NarrowType> to be assignable to DragSpec<WideType>.
export interface DragSpecVary<T> {
  type: "vary";
  state: T;
  paramPaths: PathIn<T, number>[];
  constraint?(state: T): Many<number>;
  constrainByParams?: boolean;
}

export type DragSpecWithDistance<T> = {
  type: "with-distance";
  spec: DragSpec<T>;
  f: (distance: number) => number;
};

export type DragSpecSpan<T> = {
  type: "span";
  states: T[];
};

export type DragSpecTransitionToAndThen<T> = {
  type: "transition-to-and-then";
  state: T;
  draggedId: string;
};

// ## Fluent method attachment

function withMethods<T>(data: DragSpecData<T>): DragSpec<T> {
  const spec = data as DragSpec<T>;
  return Object.assign(spec, {
    andThen: (state) => andThen(spec, state),
    withBackground: (bg, opts) => withBackground(spec, bg, opts),
    withSnapRadius: (radius, options) => withSnapRadius(spec, radius, options),
    withDropTransition: (transition) => withDropTransition(spec, transition),
    withDistance: (f) => withDistance(spec, f),
  } satisfies DragSpecMethods<T>);
}

// ## Constructors

function just<T>(states: T[]): DragSpec<T>[];
function just<T>(state: T): DragSpec<T>;
function just<T>(stateOrStates: T | T[]): DragSpec<T> | DragSpec<T>[] {
  if (Array.isArray(stateOrStates)) {
    return stateOrStates.map((s) => just(s));
  }
  return withMethods({ type: "just", state: stateOrStates });
}

function floating<T>(
  states: T[],
  opts?: { ghost?: SVGProps<SVGElement> },
): DragSpec<T>[];
function floating<T>(
  state: T,
  opts?: { ghost?: SVGProps<SVGElement> },
): DragSpec<T>;
function floating<T>(
  stateOrStates: T | T[],
  { ghost }: { ghost?: SVGProps<SVGElement> } = {},
): DragSpec<T> | DragSpec<T>[] {
  if (Array.isArray(stateOrStates)) {
    return stateOrStates.map((s) => floating(s, { ghost }));
  }
  return withMethods({ type: "floating", state: stateOrStates, ghost });
}

function closest<T>(specs: Many<DragSpec<T>>): DragSpec<T> {
  return withMethods({ type: "closest", specs: manyToArray(specs) });
}

// Two type params so specs with different narrow types can combine into a union.
export function withBackground<F, B>(
  foreground: DragSpec<F>,
  background: DragSpec<B>,
  { radius = 50 }: { radius?: number } = {},
): DragSpec<F | B> {
  return withMethods({
    type: "with-background",
    foreground,
    background,
    radius,
  } as DragSpecData<F | B>);
}

export function andThen<T>(spec: DragSpec<T>, state: T): DragSpec<T> {
  return withMethods({ type: "and-then", spec, andThenState: state });
}

export type VaryOptions<T> = {
  constraint?: (state: T) => Many<number>;
  /** Use parameter-space distance in pullback (faster, but less accurate) */
  constrainByParams?: boolean;
};

type VaryArgs<T> =
  | PathIn<T, number>[]
  | [...PathIn<T, number>[], VaryOptions<T>];
function parseVaryArgs<T>(args: VaryArgs<T>): {
  paramPaths: PathIn<T, number>[];
  options: VaryOptions<T>;
} {
  const last = args[args.length - 1];
  if (
    args.length > 0 &&
    last &&
    !Array.isArray(last) &&
    typeof last === "object"
  ) {
    return {
      paramPaths: args.slice(0, -1) as PathIn<T, number>[],
      options: last as VaryOptions<T>,
    };
  }
  return { paramPaths: args as PathIn<T, number>[], options: {} };
}

function vary<T>(state: T, ...paramPaths: PathIn<T, number>[]): DragSpec<T>;
function vary<T>(
  state: T,
  ...args: [...PathIn<T, number>[], VaryOptions<T>]
): DragSpec<T>;
function vary<T>(state: T, ...args: VaryArgs<T>): DragSpec<T> {
  const { paramPaths, options } = parseVaryArgs(args);
  return withMethods({ type: "vary", state, paramPaths, ...options });
}

export function withDistance<T>(
  spec: DragSpec<T>,
  f: (distance: number) => number,
): DragSpec<T> {
  return withMethods({ type: "with-distance", spec, f });
}

export function withSnapRadius<T>(
  spec: DragSpec<T>,
  radius: number,
  options: { transition?: boolean; chain?: boolean } = {},
): DragSpec<T> {
  return withMethods({
    type: "with-snap-radius",
    spec,
    radius,
    transition: options.transition ?? false,
    chain: options.chain ?? false,
  });
}

export function withDropTransition<T>(
  spec: DragSpec<T>,
  transition: TransitionLike = true,
): DragSpec<T> {
  return withMethods({
    type: "with-drop-transition",
    spec,
    transition: resolveTransitionLike(transition),
  });
}

function span<T>(states: T[]): DragSpec<T> {
  assert(states.length > 0, "span requires at least one state");
  return withMethods({ type: "span", states });
}

export function transitionToAndThen<T>(
  state: T,
  draggedId: string,
): DragSpec<T> {
  return withMethods({ type: "transition-to-and-then", state, draggedId });
}

// ## Pre-bound builders (the "d" object)

export type DragSpecBuilders<T> = {
  just(states: T[]): DragSpec<T>[];
  just(state: T): DragSpec<T>;
  floating(states: T[], opts?: { ghost?: SVGProps<SVGElement> }): DragSpec<T>[];
  floating(state: T, opts?: { ghost?: SVGProps<SVGElement> }): DragSpec<T>;
  span(states: T[]): DragSpec<T>;
  closest(specs: Many<DragSpec<T>>): DragSpec<T>;
  vary(state: T, ...paramPaths: PathIn<T, number>[]): DragSpec<T>;
  vary(
    state: T,
    ...args: [...PathIn<T, number>[], VaryOptions<T>]
  ): DragSpec<T>;
};

// Single shared instance — safe because generics are erased at runtime.
export const dragSpecBuilders: DragSpecBuilders<any> = {
  just,
  floating,
  span,
  closest,
  vary,
};

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
  dropTransition?: Transition;
  distance: number;
  activePath: string;
  chainNow?: boolean | string;
  debugOverlay?: () => Svgx;
};

export type DragBehavior<T> = (frame: DragFrame) => DragResult<T>;

export type BehaviorContext<T extends object> = {
  draggable: Draggable<T>;
  draggedPath: string;
  draggedId: string | null;
  pointerLocal: Vec2;
  floatLayered: LayeredSvgx | null;
};

function renderStateReadOnly<T extends object>(
  ctx: BehaviorContext<T>,
  state: T,
): LayeredSvgx {
  return pipe(
    ctx.draggable({
      state,
      d: dragSpecBuilders,
      draggedId: ctx.draggedId,
      ghostId: null,
      setState: throwError,
    }),
    assignPaths,
    accumulateTransforms,
    layerSvg,
  );
}

function getElementPosition<T extends object>(
  ctx: BehaviorContext<T>,
  layered: LayeredSvgx,
): Vec2 {
  const element = findByPathInLayered(ctx.draggedPath, layered);
  if (!element) return Vec2(Infinity, Infinity);
  const accTransform = getAccumulatedTransform(element);
  const transforms = parseTransform(accTransform || "");
  return localToGlobal(transforms, ctx.pointerLocal);
}

function DistanceLine({
  from,
  to,
  distance,
}: {
  from: Vec2;
  to: Vec2;
  distance: number;
}) {
  const label = distance > 0.5 ? `${Math.round(distance)}px` : "on target";
  return (
    <g>
      <line
        {...from.xy1()}
        {...to.xy2()}
        stroke="white"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <line
        {...from.xy1()}
        {...to.xy2()}
        stroke="magenta"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <text
        {...from.lerp(to, 0.5).xy()}
        fill="magenta"
        stroke="white"
        strokeWidth={3}
        paintOrder="stroke"
        fontSize={11}
        fontFamily="monospace"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}

export function dragSpecToBehavior<T extends object>(
  spec: DragSpec<T>,
  ctx: BehaviorContext<T>,
): DragBehavior<T> {
  if (spec.type === "just") {
    const rendered = renderStateReadOnly(ctx, spec.state);
    const elementPos = getElementPosition(ctx, rendered);
    return (frame) => {
      const distance = frame.pointer.dist(elementPos);
      return {
        rendered,
        dropState: spec.state,
        distance,
        activePath: "just",
        debugOverlay: () => (
          <g opacity={0.8}>
            <circle
              cx={elementPos.x}
              cy={elementPos.y}
              r={4}
              fill="none"
              stroke="magenta"
              strokeWidth={1.5}
            />
            <DistanceLine
              from={elementPos}
              to={frame.pointer}
              distance={distance}
            />
          </g>
        ),
      };
    };
  } else if (spec.type === "floating") {
    const { draggedId, floatLayered } = ctx;
    assert(
      draggedId !== null,
      "Floating drags require the dragged element to have an id",
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
        translate(frame.pointer.sub(frame.pointerStart)),
      );
      const rendered = layeredMerge(
        backdrop,
        pipe(
          floatPositioned,
          (h) => layeredSetAttributes(h, { "data-transition": false }),
          (h) => layeredShiftZIndices(h, 1000000),
        ),
      );
      const distance = frame.pointer.dist(elementPos);
      return {
        rendered,
        dropState: spec.state,
        distance,
        activePath: "floating",
        debugOverlay: () => (
          <g opacity={0.8}>
            <circle cx={elementPos.x} cy={elementPos.y} r={5} fill="magenta" />
            <DistanceLine
              from={elementPos}
              to={frame.pointer}
              distance={distance}
            />
          </g>
        ),
      };
    };
  } else if (spec.type === "closest") {
    const subBehaviors = spec.specs.map((s) => dragSpecToBehavior(s, ctx));
    return (frame) => {
      const subResults = subBehaviors.map((b) => b(frame));
      const best = _.minBy(subResults, (r) => r.distance)!;
      const bestIdx = subResults.indexOf(best);
      return {
        ...best,
        activePath: `closest/${bestIdx}/${best.activePath}`,
        debugOverlay: () => (
          <g>
            {subResults.map((r, i) => {
              const sub = r.debugOverlay?.();
              if (!sub) return null;
              return (
                <g key={i} opacity={i === bestIdx ? 1 : 0.2}>
                  {sub}
                </g>
              );
            })}
          </g>
        ),
      };
    };
  } else if (spec.type === "with-background") {
    const foregroundBehavior = dragSpecToBehavior(spec.foreground, ctx);
    const backdropBehavior = dragSpecToBehavior(spec.background, ctx);
    return (frame) => {
      const foregroundResult = foregroundBehavior(frame);
      if (foregroundResult.distance > spec.radius) {
        const bgResult = backdropBehavior(frame);
        const fgDebug = foregroundResult.debugOverlay;
        const bgDebug = bgResult.debugOverlay;
        return {
          ...bgResult,
          activePath: `bg/${bgResult.activePath}`,
          debugOverlay:
            fgDebug || bgDebug
              ? () => (
                  <g>
                    {fgDebug && <g opacity={0.15}>{fgDebug()}</g>}
                    {bgDebug?.()}
                  </g>
                )
              : undefined,
        };
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
      return { ...result, dropState: spec.andThenState };
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
        ctx.draggable({
          state: candidateState,
          d: dragSpecBuilders,
          draggedId: ctx.draggedId,
          ghostId: null,
          setState: throwError,
        }),
        assignPaths,
        accumulateTransforms,
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
        const pos0 = spec.constrainByParams
          ? null
          : getElementPos(resultParams);
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
      const achievedPos = getElementPosition(ctx, rendered);
      const distance = Math.sqrt(baseObjectiveFn(resultParams));
      return {
        rendered,
        dropState: newState,
        distance,
        activePath: "vary",
        debugOverlay: () => (
          <g opacity={0.8}>
            <circle {...achievedPos.cxy()} r={5} fill="magenta" />
            <DistanceLine
              from={achievedPos}
              to={frame.pointer}
              distance={distance}
            />
          </g>
        ),
      };
    };
  } else if (spec.type === "with-distance") {
    const subBehavior = dragSpecToBehavior(spec.spec, ctx);
    return (frame) => {
      const result = subBehavior(frame);
      const scaledDistance = spec.f(result.distance);
      return { ...result, distance: scaledDistance };
    };
  } else if (spec.type === "with-snap-radius") {
    const subBehavior = dragSpecToBehavior(spec.spec, ctx);
    const radiusSq = spec.radius ** 2;
    return (frame) => {
      const result = subBehavior(frame);
      // TODO: noxious smell
      // re-accumulate transforms for everything in result.rendered
      for (const id of result.rendered.byId.keys()) {
        result.rendered.byId.set(
          id,
          accumulateTransforms(result.rendered.byId.get(id)!),
        );
      }
      const elementPos = getElementPosition(ctx, result.rendered);
      // TODO: costly
      const dropRendered = renderStateReadOnly(ctx, result.dropState);
      const dropElementPos = getElementPosition(ctx, dropRendered);
      let rendered = result.rendered;
      const snapped = dropElementPos.dist2(elementPos) <= radiusSq;
      if (snapped) {
        rendered = dropRendered;
      }
      const activePath =
        spec.transition && snapped
          ? `with-snap-radius[snapped]/${result.activePath}`
          : `with-snap-radius/${result.activePath}`;
      return {
        ...result,
        rendered,
        activePath,
        chainNow: spec.chain && snapped,
      };
    };
  } else if (spec.type === "with-drop-transition") {
    const subBehavior = dragSpecToBehavior(spec.spec, ctx);
    return (frame) => {
      const result = subBehavior(frame);
      return {
        ...result,
        dropTransition: spec.transition,
        activePath: `with-drop-transition/${result.activePath}`,
      };
    };
  } else if (spec.type === "span") {
    const renderedStates = spec.states.map((state) => {
      const layered = renderStateReadOnly(ctx, state);
      return { state, layered, position: getElementPosition(ctx, layered) };
    });
    const delaunay = new Delaunay(renderedStates.map((rs) => rs.position));

    return (frame) => {
      const projection = delaunay.projectOntoConvexHull(frame.pointer);

      let rendered: LayeredSvgx;
      if (projection.type === "vertex") {
        rendered = renderedStates[projection.ptIdx].layered;
      } else if (projection.type === "edge") {
        rendered = lerpLayered(
          renderedStates[projection.ptIdx0].layered,
          renderedStates[projection.ptIdx1].layered,
          projection.t,
        );
      } else {
        rendered = lerpLayered3(
          renderedStates[projection.ptIdx0].layered,
          renderedStates[projection.ptIdx1].layered,
          renderedStates[projection.ptIdx2].layered,
          projection.barycentric,
        );
      }

      // Drop state: closest rendered state by pointer distance
      const closest = _.minBy(renderedStates, (rs) =>
        rs.position.dist(frame.pointer),
      )!;

      return {
        rendered,
        dropState: closest.state,
        distance: projection.dist,
        activePath: "span",
        debugOverlay: () => (
          <g>
            {/* Delaunay triangulation edges */}
            {delaunay.triangles().map((tri, i) => {
              const [a, b, c] = tri;
              return (
                <path
                  key={`tri-${i}`}
                  d={svgPath("M", a.x, a.y, "L", b.x, b.y, "L", c.x, c.y, "Z")}
                  stroke="magenta"
                  strokeWidth={1}
                  fill="magenta"
                  fillOpacity={0.05}
                />
              );
            })}
            {/* State positions */}
            {renderedStates.map((rs, i) => (
              <circle
                key={`pt-${i}`}
                {...rs.position.cxy()}
                r={6}
                fill={
                  i === renderedStates.indexOf(closest) ? "magenta" : "none"
                }
                stroke="magenta"
                strokeWidth={1.5}
                opacity={i === renderedStates.indexOf(closest) ? 1 : 0.5}
              />
            ))}
            {/* Projected point */}
            <circle
              {...projection.projectedPt.cxy()}
              r={5}
              stroke="magenta"
              strokeWidth={2}
              fill="none"
            />
            <DistanceLine
              from={frame.pointer}
              to={projection.projectedPt}
              distance={projection.dist}
            />
          </g>
        ),
      };
    };
  } else if (spec.type === "transition-to-and-then") {
    const rendered = renderStateReadOnly(ctx, spec.state);
    return (_frame) => ({
      rendered,
      dropState: spec.state,
      distance: 0,
      activePath: "transition-to-and-then",
      chainNow: spec.draggedId,
    });
  } else {
    assertNever(spec);
  }
}
