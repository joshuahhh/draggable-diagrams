import * as d3Ease from "d3-ease";
import _ from "lodash";
import React, {
  SetStateAction,
  cloneElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { assert } from "vitest";
import {
  DragSpec,
  DragSpecFloating,
  DragSpecManifold,
  DragSpecParams,
  Exit,
  ExitLike,
  isDragSpecParams,
  span,
  toExit,
} from "./DragSpec";
import {
  Manipulable,
  ManipulableProps,
  getDragSpecCallbackOnElement,
  unsafeDrag,
} from "./manipulable";
import { Delaunay } from "./math/delaunay";
import {
  LerpSpringState,
  createLerpSpringState,
  step,
} from "./math/lerp-spring-f";
import { minimize } from "./math/minimize";
import { Vec2 } from "./math/vec2";
import { getAtPath, setAtPath } from "./paths";
import { PrettyPrint } from "@joshuahhh/pretty-print";
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
  hoistedPrefixIds,
  hoistedShiftZIndices,
  hoistedTransform,
} from "./svgx/hoist";
import { lerpHoisted, lerpHoisted3 } from "./svgx/lerp";
import { assignPaths, findByPath, getPath } from "./svgx/path";
import { globalToLocal, localToGlobal, parseTransform } from "./svgx/transform";
import { useAnimationLoop } from "./useAnimationLoop";
import { CatchToRenderError, useCatchToRenderError } from "./useRenderError";
import {
  DOmit,
  assertDefined,
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
  const catchToRenderError = useCatchToRenderError();

  const [dragState, setDragState] = useState<DragState<T>>({
    type: "idle",
    state: initialState,
  });
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
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
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setPaused((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
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
      const ds = dragStateRef.current;
      if (
        ds.type === "animating" ||
        ds.type === "drag-floating" ||
        ds.type === "drag-manifolds" ||
        ds.type === "drag-params"
      ) {
        const newState = updateDragState(ds, dragContext, pointerRef.current);
        dragStateRef.current = newState; // Update ref immediately, don't wait for React re-render
        setDragState(newState);
      }
    }, [dragContext, setDragState])
  );

  useEffect(() => {
    if (
      dragState.type === "drag-manifolds" ||
      dragState.type === "drag-floating" ||
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
      dragState.type !== "drag-floating" &&
      dragState.type !== "drag-params"
    ) {
      return;
    }

    const onPointerMove = catchToRenderError((e: globalThis.PointerEvent) => {
      if (pausedRef.current) return;
      // Just update the pointer position. The animation loop will
      // pick it up via pointerRef and call updateDragState once per
      // frame — avoids two competing updates per frame that produce
      // erratic dt/dtPrev ratios in the spring.
      setPointerFromEvent(e);
    });

    const onPointerUp = catchToRenderError((e: globalThis.PointerEvent) => {
      if (pausedRef.current) return;
      const pointer = setPointerFromEvent(e);
      const newState = handlePointerUp(dragStateRef.current, dragContext, pointer);
      dragStateRef.current = newState;
      setDragState(newState);
    });

    const onPointerCancel = () => {
      // TODO: we need to do something with dragstate in this case
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [
    catchToRenderError,
    dragContext,
    dragState.type,
    setDragState,
    setPointerFromEvent,
  ]);

  // prettyLog(sortedEntries, { label: "sortedEntries for rendering" });

  const renderContext: RenderContext<T> = useMemo(() => {
    return {
      ...dragContext,
      setPointerFromEvent,
      setDragState: setDragStateWithoutByproducts,
      catchToRenderError,
    };
  }, [
    dragContext,
    setDragStateWithoutByproducts,
    setPointerFromEvent,
    catchToRenderError,
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
      ) : dragState.type === "drag-floating" ? (
        <DrawDragFloatingMode dragState={dragState} ctx={renderContext} />
      ) : dragState.type === "drag-params" ? (
        <DrawDragParamsMode dragState={dragState} ctx={renderContext} />
      ) : (
        assertNever(dragState)
      )}
    </svg>
  );
}

export type RenderedExit<T> = Exit<T> & {
  /**
   * A pre-rendered hoisted diagram of the state.
   */
  hoisted: HoistedSvgx;
};

export type RenderedExitWithDragged<T> = RenderedExit<T> & {
  draggedElement: Svgx;
};

export type Manifold<T> = {
  exits: RenderedExitWithDragged<T>[];
  delaunay: Delaunay;
};

export type DragState<T> =
  | { type: "idle"; state: T }
  | {
      type: "drag-manifolds";
      draggedPath: string;
      draggedId: string | null;
      pointerLocal: Vec2;
      startingPoint: RenderedExitWithDragged<T>;
      manifolds: Manifold<T>[];
      byproducts: {
        hoistedToRender: HoistedSvgx;
        pointer: Vec2;
        manifoldProjections: Array<{
          manifold: Manifold<T>;
          projectedPt: Vec2;
          dist: number;
        }>;
        newState: T;
        snapRadius: number;
      };
    }
  | {
      type: "drag-floating";
      dragSpec: DragSpecFloating<T>;
      draggedPath: string;
      draggedId: string;
      pointerLocal: Vec2;
      pointerStart: Vec2;
      /**
       * Rendered from spec.states
       */
      exits: RenderedExitWithDragged<T>[];
      /**
       * Rendered from spec.backdropExit (if it was an Exit)
       */
      backdropExit: RenderedExit<T> | undefined;
      /**
       * Raw params spec for backdrop (if spec.backdropExit was a DragSpecParams).
       * Used to dynamically compute backdrop state based on pointer position.
       */
      backdropParams: DragSpecParams<T> | undefined;
      /**
       * Current optimization params for backdrop params mode.
       * Tracks the params found by `minimize` across frames.
       */
      curParams: number[] | undefined;
      /**
       * Timestamp when we entered params backdrop mode. Used to
       * spring the background for a short period, then snap to exact.
       */
      paramsEnteredAt: number | undefined;
      /**
       * Rendered floating representation of the dragged element;
       * stays fixed during drag.
       */
      floatHoisted: HoistedSvgx;
      /**
       * Rendered background representation of the diagram (without
       * float, but with ghost!), as it springs from state to state.
       */
      backgroundSpringState: LerpSpringState<HoistedSvgx>;
      byproducts: {
        /**
         * Composite of background and floating element that should
         * be rendered.
         */
        hoistedToRender: HoistedSvgx;
        /**
         * The active exit that should be used on pointer-up.
         */
        exit: Exit<T>;
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
        pointer: Vec2;
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
          onPointerDown: ctx.catchToRenderError((e: React.PointerEvent) => {
            // console.log("onPointerDown");
            e.stopPropagation();
            const pointer = ctx.setPointerFromEvent(e.nativeEvent);
            const accumulatedTransform = getAccumulatedTransform(el);
            const transforms = parseTransform(accumulatedTransform || "");
            const pointerLocal = globalToLocal(transforms, pointer);
            const path = getPath(el);
            assert(!!path, "Draggable element must have a path");
            ctx.setDragState(
              dragStateFromSpec(
                state,
                path,
                el.props.id || null,
                dragSpecCallback(),
                pointerLocal,
                pointer,
                ctx.manipulable
              )
            );
          }),
        };
      }),
    hoistSvg
  );
}

function renderExit<T extends object>({
  exitLike,
  manipulable,
  draggedId,
  ghostId,
}: {
  /** The state we want to make a manifold point for; terrible name huh? */
  exitLike: ExitLike<T>;
  manipulable: Manipulable<T>;
  draggedId: string | null;
  ghostId?: string;
}): RenderedExit<T> {
  const exit = toExit(exitLike);

  // Use a no-op draggable to avoid attaching event handlers
  const hoisted = renderManipulableReadOnly(manipulable, {
    state: exit.state,
    draggedId,
    ghostId: ghostId || null,
  });

  return { ...exit, hoisted };
}

function renderExitWithDragged<T extends object>({
  exitLike,
  manipulable,
  draggedPath,
  draggedId,
  ghostId,
  prevState,
}: {
  /** The state we want to make a manifold point for; terrible name huh? */
  exitLike: ExitLike<T>;
  manipulable: Manipulable<T>;
  draggedPath: string;
  draggedId: string | null;
  ghostId?: string;
  /** The state we enter from; only used for debug output. */
  prevState: T;
}): RenderedExitWithDragged<T> {
  const renderedExit = renderExit({
    exitLike,
    manipulable,
    draggedId,
    ghostId,
  });
  // prettyLog(hoisted, { label: "hoisted in makeManifoldPoint" });
  console.log("gonna find", draggedPath, "in hoisted:");
  // prettyLog(hoisted);
  const draggedElement = findByPathInHoisted(draggedPath, renderedExit.hoisted);
  assertWithJSX(
    !!draggedElement,
    "renderExitWithDragged: can't find draggable element in hoisted SVG",
    () => (
      <>
        <p className="mb-2">
          We're looking for an element with path{" "}
          <span className="font-mono">{draggedPath}</span> inside:
        </p>
        <PrettyPrint value={renderedExit.hoisted} />
        <p className="mb-2">
          This came up when figuring out how to go from state:
        </p>
        <PrettyPrint value={prevState} />
        <p className="mb-2">to state:</p>
        <PrettyPrint value={renderedExit.state} />
      </>
    )
  );

  // console.log("making manifold point; element:");
  // prettyLog(element);

  return { ...renderedExit, draggedElement };
}

// TODO: memoize
export function getManifoldPointPosition<T>(
  manifoldPoint: RenderedExitWithDragged<T>,
  pointerLocal: Vec2
): Vec2 {
  const accumulatedTransform = getAccumulatedTransform(
    manifoldPoint.draggedElement
  );
  const transforms = parseTransform(accumulatedTransform || "");
  return localToGlobal(transforms, pointerLocal);
}

/**
 * If we want to enter a dragging mode (defined by a dragSpec) from a
 * state, this gives the resulting DragState (minus "byproducts",
 * which should be calculated by updateDragState).
 *
 * This is the spiritual core of pointer-down handling.
 */
function dragStateFromSpec<T extends object>(
  /** The state we enter from. */
  prevState: T,
  draggedPath: string,
  draggedId: string | null,
  dragSpec: DragSpec<T>,
  pointerLocal: Vec2,
  pointerStart: Vec2,
  manipulable: Manipulable<T>
): DOmit<DragState<T>, "byproducts"> {
  console.log("enterDraggingMode", prevState, draggedPath);

  if (hasKey(dragSpec, "type") && dragSpec.type === "params") {
    return {
      type: "drag-params",
      draggedPath,
      draggedId,
      pointerLocal,
      curParams: dragSpec.initParams,
      stateFromParams: dragSpec.stateFromParams,
    };
  } else if (hasKey(dragSpec, "type") && dragSpec.type === "param-paths") {
    return {
      type: "drag-params",
      draggedPath,
      draggedId,
      pointerLocal,
      curParams: dragSpec.paramPaths.map((path) => getAtPath(prevState, path)),
      stateFromParams: (...params: number[]) => {
        let newState = prevState;
        dragSpec.paramPaths.forEach((path, idx) => {
          newState = setAtPath(newState, path, params[idx]);
        });
        return newState;
      },
    };
  } else if (hasKey(dragSpec, "type") && dragSpec.type === "floating") {
    // first we want to get the floating part, so render the starting
    // state without any ghost
    const renderedBefore = renderExitWithDragged({
      prevState,
      exitLike: prevState,
      manipulable,
      draggedPath,
      draggedId,
    });

    // snatch out the dragged SVG element
    assert(!!draggedId, "Dragged element needs ID for 'floating' drags");
    const { extracted: floatHoisted } = hoistedExtract(
      renderedBefore.hoisted,
      draggedId
    );

    const { ghost } = dragSpec;
    const draggedIdForSure = draggedId;
    function postProcessExitForGhost(exit: RenderedExitWithDragged<T>) {
      if (ghost === false) {
        const { remaining } = hoistedExtract(exit.hoisted, draggedIdForSure);
        return { ...exit, hoisted: remaining };
      } else if (ghost === true) {
        return exit;
      } else {
        // SVG attributes
        // TODO: support for merging style? other stuff like that?
        const oldGhost = assertDefined(exit.hoisted.byId.get(draggedIdForSure));
        exit.hoisted.byId.set(draggedIdForSure, cloneElement(oldGhost, ghost));
        return exit;
      }
    }

    // now we want to render the background (with ghost if needed)
    const startingExit = pipe(
      renderExitWithDragged({
        prevState,
        exitLike: prevState,
        manipulable,
        draggedPath,
        draggedId,
        ghostId: draggedId,
      }),
      postProcessExitForGhost
    );

    // Handle backdrop - either a pre-rendered exit or params for dynamic computation
    let backdropExit: RenderedExit<T> | undefined = undefined;
    let backdropParams: DragSpecParams<T> | undefined = undefined;
    const backdropSpec = dragSpec.backdropExit;
    if (backdropSpec) {
      if (isDragSpecParams(backdropSpec)) {
        backdropParams = backdropSpec;
      } else {
        // Type guard doesn't narrow properly with generics, but we know it's ExitLike<T> here
        backdropExit = renderExit({
          exitLike: backdropSpec as ExitLike<T>,
          manipulable,
          draggedId,
        });
      }
    }

    // Build initial curParams from backdropParams spec
    let initialCurParams: number[] | undefined = undefined;
    if (backdropParams) {
      // Cast needed: TS over-narrows the DragSpecParams union through isDragSpecParams
      const bp = backdropParams as DragSpecParams<T>;
      if (bp.type === "param-paths") {
        const baseState = bp.baseState ?? prevState;
        initialCurParams = bp.paramPaths.map((path) =>
          getAtPath(baseState, path)
        );
      } else {
        initialCurParams = bp.initParams;
      }
    }

    return {
      type: "drag-floating",
      dragSpec,
      draggedPath,
      draggedId,
      pointerLocal,
      pointerStart,
      exits: dragSpec.states.map((targetState) =>
        postProcessExitForGhost(
          renderExitWithDragged({
            prevState,
            exitLike: targetState,
            manipulable,
            draggedPath,
            draggedId,
            ghostId: draggedId,
          })
        )
      ),
      backdropExit,
      backdropParams,
      curParams: initialCurParams,
      paramsEnteredAt: undefined,
      floatHoisted,
      backgroundSpringState: createLerpSpringState(
        startingExit.hoisted,
        performance.now()
      ),
    };
  } else {
    const manifoldSpecs: DragSpecManifold<T>[] = pipe(
      manyToArray(dragSpec),
      (arr) => (arr.length === 0 ? [span<T>([])] : arr) // things go wrong if no manifolds
    );

    const makeManifoldPointProps: Parameters<
      typeof renderExitWithDragged<T>
    >[0] = {
      prevState,
      exitLike: prevState,
      manipulable,
      draggedPath,
      draggedId,
    };

    const startingPoint = renderExitWithDragged(makeManifoldPointProps);

    const manifolds: Manifold<T>[] = manifoldSpecs.map((manifoldSpec) => {
      const states =
        manifoldSpec.type === "manifold"
          ? manifoldSpec.states
          : manifoldSpec.type === "straight-to"
          ? [prevState, manifoldSpec.state]
          : assertNever(manifoldSpec);

      const exits = states.map((state) =>
        renderExitWithDragged({ ...makeManifoldPointProps, exitLike: state })
      );
      const positions = exits.map((pt) =>
        getManifoldPointPosition(pt, pointerLocal).arr()
      );
      console.log("triangulating manifold with points:", positions);
      const delaunay = new Delaunay(positions);
      console.log("created delaunay:", delaunay);
      return { exits, delaunay };
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
}

type DragContext<T extends object> = {
  // pointer: Vec2;
  drawerConfig: DrawerConfig;
  manipulable: Manipulable<T>;
  debugMode: boolean;
};

/**
 * This is the spiritual core of pointer-move and animation frame
 * handling.
 */
function updateDragState<T extends object>(
  dragState: DOmit<DragState<T>, "byproducts">,
  ctx: DragContext<T>,
  pointer?: Vec2
): DragState<T> {
  if (dragState.type === "idle") {
    return dragState;
  } else if (dragState.type === "animating") {
    const now = performance.now();
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

    const pos = (pt: RenderedExitWithDragged<T>) =>
      getManifoldPointPosition(pt, dragState.pointerLocal);

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
      dragState.manifolds.flatMap((m) => m.exits),
      (manifoldPt) => pointer.dist(pos(manifoldPt))
    )!;

    // TODO: it would be nice to animate towards .state before
    // jumping to .andThen
    newState = closestManifoldPt.andThen ?? closestManifoldPt.state;

    // Check if it's time to snap
    if (
      ctx.drawerConfig.chainDrags &&
      bestManifoldProjection.projectedPt.dist(pos(closestManifoldPt)) <
        ctx.drawerConfig.snapRadius
    ) {
      if (!_.isEqual(newState, dragState.startingPoint.state)) {
        // time to snap!

        const dragSpecCallback = getDragSpecCallbackOnElement<T>(
          closestManifoldPt.draggedElement
        );

        // console.log("snapping to new state", newState, dragSpecCallback);

        // special case: the thing we're snapping to doesn't have a drag spec at all
        if (!dragSpecCallback) {
          return { type: "idle", state: newState };
        } else {
          // normal case
          const newDragState = dragStateFromSpec(
            newState,
            dragState.draggedPath,
            dragState.draggedId,
            dragSpecCallback(),
            dragState.pointerLocal,
            pointer,
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
        hoistedToRender = bestManifoldProjection.manifold.exits[ptIdx].hoisted;
      } else if (bestManifoldProjection.type === "edge") {
        const { ptIdx0, ptIdx1, t } = bestManifoldProjection;
        hoistedToRender = lerpHoisted(
          bestManifoldProjection.manifold.exits[ptIdx0].hoisted,
          bestManifoldProjection.manifold.exits[ptIdx1].hoisted,
          t
        );
      } else {
        const { ptIdx0, ptIdx1, ptIdx2, barycentric } = bestManifoldProjection;
        hoistedToRender = lerpHoisted3(
          bestManifoldProjection.manifold.exits[ptIdx0].hoisted,
          bestManifoldProjection.manifold.exits[ptIdx1].hoisted,
          bestManifoldProjection.manifold.exits[ptIdx2].hoisted,
          barycentric
        );
      }
    }

    return {
      ...dragState,
      byproducts: {
        hoistedToRender,
        manifoldProjections,
        pointer,
        newState,
        snapRadius: ctx.drawerConfig.snapRadius,
      },
    };
  } else if (dragState.type === "drag-floating") {
    assert(!!pointer, "Pointer must be defined in drag-floating mode");

    const pos = (pt: RenderedExitWithDragged<T>) =>
      getManifoldPointPosition(pt, dragState.pointerLocal);

    // compute background target based on proximity to positions
    const closestPoint = _.minBy(dragState.exits, (pt) =>
      pointer.dist(pos(pt))
    )!;
    let exitPointless: RenderedExit<T> = closestPoint;
    // TODO: figure out how to control this radius (overlap?)
    const useBackdrop = pointer.dist(pos(closestPoint)) > 50;
    // Both paths render in the same structure: spring on background
    // (element extracted) + "floating-" prefixed dragged element on
    // top. This keeps the hoisted trees structurally compatible so
    // the spring lerps cleanly when transitioning between modes.
    let backgroundTarget: HoistedSvgx;
    let floatForFrame: HoistedSvgx;
    let newCurParams: number[] | undefined = undefined;
    let exit: Exit<T>;

    if (useBackdrop && dragState.backdropExit) {
      exitPointless = dragState.backdropExit;
      backgroundTarget = exitPointless.hoisted;
      floatForFrame = hoistedTransform(
        dragState.floatHoisted,
        translate(pointer.sub(dragState.pointerStart))
      );
      exit = exitPointless;
    } else if (useBackdrop && dragState.backdropParams) {
      // Use minimize to find params that place the dragged element
      // under the cursor, same pattern as drag-params mode.
      const bParams = dragState.backdropParams;
      const stateFromParams: (...params: number[]) => T =
        bParams.type === "param-paths"
          ? (...params: number[]) => {
              let newState = (bParams.baseState ?? closestPoint.state) as T;
              bParams.paramPaths.forEach((path, idx) => {
                newState = setAtPath(newState, path, params[idx]);
              });
              return newState;
            }
          : bParams.stateFromParams;

      const curParams = dragState.curParams!;

      const objectiveFn = (params: number[]) => {
        const candidateState = stateFromParams(...params);
        const content = pipe(
          ctx.manipulable({
            state: candidateState,
            drag: unsafeDrag,
            draggedId: dragState.draggedId,
            ghostId: null,
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

      const r = minimize(objectiveFn, curParams);
      newCurParams = r.solution;

      const computedState = stateFromParams(...newCurParams);
      const paramsHoisted = renderManipulableReadOnly(ctx.manipulable, {
        state: computedState,
        draggedId: dragState.draggedId,
        ghostId: null,
      });

      // Extract dragged element so the background is structurally
      // compatible with the float+spring exits. The extracted
      // element becomes the float for this frame.
      const { extracted, remaining } = hoistedExtract(
        paramsHoisted,
        dragState.draggedId
      );
      backgroundTarget = remaining;
      floatForFrame = extracted;
      exit = { state: computedState, andThen: undefined };
    } else {
      backgroundTarget = closestPoint.hoisted;
      floatForFrame = hoistedTransform(
        dragState.floatHoisted,
        translate(pointer.sub(dragState.pointerStart))
      );
      exit = closestPoint;
    }

    // Track when we enter params mode. Spring the background for a
    // short transition period, then snap to exact (no lag).
    const isInParams = newCurParams !== undefined;
    const now = performance.now();
    let paramsEnteredAt = dragState.paramsEnteredAt;
    if (isInParams && paramsEnteredAt === undefined) {
      paramsEnteredAt = now; // just entered
    } else if (!isInParams) {
      paramsEnteredAt = undefined; // left params mode
    }
    const paramsTransitionMs = 200;
    const paramsSettled =
      isInParams && paramsEnteredAt !== undefined &&
      now - paramsEnteredAt > paramsTransitionMs;

    const newBackgroundSpringState = paramsSettled
      ? createLerpSpringState(backgroundTarget, now)
      : step(
          dragState.backgroundSpringState,
          {
            omega: 0.03, // spring frequency (rad/ms)
            gamma: 0.1, // damping rate (1/ms)
          },
          lerpHoisted,
          now,
          backgroundTarget
        );

    const hoistedToRender = hoistedMerge(
      newBackgroundSpringState.cur,
      pipe(
        floatForFrame,
        (d) => hoistedPrefixIds(d, "floating-"),
        dragState.dragSpec.onTop
          ? // HACK: hierarchical z-indices would be cleaner
            (d) => hoistedShiftZIndices(d, 1000000)
          : (d) => d
      )
    );

    return {
      ...dragState,
      curParams: newCurParams ?? dragState.curParams,
      paramsEnteredAt,
      backgroundSpringState: newBackgroundSpringState,
      byproducts: {
        exit,
        hoistedToRender,
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
          ghostId: null,
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
      ghostId: null,
      setState: throwError,
    });

    return { ...dragState, byproducts: { content, pointer } };
  } else {
    assertNever(dragState);
  }
}

/**
 * This is the spiritual core of pointer-up handling.
 */
function handlePointerUp<T extends object>(
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
          ghostId: null,
        }),
        startTime: performance.now(),
        easing: d3Ease.easeElastic,
        duration: ctx.drawerConfig.animationDuration,
        nextDragState: { type: "idle", state: dragState.byproducts.newState },
      },
      ctx,
      pointer
    );
  } else if (dragState.type === "drag-floating") {
    // Currently dragState.byproducts.hoistedToRender is displayed.
    // It shows the floating element together with a background. In
    // the target diagram, either the dragged element is present or
    // it's been removed. In the first case, we want to animate into
    // a state where the floating element is at its position in the
    // final state. In the second case, we want it to animate out.
    const exit = dragState.byproducts.exit;
    const targetState = exit.andThen ?? exit.state;
    let hoistedToRenderAfter = renderExit({
      exitLike: targetState,
      draggedId: dragState.draggedId,
      manipulable: ctx.manipulable,
    }).hoisted;

    if (hoistedToRenderAfter.byId.has(dragState.draggedId)) {
      // To properly animate the floating element to its final
      // position, re-id the final-diagram version of the dragged
      // element to have the "floating-" prefix.
      const { extracted, remaining } = hoistedExtract(
        hoistedToRenderAfter,
        dragState.draggedId
      );
      hoistedToRenderAfter = hoistedMerge(
        hoistedPrefixIds(extracted, "floating-"),
        remaining
      );
    }
    return updateDragState(
      {
        type: "animating",
        startHoisted: dragState.byproducts.hoistedToRender,
        targetHoisted: hoistedToRenderAfter,
        startTime: performance.now(),
        easing: d3Ease.easeElastic,
        duration: ctx.drawerConfig.animationDuration,
        nextDragState: { type: "idle", state: targetState },
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
  catchToRenderError: CatchToRenderError;
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
      ghostId: null,
      setState: ctx.catchToRenderError(
        (
          newState: SetStateAction<T>,
          {
            easing = d3Ease.easeCubicInOut,
            seconds = 0.4,
            immediate = false,
          } = {}
        ) => {
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
              ghostId: null,
            }),
            startTime: performance.now(),
            easing,
            duration: seconds * 1000,
            nextDragState: { type: "idle", state: newState },
          });
        }
      ),
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
        {ctx.debugMode && debugForDragManifoldsMode(dragState)}
      </>
    );
  }
);

function debugForDragManifoldsMode(
  dragState: DragState<any> & { type: "drag-manifolds" }
): Svgx {
  const debugRender: React.ReactElement[] = [];

  dragState.byproducts.manifoldProjections.forEach((proj, manifoldIdx) => {
    const { manifold, projectedPt } = proj;

    // Draw red circles at manifold points
    manifold.exits.forEach((pt, ptIdx) => {
      debugRender.push(
        <circle
          key={`manifold-${manifoldIdx}-point-${ptIdx}`}
          {...getManifoldPointPosition(pt, dragState.pointerLocal).cxy()}
          r={dragState.byproducts.snapRadius}
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
        {...projectedPt.cxy()}
        r={10}
        stroke="blue"
        strokeWidth={2}
        fill="none"
      />
    );

    // Draw blue line from draggable dest to projected point
    debugRender.push(
      <line
        {...dragState.byproducts.pointer.xy1()}
        {...projectedPt.xy2()}
        stroke="blue"
        strokeWidth={2}
      />
    );
  });

  return <>{debugRender}</>;
}

const DrawDragFloatingMode = memoGeneric(
  <T extends object>({ dragState }: DrawModeProps<T, "drag-floating">) => {
    return drawHoisted(dragState.byproducts.hoistedToRender);
  }
);

const DrawDragParamsMode = memoGeneric(
  <T extends object>({ dragState, ctx }: DrawModeProps<T, "drag-params">) => {
    return (
      <>
        {drawHoisted(postProcessReadOnly(dragState.byproducts.content))}
        {ctx.debugMode && debugForDragParamsMode(dragState)}
      </>
    );
  }
);

function debugForDragParamsMode(
  dragState: DragState<any> & { type: "drag-params" }
): Svgx {
  const debugRender: React.ReactElement[] = [];

  const processedContent = pipe(
    dragState.byproducts.content,
    assignPaths,
    accumulateTransforms
  );
  const element = findByPath(dragState.draggedPath, processedContent);
  if (element) {
    const accumulateTransform = getAccumulatedTransform(element);
    const transforms = parseTransform(accumulateTransform || "");
    const achievedPos = localToGlobal(transforms, dragState.pointerLocal);

    debugRender.push(
      <circle
        key="drag-params-achieved"
        {...achievedPos.cxy()}
        r={5}
        fill="green"
        stroke="darkgreen"
        strokeWidth={2}
      />
    );

    debugRender.push(
      <line
        key="drag-params-line"
        {...achievedPos.xy1()}
        {...dragState.byproducts.pointer.xy2()}
        stroke="orange"
        strokeWidth={2}
        strokeDasharray="4 4"
      />
    );
  }

  return <>{debugRender}</>;
}

export type DrawerConfig = {
  snapRadius: number;
  chainDrags: boolean;
  relativePointerMotion: boolean;
  animationDuration: number;
};
