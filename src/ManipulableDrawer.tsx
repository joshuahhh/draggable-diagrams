import * as d3Ease from "d3-ease";
import _ from "lodash";
import React, {
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { assert } from "vitest";
import { DragSpec, TargetStateLike, span, toTargetState } from "./DragSpec";
import {
  Manipulable,
  ManipulableProps,
  getDragSpecCallbackOnElement,
  unsafeDrag,
} from "./manipulable";
import { Delaunay } from "./math/delaunay";
import { LerpSpringState, step } from "./math/lerp-spring-f";
import { minimize } from "./math/minimize";
import { Vec2 } from "./math/vec2";
import { getAtPath, setAtPath } from "./paths";
import { PrettyPrint } from "./pretty-print";
import { Svgx, updatePropsDownTree } from "./svgx";
import { path, translate } from "./svgx/helpers";
import {
  HoistedSvgx,
  accumulateTransforms,
  drawHoisted,
  findByPathInHoisted,
  getAccumulatedTransform,
  hoistSvg,
  hoistedExtract,
  hoistedMerge,
  hoistedTransform,
} from "./svgx/hoist";
import { lerpHoisted, lerpHoisted3 } from "./svgx/lerp";
import { assignPaths, findByPath, getPath } from "./svgx/path";
import { globalToLocal, localToGlobal, parseTransform } from "./svgx/transform";
import { useAnimationLoop } from "./useAnimationLoop";
import { useRenderError } from "./useRenderError";
import {
  DOmit,
  assertNever,
  assertWithJSX,
  hasKey,
  manyToArray,
  memoGeneric,
  pipe,
  throwError,
} from "./utils";

interface ManipulableDrawerProps<T extends object> {
  manipulable: Manipulable<T>;
  initialState: T;
  width?: number;
  height?: number;
  drawerConfig?: Partial<DrawerConfig>;
  debugMode?: boolean;
  onDragStateChange?: (dragState: any) => void;
}

export function ManipulableDrawer<T extends object>({
  manipulable,
  initialState,
  width,
  height,
  drawerConfig = {},
  debugMode,
  onDragStateChange,
}: ManipulableDrawerProps<T>) {
  const throwRenderError = useRenderError();

  const [dragState, setDragState] = useState<DragState<T>>({
    type: "idle",
    state: initialState,
  });
  const [paused, setPaused] = useState(false);
  const pointerRef = useRef<Vec2 | undefined>(undefined);

  const drawerConfigWithDefaults = useMemo(
    () => ({
      snapRadius: drawerConfig.snapRadius ?? 10,
      chainDrags: drawerConfig.chainDrags ?? true,
      relativePointerMotion: drawerConfig.relativePointerMotion ?? false,
      animationDuration: drawerConfig.animationDuration ?? 300,
    }),
    [drawerConfig]
  );

  useEffect(() => {
    onDragStateChange?.(dragState);
  }, [dragState, onDragStateChange]);

  // Handle pause keyboard shortcut (cmd-p or ctrl-p)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setPaused((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const [svgElem, setSvgElem] = useState<SVGSVGElement | null>(null);

  const setPointerFromEvent = useCallback(
    (e: globalThis.PointerEvent) => {
      assert(!!svgElem);
      const rect = svgElem.getBoundingClientRect();
      const pointer = Vec2(e.clientX - rect.left, e.clientY - rect.top);
      pointerRef.current = pointer;
      return pointer;
    },
    [svgElem]
  );

  const dragContext: DragContext<T> = useMemo(() => {
    return {
      drawerConfig: drawerConfigWithDefaults,
      manipulable,
      debugMode: !!debugMode,
    };
  }, [debugMode, drawerConfigWithDefaults, manipulable]);

  const setDragStateWithoutByproducts = useCallback(
    (newDragState: DOmit<DragState<T>, "byproducts">) => {
      setDragState(
        updateDragState(newDragState, dragContext, pointerRef.current)
      );
    },
    [dragContext, setDragState]
  );

  useAnimationLoop(
    useCallback(() => {
      // These are the only two states that need updating over time
      if (
        dragState.type === "animating" ||
        dragState.type === "drag-detach-reattach"
      ) {
        setDragState(
          updateDragState(dragState, dragContext, pointerRef.current)
        );
      }
    }, [dragContext, dragState, setDragState])
  );

  useEffect(() => {
    if (
      dragState.type === "drag-manifolds" ||
      dragState.type === "drag-detach-reattach" ||
      dragState.type === "drag-params"
    ) {
      document.body.style.cursor = "grabbing";
    } else {
      document.body.style.cursor = "default";
    }
  }, [dragState.type]);

  // Attach document-level event listeners during drag
  useEffect(() => {
    if (
      dragState.type !== "drag-manifolds" &&
      dragState.type !== "drag-detach-reattach" &&
      dragState.type !== "drag-params"
    ) {
      return;
    }

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      if (paused) return;
      const pointer = setPointerFromEvent(e);
      setDragState(updateDragState(dragState, dragContext, pointer));
    };

    const handlePointerUp = (e: globalThis.PointerEvent) => {
      if (paused) return;
      const pointer = setPointerFromEvent(e);
      setDragState(onPointerUp(dragState, dragContext, pointer));
    };

    const handlePointerCancel = () => {
      // TODO: we need to do something with dragstate in this case
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [dragContext, dragState, paused, setDragState, setPointerFromEvent]);

  // prettyLog(sortedEntries, { label: "sortedEntries for rendering" });

  const renderContext: RenderContext<T> = useMemo(() => {
    return {
      ...dragContext,
      setPointerFromEvent,
      setDragState: setDragStateWithoutByproducts,
      throwRenderError,
    };
  }, [
    dragContext,
    setDragStateWithoutByproducts,
    setPointerFromEvent,
    throwRenderError,
  ]);

  return (
    <svg
      ref={setSvgElem}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible select-none touch-none"
    >
      {dragState.type === "idle" ? (
        <DrawIdleMode dragState={dragState} ctx={renderContext} />
      ) : dragState.type === "animating" ? (
        <DrawAnimatingMode dragState={dragState} ctx={renderContext} />
      ) : dragState.type === "drag-manifolds" ? (
        <DrawDragManifoldsMode dragState={dragState} ctx={renderContext} />
      ) : dragState.type === "drag-detach-reattach" ? (
        <DrawDragDetachReattachMode dragState={dragState} ctx={renderContext} />
      ) : dragState.type === "drag-params" ? (
        <DrawDragParamsMode dragState={dragState} ctx={renderContext} />
      ) : (
        assertNever(dragState)
      )}
    </svg>
  );
}

/**
 * A ManifoldPoint is a state that's accessible by dragging an
 * element to a certain position.
 */
export type ManifoldPoint<T> = {
  state: T;
  /**
   * A pre-rendered hoisted diagram of the state.
   */
  hoisted: HoistedSvgx;
  dragSpecCallbackAtNewState: (() => DragSpec<T>) | undefined;
  /**
   * The global position of the dragged point of the dragged element,
   * when it's in this state.
   */
  position: Vec2;
  /**
   * If defined, a state to immediately transition to after reaching
   * this state.
   */
  andThen: T | undefined;
};

export type Manifold<T> = {
  points: ManifoldPoint<T>[];
  delaunay: Delaunay;
};

export type DragState<T> =
  | { type: "idle"; state: T }
  | {
      type: "drag-manifolds";
      draggedPath: string;
      draggedId: string | null;
      pointerLocal: Vec2;
      startingPoint: ManifoldPoint<T>;
      manifolds: Manifold<T>[];
      byproducts: {
        hoistedToRender: HoistedSvgx;
        manifoldProjections: Array<{
          manifold: Manifold<T>;
          projectedPt: Vec2;
          dist: number;
        }>;
        newState: T;
        debugView: () => Svgx;
      };
    }
  | {
      type: "drag-detach-reattach";
      draggedPath: string;
      draggedId: string;
      pointerLocal: Vec2;
      startingPoint: ManifoldPoint<T>;
      draggedHoisted: HoistedSvgx;
      detachedState: T;
      detachedHoisted: HoistedSvgx;
      reattachedPoints: ManifoldPoint<T>[];
      backgroundSpringState: LerpSpringState<HoistedSvgx>;
      byproducts: {
        /**
         * the hoisted to render, made by combining the springing
         * background with the foreground
         */
        hoistedToRender: HoistedSvgx;
        /**
         * the state that releasing the pointer should take us to
         */
        newState: T;
        /**
         * the hoisted rendered diagram for newState
         */
        newStateHoisted: HoistedSvgx;
      };
    }
  | {
      type: "drag-params";
      draggedPath: string;
      draggedId: string | null;
      pointerLocal: Vec2;
      curParams: number[];
      stateFromParams: (...params: number[]) => T;
      byproducts: {
        content: Svgx;
        debugView: () => Svgx;
      };
    }
  | {
      type: "animating";
      startHoisted: HoistedSvgx;
      targetHoisted: HoistedSvgx;
      easing: (t: number) => number;
      startTime: number;
      duration: number;
      nextDragState: DragState<T>;
      byproducts: {
        easedProgress: number;
      };
    };

function renderManipulableReadOnly<T extends object>(
  manipulable: Manipulable<T>,
  props: Omit<ManipulableProps<T>, "drag" | "setState">
): HoistedSvgx {
  return postProcessReadOnly(
    manipulable({ ...props, drag: unsafeDrag, setState: throwError })
  );
}
function postProcessReadOnly(element: Svgx): HoistedSvgx {
  return pipe(element, assignPaths, accumulateTransforms, hoistSvg);
}

function postProcessForInteraction<T extends object>(
  element: Svgx,
  state: T,
  ctx: RenderContext<T>
): HoistedSvgx {
  return pipe(
    element,
    assignPaths,
    accumulateTransforms,
    (el) =>
      updatePropsDownTree(el, (el) => {
        const dragSpecCallback = getDragSpecCallbackOnElement<T>(el);
        if (!dragSpecCallback) return;
        return {
          style: { cursor: "grab", ...(el.props.style || {}) },
          onPointerDown: (e: React.PointerEvent) => {
            try {
              // console.log("onPointerDown");
              e.stopPropagation();
              const pointer = ctx.setPointerFromEvent(e.nativeEvent);
              const accumulatedTransform = getAccumulatedTransform(el);
              const transforms = parseTransform(accumulatedTransform || "");
              const pointerLocal = globalToLocal(transforms, pointer);
              const path = getPath(el);
              assert(!!path, "Draggable element must have a path");
              ctx.setDragState(
                computeEnterDraggingMode(
                  state,
                  path,
                  el.props.id || null,
                  dragSpecCallback(),
                  pointerLocal,
                  ctx.manipulable
                )
              );
            } catch (error) {
              ctx.throwRenderError(error);
            }
          },
        };
      }),
    hoistSvg
  );
}

function makeManifoldPoint<T extends object>({
  targetStateLike,
  manipulable,
  draggedPath,
  draggedId,
  pointerLocal,
  state,
}: {
  targetStateLike: TargetStateLike<T>;
  manipulable: Manipulable<T>;
  draggedPath: string;
  draggedId: string | null;
  pointerLocal: Vec2;
  state: T;
}): ManifoldPoint<T> {
  const targetState = toTargetState(targetStateLike);

  // Use a no-op draggable to avoid attaching event handlers
  const hoisted = renderManipulableReadOnly(manipulable, {
    state: targetState.targetState,
    draggedId,
  });
  // prettyLog(hoisted, { label: "hoisted in makeManifoldPoint" });
  console.log("gonna find", draggedPath, "in hoisted:");
  // prettyLog(hoisted);
  const element = findByPathInHoisted(draggedPath, hoisted);
  assertWithJSX(
    !!element,
    "makeManifoldPoint: can't find draggable element in hoisted SVG",
    () => (
      <>
        <p className="mb-2">
          We're looking for an element with path{" "}
          <span className="font-mono">{draggedPath}</span> inside:
        </p>
        <PrettyPrint value={hoisted} />
        <p className="mb-2">
          This came up when figuring out how to go from state:
        </p>
        <PrettyPrint value={state} />
        <p className="mb-2">to state:</p>
        <PrettyPrint value={targetStateLike} />
      </>
    )
  );

  // console.log("making manifold point; element:");
  // prettyLog(element);

  const accumulatedTransform = getAccumulatedTransform(element);
  const transforms = parseTransform(accumulatedTransform || "");

  return {
    state: targetState.targetState,
    hoisted,
    position: localToGlobal(transforms, pointerLocal),
    dragSpecCallbackAtNewState: getDragSpecCallbackOnElement<T>(element),
    andThen: targetState.andThen,
  };
}

/**
 * If we want to enter a dragging mode (defined by a dragSpec) from a
 * state, this gives the resulting DragState (minus "byproducts",
 * which should be calculated by updateDragState).
 */
function computeEnterDraggingMode<T extends object>(
  state: T,
  draggedPath: string,
  draggedId: string | null,
  dragSpec: DragSpec<T>,
  pointerLocal: Vec2,
  manipulable: Manipulable<T>
): DOmit<DragState<T>, "byproducts"> {
  console.log("enterDraggingMode", state, draggedPath);

  if (hasKey(dragSpec, "type") && dragSpec.type === "params") {
    return {
      type: "drag-params",
      draggedPath,
      draggedId,
      pointerLocal,
      curParams: dragSpec.initParams,
      stateFromParams: dragSpec.stateFromParams,
    };
  }

  if (hasKey(dragSpec, "type") && dragSpec.type === "param-paths") {
    return {
      type: "drag-params",
      draggedPath,
      draggedId,
      pointerLocal,
      curParams: dragSpec.paramPaths.map((path) => getAtPath(state, path)),
      stateFromParams: (...params: number[]) => {
        let newState = state;
        dragSpec.paramPaths.forEach((path, idx) => {
          newState = setAtPath(newState, path, params[idx]);
        });
        return newState;
      },
    };
  }

  if (hasKey(dragSpec, "type") && dragSpec.type === "detach-reattach") {
    // where we start
    const startingPoint = makeManifoldPoint({
      state,
      targetStateLike: state,
      manipulable,
      draggedPath,
      draggedId,
      pointerLocal,
    });

    // snatch out the dragged SVG element
    assert(
      !!draggedId,
      "Dragged element actually needs ID for detach-reattach drags"
    );
    const { extracted: draggedHoisted, remaining: background } = hoistedExtract(
      startingPoint.hoisted,
      draggedId
    );
    assert(
      !!draggedHoisted,
      "Couldn't find dragged SVG element in starting state"
    );

    // draw the detached state
    const { detachedState, reattachedStates } = dragSpec;
    const detachedHoisted = renderManipulableReadOnly(manipulable, {
      state: detachedState,
      draggedId,
    });

    return {
      type: "drag-detach-reattach",
      draggedPath,
      draggedId,
      pointerLocal,
      startingPoint,
      detachedState,
      draggedHoisted,
      detachedHoisted,
      reattachedPoints: reattachedStates.map((state) =>
        makeManifoldPoint({
          state: state.targetState,
          targetStateLike: state,
          manipulable,
          draggedPath,
          draggedId,
          pointerLocal,
        })
      ),
      backgroundSpringState: {
        cur: background,
        curT: Date.now(),
        prev: background,
        prevT: Date.now(),
      },
    };
  }

  const manifoldSpecs = pipe(
    manyToArray(dragSpec),
    (arr) => (arr.length === 0 ? [span([])] : arr) // things go wrong if no manifolds
  );

  const makeManifoldPointProps: Parameters<typeof makeManifoldPoint<T>>[0] = {
    state,
    targetStateLike: state,
    manipulable,
    draggedPath,
    draggedId,
    pointerLocal,
  };

  const startingPoint = makeManifoldPoint(makeManifoldPointProps);

  const manifolds = manifoldSpecs.map((manifoldSpec) => {
    const states =
      manifoldSpec.type === "manifold"
        ? manifoldSpec.states
        : manifoldSpec.type === "straight-to"
        ? [state, manifoldSpec.state]
        : assertNever(manifoldSpec);

    const points = states.map((state) =>
      makeManifoldPoint({
        ...makeManifoldPointProps,
        targetStateLike: state,
      })
    );
    console.log(
      "triangulating manifold with points:",
      points.map((info) => info.position.arr())
    );
    const delaunay = new Delaunay(points.map((info) => info.position.arr()));
    console.log("created delaunay:", delaunay);
    return { points, delaunay };
  });

  return {
    type: "drag-manifolds",
    draggedPath,
    draggedId,
    pointerLocal,
    startingPoint,
    manifolds,
  };
}

function debugForDragMode(
  manifoldProjections: Array<{
    manifold: Manifold<any>;
    projectedPt: Vec2;
    dist: number;
  }>,
  snapRadius: number,
  pointer: Vec2
): Svgx {
  const debugRender: React.ReactElement[] = [];

  manifoldProjections.forEach((proj, manifoldIdx) => {
    const { manifold, projectedPt } = proj;

    // Draw red circles at manifold points
    manifold.points.forEach((pt, ptIdx) => {
      debugRender.push(
        <circle
          key={`manifold-${manifoldIdx}-point-${ptIdx}`}
          cx={pt.position.x}
          cy={pt.position.y}
          r={snapRadius}
          fill="red"
          opacity={0.3}
        />
      );
    });

    // Draw red triangulation edges
    manifold.delaunay.triangles().forEach((tri) => {
      const [a, b, c] = tri;
      debugRender.push(
        <path
          d={path("M", a.x, a.y, "L", b.x, b.y, "L", c.x, c.y, "Z")}
          stroke="red"
          strokeWidth={2}
          fill="none"
        />
      );
    });

    // Draw blue circle at projected point
    debugRender.push(
      <circle
        cx={projectedPt.x}
        cy={projectedPt.y}
        r={10}
        stroke="blue"
        strokeWidth={2}
        fill="none"
      />
    );

    // Draw blue line from draggable dest to projected point
    debugRender.push(
      <line
        x1={pointer.x}
        y1={pointer.y}
        x2={projectedPt.x}
        y2={projectedPt.y}
        stroke="blue"
        strokeWidth={2}
      />
    );
  });

  return <>{debugRender}</>;
}

function debugForDragParamsMode(
  content: Svgx,
  draggedPath: string,
  pointerLocal: Vec2,
  pointer: Vec2
): Svgx {
  const debugRender: React.ReactElement[] = [];

  const processedContent = pipe(content, assignPaths, accumulateTransforms);
  const element = findByPath(draggedPath, processedContent);
  if (element) {
    const accumulateTransform = getAccumulatedTransform(element);
    const transforms = parseTransform(accumulateTransform || "");
    const achievedPos = localToGlobal(transforms, pointerLocal);

    debugRender.push(
      <circle
        key="drag-params-achieved"
        cx={achievedPos.x}
        cy={achievedPos.y}
        r={5}
        fill="green"
        stroke="darkgreen"
        strokeWidth={2}
      />
    );

    debugRender.push(
      <line
        key="drag-params-line"
        x1={achievedPos.x}
        y1={achievedPos.y}
        x2={pointer.x}
        y2={pointer.y}
        stroke="orange"
        strokeWidth={2}
        strokeDasharray="4 4"
      />
    );
  }

  return <>{debugRender}</>;
}

type DragContext<T extends object> = {
  // pointer: Vec2;
  drawerConfig: DrawerConfig;
  manipulable: Manipulable<T>;
  debugMode: boolean;
};

function updateDragState<T extends object>(
  dragState: DOmit<DragState<T>, "byproducts">,
  ctx: DragContext<T>,
  pointer?: Vec2
): DragState<T> {
  if (dragState.type === "idle") {
    return dragState;
  } else if (dragState.type === "animating") {
    const now = Date.now();
    const elapsed = now - dragState.startTime;
    const progress = Math.min(elapsed / dragState.duration, 1);
    const easedProgress = dragState.easing(progress);

    if (progress >= 1) {
      return dragState.nextDragState;
    } else {
      return {
        ...dragState,
        byproducts: {
          easedProgress,
        },
      };
    }
  } else if (dragState.type === "drag-manifolds") {
    assert(!!pointer, "Pointer must be defined in drag mode");

    let newState: T;
    let hoistedToRender: HoistedSvgx;

    const manifoldProjections = dragState.manifolds.map((manifold) => ({
      ...manifold.delaunay.projectOntoConvexHull(pointer),
      manifold,
    }));

    const bestManifoldProjection = _.minBy(
      manifoldProjections,
      (proj) => proj.dist
    )!;

    if (ctx.drawerConfig.relativePointerMotion) {
      // TODO: implement relative pointer motion
      // dragState.pointerOffset = Vec2(pointer).sub(
      //   bestManifoldProjection.projectedPt,
      // );
    }

    const closestManifoldPt = _.minBy(
      dragState.manifolds.flatMap((m) => m.points),
      (info) => pointer.dist(info.position)
    )!;

    // TODO: it would be nice to animate towards .state before
    // jumping to .andThen
    newState = closestManifoldPt.andThen ?? closestManifoldPt.state;

    // Check if it's time to snap
    if (
      ctx.drawerConfig.chainDrags &&
      bestManifoldProjection.projectedPt.dist(closestManifoldPt.position) <
        ctx.drawerConfig.snapRadius
    ) {
      if (!_.isEqual(newState, dragState.startingPoint.state)) {
        // time to snap!

        const dragSpecCallback = closestManifoldPt.dragSpecCallbackAtNewState;

        // console.log("snapping to new state", newState, dragSpecCallback);

        // special case: the thing we're snapping to doesn't have a drag spec at all
        if (!dragSpecCallback) {
          return { type: "idle", state: newState };
        } else {
          // normal case
          const newDragState = computeEnterDraggingMode(
            newState,
            dragState.draggedPath,
            dragState.draggedId,
            dragSpecCallback(),
            dragState.pointerLocal,
            ctx.manipulable
          );
          // recursive updateDragState call
          return updateDragState(newDragState, ctx, pointer);
        }
      }
      hoistedToRender = closestManifoldPt.hoisted;
    } else {
      // Interpolate based on projection type
      if (bestManifoldProjection.type === "vertex") {
        const { ptIdx } = bestManifoldProjection;
        hoistedToRender = bestManifoldProjection.manifold.points[ptIdx].hoisted;
      } else if (bestManifoldProjection.type === "edge") {
        const { ptIdx0, ptIdx1, t } = bestManifoldProjection;
        hoistedToRender = lerpHoisted(
          bestManifoldProjection.manifold.points[ptIdx0].hoisted,
          bestManifoldProjection.manifold.points[ptIdx1].hoisted,
          t
        );
      } else {
        const { ptIdx0, ptIdx1, ptIdx2, barycentric } = bestManifoldProjection;
        hoistedToRender = lerpHoisted3(
          bestManifoldProjection.manifold.points[ptIdx0].hoisted,
          bestManifoldProjection.manifold.points[ptIdx1].hoisted,
          bestManifoldProjection.manifold.points[ptIdx2].hoisted,
          barycentric
        );
      }
    }

    return {
      ...dragState,
      byproducts: {
        hoistedToRender,
        manifoldProjections,
        newState,
        debugView: () =>
          debugForDragMode(
            manifoldProjections,
            ctx.drawerConfig.snapRadius,
            pointer
          ),
      },
    };
  } else if (dragState.type === "drag-detach-reattach") {
    assert(!!pointer, "Pointer must be defined in drag-detach-reattach mode");

    // compute background target based on proximity to positions
    const closestPoint = _.minBy(
      [dragState.startingPoint, ...dragState.reattachedPoints],
      (pt) => pointer.dist(pt.position)
    )!;
    let newState = dragState.startingPoint.state;
    let newStateHoisted = dragState.startingPoint.hoisted;
    // let newState = dragState.detachedState;
    // let newStateTarget = dragState.detachedHoisted;
    let backgroundHoisted = dragState.detachedHoisted;
    if (pointer.dist(closestPoint.position) < 50) {
      // that's perm TILE_SIZE lol
      newState = closestPoint.andThen ?? closestPoint.state;
      newStateHoisted = closestPoint.hoisted;
      const { remaining } = hoistedExtract(
        closestPoint.hoisted,
        dragState.draggedId
      );
      backgroundHoisted = remaining;
    }

    // now animate background towards target
    const newBackgroundSpringState = step(
      dragState.backgroundSpringState,
      {
        omega: 0.03, // spring frequency (rad/ms)
        gamma: 0.1, // damping rate (1/ms)
      },
      lerpHoisted,
      Date.now(),
      backgroundHoisted
    );

    const hoistedToRender = hoistedMerge(
      newBackgroundSpringState.cur,
      hoistedTransform(
        dragState.draggedHoisted,
        translate(pointer.sub(dragState.startingPoint.position))
      )
    );

    return {
      ...dragState,
      backgroundSpringState: newBackgroundSpringState,
      byproducts: {
        hoistedToRender,
        newState,
        newStateHoisted,
      },
    };
  } else if (dragState.type === "drag-params") {
    assert(!!pointer, "Pointer must be defined while drag-params");

    const objectiveFn = (params: number[]) => {
      const candidateState = dragState.stateFromParams(...params);
      const content = pipe(
        ctx.manipulable({
          state: candidateState,
          drag: unsafeDrag,
          draggedId: dragState.draggedId,
          setState: throwError,
        }),
        assignPaths,
        accumulateTransforms
      );
      const element = findByPath(dragState.draggedPath, content);
      if (!element) return Infinity;
      const accumulateTransform = getAccumulatedTransform(element);
      const transforms = parseTransform(accumulateTransform || "");
      const pos = localToGlobal(transforms, dragState.pointerLocal);
      return pos.dist2(pointer);
    };

    const r = minimize(objectiveFn, dragState.curParams);
    dragState.curParams = r.solution;

    const newState = dragState.stateFromParams(...dragState.curParams);
    const content = ctx.manipulable({
      state: newState,
      drag: unsafeDrag,
      draggedId: dragState.draggedId,
      setState: throwError,
    });

    return {
      ...dragState,
      byproducts: {
        content,
        debugView: () =>
          debugForDragParamsMode(
            content,
            dragState.draggedPath,
            dragState.pointerLocal,
            pointer
          ),
      },
    };
  } else {
    assertNever(dragState);
  }
}

function onPointerUp<T extends object>(
  dragState: DragState<T>,
  ctx: DragContext<T>,
  pointer: Vec2
): DragState<T> {
  if (dragState.type === "idle") {
    return dragState;
  } else if (dragState.type === "animating") {
    return dragState;
  } else if (dragState.type === "drag-manifolds") {
    return updateDragState(
      {
        type: "animating",
        startHoisted: dragState.byproducts.hoistedToRender,
        // TODO: redundant render, it's in the ManifoldPoint
        targetHoisted: renderManipulableReadOnly(ctx.manipulable, {
          state: dragState.byproducts.newState,
          draggedId: null,
        }),
        startTime: Date.now(),
        easing: d3Ease.easeElastic,
        duration: ctx.drawerConfig.animationDuration,
        nextDragState: { type: "idle", state: dragState.byproducts.newState },
      },
      ctx,
      pointer
    );
  } else if (dragState.type === "drag-detach-reattach") {
    return updateDragState(
      {
        type: "animating",
        startHoisted: dragState.byproducts.hoistedToRender,
        targetHoisted: dragState.byproducts.newStateHoisted,
        startTime: Date.now(),
        easing: d3Ease.easeElastic,
        duration: ctx.drawerConfig.animationDuration,
        nextDragState: { type: "idle", state: dragState.byproducts.newState },
      },
      ctx,
      pointer
    );
  } else if (dragState.type === "drag-params") {
    return {
      type: "idle",
      state: dragState.stateFromParams(...dragState.curParams),
    };
  } else {
    assertNever(dragState);
  }
}

type RenderContext<T extends object> = DragContext<T> & {
  setDragState: (newDragState: DOmit<DragState<T>, "byproducts">) => void;
  throwRenderError: (error: unknown) => void;
  setPointerFromEvent: (e: globalThis.PointerEvent) => Vec2;
};

type DrawModeProps<T extends object, Type> = {
  dragState: DragState<T> & { type: Type };
  ctx: RenderContext<T>;
};

const DrawIdleMode = memoGeneric(
  <T extends object>({ dragState, ctx }: DrawModeProps<T, "idle">) => {
    const content = ctx.manipulable({
      state: dragState.state,
      drag: unsafeDrag,
      draggedId: null,
      setState: (
        newState: SetStateAction<T>,
        {
          easing = d3Ease.easeCubicInOut,
          seconds = 0.4,
          immediate = false,
        } = {}
      ) => {
        try {
          newState =
            typeof newState === "function"
              ? newState(dragState.state)
              : newState;

          if (immediate) {
            ctx.setDragState({
              type: "idle",
              state: newState,
            });
            return;
          }

          // animate to new state
          ctx.setDragState({
            type: "animating",
            startHoisted: postProcessReadOnly(content),
            targetHoisted: renderManipulableReadOnly(ctx.manipulable, {
              state: newState,
              draggedId: null,
            }),
            startTime: Date.now(),
            easing,
            duration: seconds * 1000,
            nextDragState: { type: "idle", state: newState },
          });
        } catch (error) {
          ctx.throwRenderError(error);
        }
      },
    });

    return drawHoisted(
      postProcessForInteraction(content, dragState.state, ctx)
    );
  }
);

const DrawAnimatingMode = memoGeneric(
  <T extends object>({ dragState }: DrawModeProps<T, "animating">) => {
    return drawHoisted(
      lerpHoisted(
        dragState.startHoisted,
        dragState.targetHoisted,
        dragState.byproducts.easedProgress
      )
    );
  }
);

const DrawDragManifoldsMode = memoGeneric(
  <T extends object>({
    dragState,
    ctx,
  }: DrawModeProps<T, "drag-manifolds">) => {
    return (
      <>
        {drawHoisted(dragState.byproducts.hoistedToRender)}
        {ctx.debugMode && dragState.byproducts.debugView()}
      </>
    );
  }
);

const DrawDragDetachReattachMode = memoGeneric(
  <T extends object>({
    dragState,
  }: DrawModeProps<T, "drag-detach-reattach">) => {
    return drawHoisted(dragState.byproducts.hoistedToRender);
  }
);

const DrawDragParamsMode = memoGeneric(
  <T extends object>({ dragState, ctx }: DrawModeProps<T, "drag-params">) => {
    return (
      <>
        {drawHoisted(postProcessReadOnly(dragState.byproducts.content))}
        {ctx.debugMode && dragState.byproducts.debugView()}
      </>
    );
  }
);

export type DrawerConfig = {
  snapRadius: number;
  chainDrags: boolean;
  relativePointerMotion: boolean;
  animationDuration: number;
};
