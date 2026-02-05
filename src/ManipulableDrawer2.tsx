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
  dragSpecToBehavior,
} from "./DragSpec2";
import {
  Manipulable,
  ManipulableProps,
  getDragSpecCallbackOnElement,
  unsafeDrag,
} from "./manipulable2";
import { Vec2 } from "./math/vec2";
import { Svgx, updatePropsDownTree } from "./svgx";
import {
  LayeredSvgx,
  accumulateTransforms,
  drawLayered,
  getAccumulatedTransform,
  layerSvg,
  layeredExtract,
} from "./svgx/layers";
import { lerpLayered } from "./svgx/lerp";
import { assignPaths, getPath } from "./svgx/path";
import { globalToLocal, parseTransform } from "./svgx/transform";
import { useAnimationLoop } from "./useAnimationLoop";
import { CatchToRenderError, useCatchToRenderError } from "./useRenderError";
import { assertNever, memoGeneric, pipe, throwError } from "./utils";

// # Engine state machine

const SPRING_DURATION = 200; // ms

type SpringingFrom = {
  layered: LayeredSvgx;
  time: number;
};

type DragState<T extends object> = { springingFrom: SpringingFrom | null } & (
  | { type: "idle"; state: T }
  | {
      type: "dragging";
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
  | { type: "idle" }
  | {
      type: "dragging";
      spec: DragSpec<T>;
      behaviorCtx: BehaviorContext<T>;
      activePath: string;
      pointerStart: Vec2;
      draggedId: string | null;
    };

// # Component

interface ManipulableDrawerProps<T extends object> {
  manipulable: Manipulable<T>;
  initialState: T;
  width?: number;
  height?: number;
  onDebugDragInfo?: (info: DebugDragInfo<T>) => void;
}

export function ManipulableDrawer<T extends object>({
  manipulable,
  initialState,
  width,
  height,
  onDebugDragInfo,
}: ManipulableDrawerProps<T>) {
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
    [svgElem]
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

        // Detect activePath change → start new spring from current display
        if (result.activePath !== ds.result.activePath) {
          const layered = runSpring(springingFrom, ds.result.rendered);
          springingFrom = { layered, time: performance.now() };
        }

        // Clear expired spring
        if (
          springingFrom &&
          performance.now() - springingFrom.time >= SPRING_DURATION
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
        });
      } else if (ds.type === "idle" && ds.springingFrom) {
        if (performance.now() - ds.springingFrom.time >= SPRING_DURATION) {
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
    }, [setDragState])
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
        springingFrom: { layered: startLayered, time: performance.now() },
      };
      dragStateRef.current = newState;
      setDragState(newState);
      onDebugDragInfoRef.current?.({ type: "idle" });
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
    manipulable,
    setDragState,
    setPointerFromEvent,
  ]);

  const renderCtx: RenderContext<T> = useMemo(
    () => ({
      manipulable,
      catchToRenderError,
      setPointerFromEvent,
      setDragState: (ds: DragState<T>) => {
        dragStateRef.current = ds;
        setDragState(ds);
      },
      onDebugDragInfoRef,
    }),
    [catchToRenderError, manipulable, setDragState, setPointerFromEvent]
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
        <DrawDraggingMode dragState={dragState} />
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
 * Elements with data-transition={false} are never sprung — they
 * always show the target's version so they track the cursor.
 */
function runSpring(
  springingFrom: SpringingFrom | null,
  target: LayeredSvgx
): LayeredSvgx {
  if (!springingFrom) return target;
  const elapsed = performance.now() - springingFrom.time;
  const t = d3Ease.easeCubicOut(Math.min(elapsed / SPRING_DURATION, 1));
  const lerped = lerpLayered(target, springingFrom.layered, 1 - t);
  // Replace non-transitioning elements with the target's version so they
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
  manipulable: Manipulable<T>,
  props: Omit<ManipulableProps<T>, "drag" | "setState">
): LayeredSvgx {
  return pipe(
    manipulable({ ...props, drag: unsafeDrag, setState: throwError }),
    assignPaths,
    accumulateTransforms,
    layerSvg
  );
}

// # Render context

type RenderContext<T extends object> = {
  manipulable: Manipulable<T>;
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
  ctx: RenderContext<T>
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

            // Extract the float element (only possible when the element has an id)
            let floatLayered: LayeredSvgx | null = null;
            if (draggedId) {
              const startLayered = renderReadOnly(ctx.manipulable, {
                state,
                draggedId,
                ghostId: null,
              });
              floatLayered = layeredExtract(startLayered, draggedId).extracted;
            }

            const behaviorCtx: BehaviorContext<T> = {
              manipulable: ctx.manipulable,
              draggedPath,
              draggedId,
              pointerLocal,
              floatLayered,
            };

            const behavior = dragSpecToBehavior(dragSpec, behaviorCtx);
            const frame: DragFrame = { pointer, pointerStart: pointer };
            const result = behavior(frame);

            ctx.setDragState({
              type: "dragging",
              behavior,
              spec: dragSpec,
              behaviorCtx,
              pointerStart: pointer,
              draggedId,
              result,
              springingFrom: null,
            });
            ctx.onDebugDragInfoRef.current?.({
              type: "dragging",
              spec: dragSpec,
              behaviorCtx,
              activePath: result.activePath,
              pointerStart: pointer,
              draggedId,
            });
          }),
        };
      }),
    layerSvg
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
    const content = ctx.manipulable({
      state: dragState.state,
      drag: unsafeDrag,
      draggedId: null,
      ghostId: null,
      setState: ctx.catchToRenderError(
        (newState: SetStateAction<T>, { immediate = false } = {}) => {
          const resolved =
            typeof newState === "function"
              ? (newState as (prev: T) => T)(dragState.state)
              : newState;
          if (immediate) {
            ctx.setDragState({
              type: "idle",
              state: resolved,
              springingFrom: null,
            });
          } else {
            const snapshot = renderReadOnly(ctx.manipulable, {
              state: dragState.state,
              draggedId: null,
              ghostId: null,
            });
            ctx.setDragState({
              type: "idle",
              state: resolved,
              springingFrom: { layered: snapshot, time: performance.now() },
            });
          }
        }
      ),
    });

    const layered = postProcessForInteraction(content, dragState.state, ctx);
    return drawLayered(runSpring(dragState.springingFrom, layered));
  }
);

const DrawDraggingMode = memoGeneric(
  <T extends object>({
    dragState,
  }: {
    dragState: DragState<T> & { type: "dragging" };
  }) => {
    const rendered = runSpring(
      dragState.springingFrom,
      dragState.result.rendered
    );
    return drawLayered(rendered);
  }
);
