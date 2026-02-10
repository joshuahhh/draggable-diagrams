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
  DragSpec,
  dragSpecBuilders,
  dragSpecToBehavior,
} from "./DragSpec";
import {
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
import { assertNever, memoGeneric, pipe, throwError } from "./utils";

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

type DragState<T extends object> = { springingFrom: SpringingFrom | null } & (
  | { type: "idle"; state: T }
  | {
      type: "dragging";
      startState: T;
      behavior: DragBehavior<T>;
      spec: DragSpec<T>;
      behaviorCtx: BehaviorContext<T>;
      pointerStart: Vec2;
      draggedId: string | null;
      result: DragResult<T>;
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
}

export function DraggableRenderer<T extends object>({
  draggable,
  initialState,
  width,
  height,
  onDebugDragInfo,
  showDebugOverlay,
}: DraggableRendererProps<T>) {
  const catchToRenderError = useCatchToRenderError();

  const [dragState, setDragState] = useState<DragState<T>>({
    type: "idle",
    state: initialState,
    springingFrom: null,
  });
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
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
          const newDraggedId =
            typeof result.chainNow === "string"
              ? result.chainNow
              : ds.draggedId;
          // Render the new state and find the dragged element
          const content = pipe(
            draggable({
              state: newState,
              d: dragSpecBuilders,
              draggedId: newDraggedId,
              ghostId: null,
              setState: throwError,
            }),
            assignPaths,
            accumulateTransforms,
          );
          const element =
            typeof result.chainNow === "string"
              ? findElement(content, (el) => el.props.id === result.chainNow)
              : findByPath(ds.behaviorCtx.draggedPath, content);
          if (element) {
            const dragSpecCallback = getDragSpecCallbackOnElement<T>(element);
            if (dragSpecCallback) {
              const newDragSpec = dragSpecCallback();

              // Start spring from current display
              const layered = runSpring(springingFrom, result.rendered);
              const newSpringingFrom: SpringingFrom = {
                layered,
                time: performance.now(),
                transition: resolveTransitionLike(true)!,
              };

              const newDraggedPath = getPath(element);
              assert(!!newDraggedPath, "Chained element must have a path");

              // const accTransform = getAccumulatedTransform(element);
              // const transforms = parseTransform(accTransform || "");
              // const pointerLocal = globalToLocal(
              //   transforms,
              //   pointerRef.current!
              // );
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
              );
              dragStateRef.current = chainedState;
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
        dragStateRef.current = newState;
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
          dragStateRef.current = newState;
          setDragState(newState);
        } else {
          // Force re-render so spring progress advances
          const newState: DragState<T> = { ...ds };
          dragStateRef.current = newState;
          setDragState(newState);
        }
      }
    }, [draggable, setDragState]),
  );

  // Cursor style
  useEffect(() => {
    document.body.style.cursor =
      dragState.type === "dragging" ? "grabbing" : "default";
  }, [dragState.type]);

  // Document-level pointer listeners during drag
  useEffect(() => {
    if (dragState.type !== "dragging") return;

    const onPointerMove = catchToRenderError((e: globalThis.PointerEvent) => {
      setPointerFromEvent(e);
    });

    const onPointerUp = catchToRenderError((e: globalThis.PointerEvent) => {
      const pointer = setPointerFromEvent(e);
      const ds = dragStateRef.current;
      if (ds.type !== "dragging") return;

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
      dragStateRef.current = newState;
      setDragState(newState);
      onDebugDragInfoRef.current?.({ type: "idle", state: dropState });
    });

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [
    catchToRenderError,
    dragState.type,
    draggable,
    setDragState,
    setPointerFromEvent,
  ]);

  const renderCtx: RenderContext<T> = useMemo(
    () => ({
      draggable,
      catchToRenderError,
      setPointerFromEvent,
      setDragState: (ds: DragState<T>) => {
        dragStateRef.current = ds;
        setDragState(ds);
      },
      onDebugDragInfoRef,
    }),
    [catchToRenderError, draggable, setDragState, setPointerFromEvent],
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

function initDrag<T extends object>(
  spec: DragSpec<T>,
  behaviorCtxWithoutFloat: Omit<BehaviorContext<T>, "floatLayered">,
  state: T,
  frame: DragFrame,
  pointerStart: Vec2,
  springingFrom: SpringingFrom | null,
): {
  dragState: DragState<T> & { type: "dragging" };
  debugInfo: DebugDragInfo<T>;
} {
  const { draggable, draggedId } = behaviorCtxWithoutFloat;
  let floatLayered: LayeredSvgx | null = null;
  if (draggedId) {
    const startLayered = renderReadOnly(draggable, {
      state,
      d: dragSpecBuilders,
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
        return {
          style: { cursor: "grab", ...(el.props.style || {}) },
          onPointerDown: ctx.catchToRenderError((e: React.PointerEvent) => {
            e.stopPropagation();
            const pointer = ctx.setPointerFromEvent(e.nativeEvent);

            const dragSpec: DragSpec<T> = dragSpecCallback();
            const draggedId = el.props.id ?? null;
            const draggedPath = getPath(el);
            assert(!!draggedPath, "Dragged element must have a path");

            const accTransform = getAccumulatedTransform(el);
            const transforms = parseTransform(accTransform || "");
            const pointerLocal = globalToLocal(transforms, pointer);

            const frame: DragFrame = { pointer, pointerStart: pointer };
            const { dragState, debugInfo } = initDrag(
              dragSpec,
              {
                draggable: ctx.draggable,
                draggedPath,
                draggedId,
                pointerLocal,
              },
              state,
              frame,
              pointer,
              null,
            );
            ctx.setDragState(dragState);
            ctx.onDebugDragInfoRef.current?.(debugInfo);
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
      d: dragSpecBuilders,
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
            d: dragSpecBuilders,
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
