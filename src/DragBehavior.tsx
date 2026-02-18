import _ from "lodash";
import { Draggable } from "./draggable";
import { DragSpec, DragSpecBuilder, DragSpecData } from "./DragSpec";
import { Delaunay } from "./math/delaunay";
import { minimize } from "./math/minimize";
import { Vec2 } from "./math/vec2";
import { getAtPath, setAtPath } from "./paths";
import { renderDraggableReadOnly } from "./renderDraggable";
import { Svgx } from "./svgx";
import { getLocalBounds, pointInBounds } from "./svgx/bounds";
import { path as svgPath, translate } from "./svgx/helpers";
import {
  LayeredSvgx,
  accumulateTransforms,
  elementLocalToGlobal,
  findByPathInLayered,
  layeredExtract,
  layeredMerge,
  layeredPrefixIds,
  layeredSetAttributes,
  layeredShiftZIndices,
  layeredTransform,
} from "./svgx/layers";
import { lerpLayered, lerpLayered3 } from "./svgx/lerp";
import { assignPaths, findByPath } from "./svgx/path";
import { globalToLocal, localToGlobal, parseTransform } from "./svgx/transform";
import { Transition } from "./transition";
import { assert, assertNever, manyToArray, pipe, throwError } from "./utils";

/**
 * A "drag behavior" defines the ongoing behavior of a drag – what is
 * displayed – as well as what state the draggable will transition
 * into on drop. At least so far, it is assumed to be "memoryless".
 */
export type DragBehavior<T> = (frame: DragFrame) => DragResult<T>;

/**
 * The information passed to a drag behavior on every frame of the
 * drag.
 */
export type DragFrame = {
  pointer: Vec2;
  pointerStart: Vec2;
};

/**
 * The information returned by a drag behavior on every frame of the
 * drag.
 */
export type DragResult<T> = {
  rendered: LayeredSvgx;
  dropState: T;
  dropTransition?: Transition | false;
  activePathTransition?: Transition | false;
  distance: number;
  activePath: string;
  /**
   * This is a drag behavior's way of saying "immediately switch to
   * dropState and continue the drag".
   * - `draggedId` is the id of the element to continue dragging; if
   *   omitted, the current dragged element is used
   * - `followSpec` is a DragSpec to follow after switching states;
   *   if omitted, the data-on-drag behavior of the newly rendered
   *   state is consulted as usual
   */
  chainNow?: {
    draggedId?: string;
    followSpec?: DragSpec<T>;
  };
  /**
   * An optional debug overlay to render on top of the drag result.
   */
  debugOverlay?: () => Svgx;
};

/**
 * The information available to a drag behavior when it's being
 * created from a DragSpec.
 */
export type DragBehaviorInitContext<T extends object> = {
  draggable: Draggable<T>;
  draggedPath: string;
  draggedId: string | null;
  pointerLocal: Vec2;
  floatLayered: LayeredSvgx | null;
};

/**
 * Turn a DragSpec into a DragBehavior, given the necessary context.
 * This is where the semantics of each DragSpec type are defined.
 */
export function dragSpecToBehavior<T extends object>(
  spec: DragSpecData<T>,
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
  switch (spec.type) {
    case "just":
      return justBehavior(spec, ctx);
    case "with-floating":
      return withFloatingBehavior(spec, ctx);
    case "closest":
      return closestBehavior(spec, ctx);
    case "with-background":
      return withBackgroundBehavior(spec, ctx);
    case "and-then":
      return andThenBehavior(spec, ctx);
    case "vary":
      return varyBehavior(spec, ctx);
    case "with-distance":
      return withDistanceBehavior(spec, ctx);
    case "with-snap-radius":
      return withSnapRadiusBehavior(spec, ctx);
    case "with-drop-transition":
      return withDropTransitionBehavior(spec, ctx);
    case "with-branch-transition":
      return withBranchTransitionBehavior(spec, ctx);
    case "between":
      return betweenBehavior(spec, ctx);
    case "switch-to-state-and-follow":
      return switchToStateAndFollowBehavior(spec, ctx);
    case "drop-target":
      return dropTargetBehavior(spec, ctx);
    default:
      assertNever(spec);
  }
}

// # Per-type behavior constructors

function justBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "just" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
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
}

function withFloatingBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "with-floating" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
  const { draggedId, floatLayered } = ctx;
  assert(
    draggedId !== null,
    "Floating drags require the dragged element to have an id",
  );
  assert(floatLayered !== null, "Floating drags require floatLayered");
  const innerBehavior = dragSpecToBehavior(spec.spec, ctx);

  return (frame) => {
    const innerResult = innerBehavior(frame);
    const layered = innerResult.rendered;
    // Use the element's transform prop directly rather than
    // getElementPosition, because lerpSvgx skips data- props so
    // data-accumulated-transform is stale on interpolated output.
    // In layered form, the transform prop IS the accumulated transform.
    const draggedElement = layered.byId.get(draggedId);
    const elementPos = draggedElement
      ? localToGlobal(
          parseTransform(
            ((draggedElement.props as any).transform as string) || "",
          ),
          ctx.pointerLocal,
        )
      : Vec2(Infinity, Infinity);
    const hasElement = layered.byId.has(draggedId);

    let backdrop: LayeredSvgx;
    if (!hasElement) {
      backdrop = layered;
    } else if (spec.ghost !== undefined) {
      const { remaining, extracted } = layeredExtract(layered, draggedId);
      backdrop = layeredMerge(
        remaining,
        layeredSetAttributes(layeredPrefixIds(extracted, "ghost-"), spec.ghost),
      );
    } else {
      backdrop = layeredExtract(layered, draggedId).remaining;
    }

    // Compute float translation. With tether, we limit how far the
    // float can deviate from the inner spec's element position.
    let floatDelta = frame.pointer.sub(frame.pointerStart);
    if (spec.tether) {
      const v = frame.pointer.sub(elementPos);
      const dist = v.len();
      if (dist > 1e-6) {
        const newDist = spec.tether(dist);
        const adjusted = elementPos.add(v.mul(newDist / dist));
        floatDelta = adjusted.sub(frame.pointerStart);
      }
    }
    const floatPositioned = layeredTransform(
      floatLayered,
      translate(floatDelta),
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
      dropState: innerResult.dropState,
      distance,
      activePath: `with-floating/${innerResult.activePath}`,
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
}

function closestBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "closest" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
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
}

function withBackgroundBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "with-background" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
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
}

function andThenBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "and-then" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
  const subBehavior = dragSpecToBehavior(spec.spec, ctx);
  return (frame) => {
    const result = subBehavior(frame);
    return { ...result, dropState: spec.andThenState };
    // activePath passes through from child
  };
}

function varyBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "vary" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
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
        d: new DragSpecBuilder<T>(),
        draggedId: ctx.draggedId,
        setState: throwError,
      }),
      assignPaths,
      accumulateTransforms,
    );
    const element = findByPath(ctx.draggedPath, content);
    if (!element) return Vec2(Infinity, Infinity);
    return elementLocalToGlobal(element, ctx.pointerLocal);
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
}

function withDistanceBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "with-distance" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
  const subBehavior = dragSpecToBehavior(spec.spec, ctx);
  return (frame) => {
    const result = subBehavior(frame);
    const scaledDistance = spec.f(result.distance);
    return { ...result, distance: scaledDistance };
  };
}

function withSnapRadiusBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "with-snap-radius" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
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
      activePathTransition: spec.transition || undefined,
      chainNow: spec.chain && snapped ? {} : undefined,
    };
  };
}

function withDropTransitionBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "with-drop-transition" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
  const subBehavior = dragSpecToBehavior(spec.spec, ctx);
  return (frame) => {
    const result = subBehavior(frame);
    return {
      ...result,
      dropTransition: spec.transition,
      activePath: `with-drop-transition/${result.activePath}`,
    };
  };
}

function withBranchTransitionBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "with-branch-transition" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
  const subBehavior = dragSpecToBehavior(spec.spec, ctx);
  return (frame) => {
    const result = subBehavior(frame);
    return {
      ...result,
      activePathTransition: spec.transition,
      activePath: `with-branch-transition/${result.activePath}`,
    };
  };
}

function betweenBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "between" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
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
      activePath: "between",
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
              fill={i === renderedStates.indexOf(closest) ? "magenta" : "none"}
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
}

function switchToStateAndFollowBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "switch-to-state-and-follow" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
  const rendered = renderStateReadOnly(ctx, spec.state);
  return (_frame) => ({
    rendered,
    dropState: spec.state,
    distance: 0,
    activePath: "switch-to-state-and-follow",
    chainNow: { draggedId: spec.draggedId, followSpec: spec.followSpec },
  });
}

function dropTargetBehavior<T extends object>(
  spec: DragSpecData<T> & { type: "drop-target" },
  ctx: DragBehaviorInitContext<T>,
): DragBehavior<T> {
  const rendered = renderStateReadOnly(ctx, spec.state);
  const targetElement = rendered.byId.get(spec.targetId);
  assert(
    targetElement !== undefined,
    `dropTarget: element with id "${spec.targetId}" not found in rendered state`,
  );
  const targetTransform = (targetElement.props as Record<string, unknown>)
    .transform as string | undefined;
  const transforms = parseTransform(targetTransform || "");
  const localBounds = getLocalBounds(targetElement);
  assert(
    localBounds !== null,
    `dropTarget: could not compute bounds for element "${spec.targetId}"`,
  );
  // Pre-compute global bounds corners for debug overlay
  const globalCorners = [
    localToGlobal(transforms, Vec2(localBounds.minX, localBounds.minY)),
    localToGlobal(transforms, Vec2(localBounds.maxX, localBounds.minY)),
    localToGlobal(transforms, Vec2(localBounds.maxX, localBounds.maxY)),
    localToGlobal(transforms, Vec2(localBounds.minX, localBounds.maxY)),
  ];
  return (frame) => {
    const localPointer = globalToLocal(transforms, frame.pointer);
    const inside = pointInBounds(localPointer, localBounds);
    const distance = inside ? 0 : Infinity;
    return {
      rendered,
      dropState: spec.state,
      distance,
      activePath: "drop-target",
      debugOverlay: () => (
        <g opacity={0.8}>
          <polygon
            points={globalCorners.map((c) => `${c.x},${c.y}`).join(" ")}
            fill={inside ? "magenta" : "none"}
            fillOpacity={0.15}
            stroke="magenta"
            strokeWidth={1.5}
            strokeDasharray={inside ? undefined : "4 3"}
          />
        </g>
      ),
    };
  };
}

// # Shared helpers

function renderStateReadOnly<T extends object>(
  ctx: DragBehaviorInitContext<T>,
  state: T,
): LayeredSvgx {
  return renderDraggableReadOnly(ctx.draggable, state, ctx.draggedId);
}

function getElementPosition<T extends object>(
  ctx: DragBehaviorInitContext<T>,
  layered: LayeredSvgx,
): Vec2 {
  const element = findByPathInLayered(ctx.draggedPath, layered);
  if (!element) return Vec2(Infinity, Infinity);
  return elementLocalToGlobal(element, ctx.pointerLocal);
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
