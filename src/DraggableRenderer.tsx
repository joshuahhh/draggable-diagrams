import * as d3Ease from "d3-ease";
import React, {
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { assert } from "vitest";
import {
  BehaviorContext,
  DragBehavior,
  DragFrame,
  DragResult,
  dragSpecToBehavior,
} from "./DragBehavior";
import { DragSpec, DragSpecBuilder } from "./DragSpec";
import {
  DragParams,
  Draggable,
  DraggableProps,
  getDragSpecCallbackOnElement,
} from "./draggable";
import { Vec2 } from "./math/vec2";
import { Svgx, findElement, updatePropsDownTree } from "./svgx";
import {
  LayeredSvgx,
  accumulateTransforms,
  drawLayered,
  getAccumulatedTransform,
  layerSvg,
  layeredExtract,
} from "./svgx/layers";
import { lerpLayered } from "./svgx/lerp";
import { assignPaths, findByPath, getPath } from "./svgx/path";
import { globalToLocal, parseTransform } from "./svgx/transform";
import { useAnimationLoop } from "./useAnimationLoop";
import { CatchToRenderError, useCatchToRenderError } from "./useRenderError";
import { useStateWithRef } from "./useStateWithRef";
import { assertNever, memoGeneric, pipe, throwError } from "./utils";

function dragParamsFromEvent(e: {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): DragParams {
  return {
    altKey: e.altKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    shiftKey: e.shiftKey,
  };
}

// # Engine state machine

export type Transition = {
  easing: "cubic-out" | "elastic-out" | ((t: number) => number);
  duration: number;
};

function applyEasing({ easing, duration }: Transition, t: number): number {
  const easingFunction =
    typeof easing === "function"
      ? easing
      : easing === "cubic-out"
        ? d3Ease.easeCubicOut
        : easing === "elastic-out"
          ? d3Ease.easeElasticOut
          : assertNever(easing);
  return easingFunction(t / duration);
}

export type TransitionLike =
  | Transition
  | Transition["easing"]
  | Transition["duration"]
  | boolean
  | undefined;

export function resolveTransitionLike(
  t: TransitionLike,
): Transition | undefined {
  if (!t) return undefined;
  if (typeof t === "object") {
    return t;
  }
  let transition: Transition = {
    easing: "cubic-out",
    duration: 200,
  };
  if (typeof t === "string" || typeof t === "function") {
    transition.easing = t;
  } else if (typeof t === "number") {
    transition.duration = t;
  }
  return transition;
}

type SpringingFrom = {
  layered: LayeredSvgx;
  time: number;
  transition: Transition;
};

type PendingDrag<T extends object> = {
  startClientPos: Vec2;
  threshold: number;
  dragState: DragState<T> & { type: "dragging" };
  debugInfo: DebugDragInfo<T>;
};

type DragState<T extends object> = { springingFrom: SpringingFrom | null } & (
  | { type: "idle"; state: T; pendingDrag?: PendingDrag<T> }
  | {
      type: "dragging";
      startState: T;
      behavior: DragBehavior<T>;
      spec: DragSpec<T>;
      behaviorCtx: BehaviorContext<T>;
      pointerStart: Vec2;
      draggedId: string | null;
      result: DragResult<T>;
      dragParams: DragParams;
      dragParamsCallback: (params: DragParams) => DragSpec<T>;
      originalStartState: T;
      originalBehaviorCtxWithoutFloat: Omit<BehaviorContext<T>, "floatLayered">;
    }
);

// # Debug info

export type DebugDragInfo<T extends object> =
  | { type: "idle"; state: T }
  | {
      type: "dragging";
      spec: DragSpec<T>;
      behaviorCtx: BehaviorContext<T>;
      activePath: string;
      pointerStart: Vec2;
      draggedId: string | null;
      dropState: T;
    };

// # Component

interface DraggableRendererProps<T extends object> {
  draggable: Draggable<T>;
  initialState: T;
  width?: number;
  height?: number;
  onDebugDragInfo?: (info: DebugDragInfo<T>) => void;
  showDebugOverlay?: boolean;
  /**
   * Minimum pointer movement (in px) before a pointerdown becomes a drag.
   * Below this threshold the gesture is treated as a click — the state
   * machine stays idle, so onClick handlers on the element fire normally.
   * Set to 0 to start drags immediately (old behavior). Default: 2.
   */
  dragThreshold?: number;
}

export function DraggableRenderer<T extends object>({
  draggable,
  initialState,
  width,
  height,
  onDebugDragInfo,
  showDebugOverlay,
  dragThreshold = 2,
}: DraggableRendererProps<T>) {
  const catchToRenderError = useCatchToRenderError();

  const [dragState, setDragState, dragStateRef] = useStateWithRef<DragState<T>>(
    {
      type: "idle",
      state: initialState,
      springingFrom: null,
    },
  );
  const pointerRef = useRef<Vec2 | undefined>(undefined);
  const onDebugDragInfoRef = useRef(onDebugDragInfo);
  onDebugDragInfoRef.current = onDebugDragInfo;

  const [svgElem, setSvgElem] = useState<SVGSVGElement | null>(null);

  const setPointerFromEvent = useCallback(
    (e: globalThis.PointerEvent) => {
      assert(!!svgElem);
      const rect = svgElem.getBoundingClientRect();
      const pointer = Vec2(e.clientX - rect.left, e.clientY - rect.top);
      pointerRef.current = pointer;
      return pointer;
    },
    [svgElem],
  );

  // Animation loop: update dragging states and spring decay each frame
  useAnimationLoop(
    useCallback(() => {
      const ds = dragStateRef.current;
      if (ds.type === "dragging") {
        const pointer = pointerRef.current;
        if (!pointer) return;
        const frame: DragFrame = { pointer, pointerStart: ds.pointerStart };
        const result = ds.behavior(frame);

        let springingFrom = ds.springingFrom;

        // Handle chaining: restart drag from new state
        // TODO: detection of "new state" probably isn't robust
        if (result.chainNow && result.dropState !== ds.startState) {
          const newState = result.dropState;
          const newDraggedId = result.chainNow.draggedId ?? ds.draggedId;
          // Render the new state and find the dragged element
          const content = pipe(
            draggable({
              state: newState,
              d: new DragSpecBuilder<T>(),
              draggedId: newDraggedId,
              ghostId: null,
              setState: throwError,
            }),
            assignPaths,
            accumulateTransforms,
          );
          const element = newDraggedId
            ? findElement(content, (el) => el.props.id === newDraggedId)
            : findByPath(ds.behaviorCtx.draggedPath, content);
          if (element) {
            const newDragSpec =
              result.chainNow.followSpec ??
              getDragSpecCallbackOnElement<T>(element)?.(ds.dragParams);
            if (newDragSpec) {
              // Start spring from current display
              const layered = runSpring(springingFrom, result.rendered);
              const newSpringingFrom: SpringingFrom = {
                layered,
                time: performance.now(),
                transition: resolveTransitionLike(true)!,
              };

              const newDraggedPath = getPath(element);
              assert(!!newDraggedPath, "Chained element must have a path");

              const pointerLocal = ds.behaviorCtx.pointerLocal;

              const { floatLayered: _, ...behaviorCtxWithoutFloat } =
                ds.behaviorCtx;
              const { dragState: chainedState, debugInfo } = initDrag(
                newDragSpec,
                {
                  ...behaviorCtxWithoutFloat,
                  draggedPath: newDraggedPath,
                  draggedId: newDraggedId,
                  pointerLocal,
                },
                newState,
                frame,
                ds.pointerStart,
                newSpringingFrom,
                {
                  dragParams: ds.dragParams,
                  dragParamsCallback: ds.dragParamsCallback,
                  originalStartState: ds.originalStartState,
                  originalBehaviorCtxWithoutFloat:
                    ds.originalBehaviorCtxWithoutFloat,
                },
              );
              setDragState(chainedState);
              onDebugDragInfoRef.current?.(debugInfo);
              return;
            }
          }
        }

        // Detect activePath change → start new spring from current display
        if (result.activePath !== ds.result.activePath) {
          const layered = runSpring(springingFrom, ds.result.rendered);
          springingFrom = {
            layered,
            time: performance.now(),
            transition: resolveTransitionLike(true)!,
          };
        }

        // Clear expired spring
        if (
          springingFrom &&
          performance.now() - springingFrom.time >=
            springingFrom.transition?.duration!
        ) {
          springingFrom = null;
        }

        const newState: DragState<T> = {
          ...ds,
          result,
          springingFrom: springingFrom,
        };
        setDragState(newState);
        onDebugDragInfoRef.current?.({
          type: "dragging",
          spec: ds.spec,
          behaviorCtx: ds.behaviorCtx,
          activePath: result.activePath,
          pointerStart: ds.pointerStart,
          draggedId: ds.draggedId,
          dropState: result.dropState,
        });
      } else if (ds.type === "idle" && ds.springingFrom) {
        if (
          performance.now() - ds.springingFrom.time >=
          ds.springingFrom.transition.duration
        ) {
          const newState: DragState<T> = { ...ds, springingFrom: null };
          setDragState(newState);
        } else {
          // Force re-render so spring progress advances
          const newState: DragState<T> = { ...ds };
          setDragState(newState);
        }
      }
    }, [dragStateRef, draggable, setDragState]),
  );

  // Cursor style
  useEffect(() => {
    document.body.style.cursor =
      dragState.type === "dragging" ? "grabbing" : "default";
  }, [dragState.type]);

  // Document-level pointer listeners during drag or pending drag
  const shouldListenToPointer =
    dragState.type === "dragging" ||
    (dragState.type === "idle" && !!dragState.pendingDrag);
  useEffect(() => {
    if (!shouldListenToPointer) return;

    const onPointerMove = catchToRenderError((e: globalThis.PointerEvent) => {
      const ds = dragStateRef.current;
      if (ds.type === "idle" && ds.pendingDrag) {
        // Pending: check threshold
        const { pendingDrag: pending } = ds;
        const clientPos = Vec2(e.clientX, e.clientY);
        const d = clientPos.sub(pending.startClientPos);
        if (d.len2() > pending.threshold * pending.threshold) {
          setPointerFromEvent(e);
          setDragState(pending.dragState);
          onDebugDragInfoRef.current?.(pending.debugInfo);
        }
      } else {
        // Dragging: track pointer
        setPointerFromEvent(e);
      }
    });

    const onPointerUp = catchToRenderError((e: globalThis.PointerEvent) => {
      const ds = dragStateRef.current;
      if (ds.type === "idle" && ds.pendingDrag) {
        // Released before threshold — clear pending, stay idle.
        const newState: DragState<T> = {
          type: "idle",
          state: ds.state,
          springingFrom: ds.springingFrom,
        };
        setDragState(newState);
        return;
      }

      if (ds.type !== "dragging") return;
      const pointer = setPointerFromEvent(e);

      const frame: DragFrame = { pointer, pointerStart: ds.pointerStart };
      const result = ds.behavior(frame);
      const dropState = result.dropState;

      // Capture the current display as the spring snapshot
      const startLayered = runSpring(ds.springingFrom, result.rendered);

      const newState: DragState<T> = {
        type: "idle",
        state: dropState,
        springingFrom: {
          layered: startLayered,
          time: performance.now(),
          transition: result.dropTransition ?? resolveTransitionLike(true)!,
        },
      };
      setDragState(newState);
      onDebugDragInfoRef.current?.({ type: "idle", state: dropState });
    });

    const onKeyChange = catchToRenderError((e: KeyboardEvent) => {
      const ds = dragStateRef.current;
      if (ds.type !== "dragging") return;

      const newParams = dragParamsFromEvent(e);
      const oldParams = ds.dragParams;
      if (
        newParams.altKey === oldParams.altKey &&
        newParams.ctrlKey === oldParams.ctrlKey &&
        newParams.metaKey === oldParams.metaKey &&
        newParams.shiftKey === oldParams.shiftKey
      )
        return;

      // Re-evaluate the drag spec with new modifier keys
      const newSpec = ds.dragParamsCallback(newParams);
      const pointer = pointerRef.current;
      if (!pointer) return;

      const frame: DragFrame = { pointer, pointerStart: ds.pointerStart };

      // Spring from current display
      const layered = runSpring(ds.springingFrom, ds.result.rendered);
      const newSpringingFrom: SpringingFrom = {
        layered,
        time: performance.now(),
        transition: resolveTransitionLike(true)!,
      };

      const { dragState: newDragState, debugInfo } = initDrag(
        newSpec,
        ds.originalBehaviorCtxWithoutFloat,
        ds.originalStartState,
        frame,
        ds.pointerStart,
        newSpringingFrom,
        {
          dragParams: newParams,
          dragParamsCallback: ds.dragParamsCallback,
          originalStartState: ds.originalStartState,
          originalBehaviorCtxWithoutFloat:
            ds.originalBehaviorCtxWithoutFloat,
        },
      );
      setDragState(newDragState);
      onDebugDragInfoRef.current?.(debugInfo);
    });

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keydown", onKeyChange);
    document.addEventListener("keyup", onKeyChange);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keydown", onKeyChange);
      document.removeEventListener("keyup", onKeyChange);
    };
  }, [
    catchToRenderError,
    dragStateRef,
    shouldListenToPointer,
    setDragState,
    setPointerFromEvent,
  ]);

  const renderCtx: RenderContext<T> = useMemo(
    () => ({
      draggable,
      catchToRenderError,
      setPointerFromEvent,
      setDragState,
      onDebugDragInfoRef,
      dragThreshold,
    }),
    [
      catchToRenderError,
      draggable,
      dragThreshold,
      setDragState,
      setPointerFromEvent,
    ],
  );

  return (
    <svg
      ref={setSvgElem}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible select-none touch-none"
    >
      {dragState.type === "idle" ? (
        <DrawIdleMode dragState={dragState} ctx={renderCtx} />
      ) : dragState.type === "dragging" ? (
        <DrawDraggingMode
          dragState={dragState}
          showDebugOverlay={showDebugOverlay}
        />
      ) : (
        assertNever(dragState)
      )}
    </svg>
  );
}

// # Helpers

/**
 * Blends a target render with a spring's startLayered.
 * The target is used as the base (first arg to lerpLayered) so its
 * non-interpolatable props (like event handlers) are preserved.
 * Layers with data-transition={false} are never sprung — they
 * always show the target's version so they track the cursor.
 */
function runSpring(
  springingFrom: SpringingFrom | null,
  target: LayeredSvgx,
): LayeredSvgx {
  if (!springingFrom) return target;
  const elapsed = performance.now() - springingFrom.time;
  const t = applyEasing(springingFrom.transition, elapsed);
  const lerped = lerpLayered(target, springingFrom.layered, 1 - t);
  // Replace non-transitioning layers with the target's version so they
  // track the cursor without spring lag.
  for (const [key, element] of lerped.byId.entries()) {
    if (element.props["data-transition"] === false) {
      const targetVal = target.byId.get(key);
      if (targetVal) {
        lerped.byId.set(key, targetVal);
      }
    }
  }
  return lerped;
}

function renderReadOnly<T extends object>(
  draggable: Draggable<T>,
  props: Omit<DraggableProps<T>, "setState">,
): LayeredSvgx {
  return pipe(
    draggable({
      ...props,
      setState: throwError,
    }),
    assignPaths,
    accumulateTransforms,
    layerSvg,
  );
}

type DragParamsInfo<T extends object> = {
  dragParams: DragParams;
  dragParamsCallback: (params: DragParams) => DragSpec<T>;
  originalStartState: T;
  originalBehaviorCtxWithoutFloat: Omit<BehaviorContext<T>, "floatLayered">;
};

function initDrag<T extends object>(
  spec: DragSpec<T>,
  behaviorCtxWithoutFloat: Omit<BehaviorContext<T>, "floatLayered">,
  state: T,
  frame: DragFrame,
  pointerStart: Vec2,
  springingFrom: SpringingFrom | null,
  dragParamsInfo: DragParamsInfo<T>,
): {
  dragState: DragState<T> & { type: "dragging" };
  debugInfo: DebugDragInfo<T>;
} {
  const { draggable, draggedId } = behaviorCtxWithoutFloat;
  let floatLayered: LayeredSvgx | null = null;
  if (draggedId) {
    const startLayered = renderReadOnly(draggable, {
      state,
      d: new DragSpecBuilder<T>(),
      draggedId,
      ghostId: null,
    });
    floatLayered = layeredExtract(startLayered, draggedId).extracted;
  }
  const behaviorCtx: BehaviorContext<T> = {
    ...behaviorCtxWithoutFloat,
    floatLayered,
  };
  const behavior = dragSpecToBehavior(spec, behaviorCtx);
  const result = behavior(frame);
  return {
    dragState: {
      type: "dragging",
      startState: state,
      behavior,
      spec,
      behaviorCtx,
      pointerStart,
      draggedId,
      result,
      springingFrom,
      ...dragParamsInfo,
    },
    debugInfo: {
      type: "dragging",
      spec,
      behaviorCtx,
      activePath: result.activePath,
      pointerStart,
      draggedId,
      dropState: result.dropState,
    },
  };
}

// # Render context

type RenderContext<T extends object> = {
  draggable: Draggable<T>;
  catchToRenderError: CatchToRenderError;
  setPointerFromEvent: (e: globalThis.PointerEvent) => Vec2;
  setDragState: (ds: DragState<T>) => void;
  onDebugDragInfoRef: React.RefObject<
    ((info: DebugDragInfo<T>) => void) | undefined
  >;
  dragThreshold: number;
};

function postProcessForInteraction<T extends object>(
  content: Svgx,
  state: T,
  ctx: RenderContext<T>,
): LayeredSvgx {
  return pipe(
    content,
    assignPaths,
    accumulateTransforms,
    (el) =>
      updatePropsDownTree(el, (el) => {
        const dragSpecCallback = getDragSpecCallbackOnElement<T>(el);
        if (!dragSpecCallback) return;
        assert(
          !el.props.onPointerDown,
          "Elements with data-on-drag cannot have onPointerDown (it is overwritten)",
        );
        return {
          style: { cursor: "grab", ...(el.props.style || {}) },
          onPointerDown: ctx.catchToRenderError((e: React.PointerEvent) => {
            e.stopPropagation();
            const pointer = ctx.setPointerFromEvent(e.nativeEvent);

            const dragParams = dragParamsFromEvent(e);
            const dragSpec: DragSpec<T> = dragSpecCallback(dragParams);
            const draggedId = el.props.id ?? null;
            const draggedPath = getPath(el);
            assert(!!draggedPath, "Dragged element must have a path");

            const accTransform = getAccumulatedTransform(el);
            const transforms = parseTransform(accTransform || "");
            const pointerLocal = globalToLocal(transforms, pointer);

            const behaviorCtxWithoutFloat = {
              draggable: ctx.draggable,
              draggedPath,
              draggedId,
              pointerLocal,
            };

            const frame: DragFrame = { pointer, pointerStart: pointer };
            const { dragState: draggingState, debugInfo } = initDrag(
              dragSpec,
              behaviorCtxWithoutFloat,
              state,
              frame,
              pointer,
              null,
              {
                dragParams,
                dragParamsCallback: dragSpecCallback,
                originalStartState: state,
                originalBehaviorCtxWithoutFloat: behaviorCtxWithoutFloat,
              },
            );

            if (ctx.dragThreshold <= 0 || !el.props.onClick) {
              ctx.setDragState(draggingState);
              ctx.onDebugDragInfoRef.current?.(debugInfo);
            } else {
              // Stay idle with pending — DOM is preserved, clicks still work.
              ctx.setDragState({
                type: "idle",
                state,
                springingFrom: null,
                pendingDrag: {
                  startClientPos: Vec2(e.clientX, e.clientY),
                  threshold: ctx.dragThreshold,
                  dragState: draggingState,
                  debugInfo,
                },
              });
            }
          }),
        };
      }),
    layerSvg,
  );
}

// # Render modes

const DrawIdleMode = memoGeneric(
  <T extends object>({
    dragState,
    ctx,
  }: {
    dragState: DragState<T> & { type: "idle" };
    ctx: RenderContext<T>;
  }) => {
    const content = ctx.draggable({
      state: dragState.state,
      d: new DragSpecBuilder<T>(),
      draggedId: null,
      ghostId: null,
      setState: ctx.catchToRenderError(
        (
          newState: SetStateAction<T>,
          { transition }: { transition?: TransitionLike } = {},
        ) => {
          const resolved =
            typeof newState === "function"
              ? (newState as (prev: T) => T)(dragState.state)
              : newState;
          const snapshot = renderReadOnly(ctx.draggable, {
            state: dragState.state,
            d: new DragSpecBuilder<T>(),
            draggedId: null,
            ghostId: null,
          });
          ctx.setDragState({
            type: "idle",
            state: resolved,
            springingFrom: {
              layered: snapshot,
              time: performance.now(),
              transition: resolveTransitionLike(transition) || {
                easing: "cubic-out",
                duration: 200,
              },
            },
          });
          ctx.onDebugDragInfoRef.current?.({ type: "idle", state: resolved });
        },
      ),
    });

    const layered = postProcessForInteraction(content, dragState.state, ctx);
    return drawLayered(runSpring(dragState.springingFrom, layered));
  },
);

const DrawDraggingMode = memoGeneric(
  <T extends object>({
    dragState,
    showDebugOverlay,
  }: {
    dragState: DragState<T> & { type: "dragging" };
    showDebugOverlay?: boolean;
  }) => {
    const rendered = runSpring(
      dragState.springingFrom,
      dragState.result.rendered,
    );
    const debugOverlay =
      showDebugOverlay && dragState.result.debugOverlay
        ? dragState.result.debugOverlay()
        : null;
    return (
      <>
        {drawLayered(rendered)}
        {debugOverlay}
      </>
    );
  },
);
