import { Delaunay } from "d3-delaunay";
import * as d3Ease from "d3-ease";
import _ from "lodash";
import {
  Fragment,
  PointerEvent,
  ReactElement,
  SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useDemoContext } from "./DemoContext";
import { DragSpec, span, TargetStateLike, toTargetState } from "./DragSpec";
import { ErrorWithJSX } from "./ErrorBoundary";
import { projectOntoConvexHull } from "./math/delaunay";
import { minimize } from "./math/minimize";
import { Vec2, Vec2able } from "./math/vec2";
import { getAtPath, setAtPath } from "./paths";
import { prettyLog, PrettyPrint } from "./pretty-print";
import { Svgx, updatePropsDownTree } from "./svgx";
import {
  accumulateTransforms,
  getAccumulatedTransform,
  HoistedSvgx,
  hoistSvg,
} from "./svgx/hoist";
import { lerpSvgx } from "./svgx/lerp";
import { assignPaths, findByPath, getPath } from "./svgx/path";
import { globalToLocal, localToGlobal, parseTransform } from "./svgx/transform";
import { useRenderError } from "./useRenderError";
import {
  assert,
  assertNever,
  assertWithJSX,
  hasKey,
  isObject,
  manyToArray,
  pipe,
} from "./utils";

export function translate(v: Vec2able): string;
export function translate(x: number, y: number): string;
export function translate(a: Vec2able | number, b?: number): string {
  const [x, y] = b !== undefined ? [a, b] : Vec2(a).arr();
  return `translate(${x},${y}) `; // end in space
}

export function rotate(degrees: number, c: Vec2able = Vec2(0)): string {
  const [cx, cy] = Vec2(c).arr();
  return `rotate(${degrees},${cx},${cy}) `; // end in space
}

export function scale(sx: number, sy?: number): string {
  if (sy === undefined) sy = sx;
  return `scale(${sx},${sy}) `; // end in space
}

export function path(...pts: (Vec2able | string | number)[]): string {
  return pts
    .map((pt) =>
      typeof pt === "string"
        ? pt
        : typeof pt === "number"
        ? pt.toString()
        : Vec2(pt).str()
    )
    .join(" ");
}

export type SetState<T> = (
  newState: SetStateAction<T>,
  props?: {
    easing?: (t: number) => number;
    seconds?: number;
    immediate?: boolean;
  }
) => void;

/**
 * A Manipulable is a function that takes state and draggable helper, returns SVG JSX.
 */
export type Manipulable<T extends object, Config = undefined> = (props: {
  state: T;
  drag: typeof drag<T>;
  draggedId: string | null;
  setState: SetState<T>;
  config: Config;
}) => Svgx;

function noOp(): void {}

function lerpHoisted(a: HoistedSvgx, b: HoistedSvgx, t: number): HoistedSvgx {
  const result: HoistedSvgx = new Map();
  const allKeys = new Set([...a.keys(), ...b.keys()]);

  for (const key of allKeys) {
    const aVal = a.get(key);
    const bVal = b.get(key);

    if (aVal && bVal) {
      // console.log("lerpHoisted is lerping key:", key);
      result.set(key, lerpSvgx(aVal, bVal, t));
    } else if (aVal) {
      result.set(key, aVal);
    } else if (bVal) {
      result.set(key, bVal);
    }
  }

  return result;
}

function lerpHoisted3(
  a: HoistedSvgx,
  b: HoistedSvgx,
  c: HoistedSvgx,
  { l0, l1, l2 }: { l0: number; l1: number; l2: number }
): HoistedSvgx {
  if (l0 + l1 < 1e-6) return c;
  const ab = lerpHoisted(a, b, l1 / (l0 + l1));
  return lerpHoisted(ab, c, l2);
}

type ManifoldPoint<T> = {
  state: T;
  hoisted: HoistedSvgx;
  dragSpecCallbackAtNewState: (() => DragSpec<T>) | undefined;
  position: Vec2;
  andThen: T | undefined;
};

type Manifold<T> = {
  points: ManifoldPoint<T>[];
  delaunay: Delaunay<Delaunay.Point>;
};

type DragState<T> =
  | { type: "idle"; state: T }
  | {
      type: "dragging";
      draggedPath: string;
      draggedId: string | null;
      pointerLocal: Vec2;
      startingPoint: ManifoldPoint<T>;
      manifolds: Manifold<T>[];
    }
  | {
      type: "dragging-params";
      draggedPath: string;
      draggedId: string | null;
      pointerLocal: Vec2;
      curParams: number[];
      stateFromParams: (...params: number[]) => T;
    }
  | {
      type: "animating";
      startHoisted: HoistedSvgx;
      targetHoisted: HoistedSvgx;
      targetState: T;
      easing: (t: number) => number;
      startTime: number;
      duration: number;
    };

function findByPathInHoisted(path: string, hoisted: HoistedSvgx): Svgx | null {
  for (const element of hoisted.values()) {
    const found = findByPath(path, element);
    if (found) return found;
  }
  return null;
}

const onDragPropName = "data-on-drag";

const onDragPropValueSymbol: unique symbol = Symbol();

export type OnDragPropValue<T> = {
  type: typeof onDragPropValueSymbol;
  value: () => DragSpec<T>;
};

function isOnDragPropValue<T>(value: unknown): value is OnDragPropValue<T> {
  return isObject(value) && value.type === onDragPropValueSymbol;
}

function drag<T>(
  dragSpec: (() => DragSpec<T>) | DragSpec<T>
): OnDragPropValue<T> {
  return {
    type: onDragPropValueSymbol,
    value: typeof dragSpec === "function" ? dragSpec : () => dragSpec,
  };
}

export type Drag<T> = typeof drag<T>;

function getDragSpecCallbackOnElement<T>(
  element: ReactElement
): (() => DragSpec<T>) | undefined {
  const props = element.props as any;
  const maybeOnDragPropValue = props[onDragPropName];
  // it's ok for it to be missing
  if (!maybeOnDragPropValue) return undefined;
  // it's ok for it to be the right type
  if (isOnDragPropValue<T>(maybeOnDragPropValue)) {
    return maybeOnDragPropValue.value;
  }
  // otherwise, error
  throw new ErrorWithJSX(
    `${onDragPropName} can only be set by drag() helper.`,
    (
      <>
        <p className="mb-2">
          When you set <span className="font-mono">{onDragPropName}</span>, the
          argument must be wrapped in a call to{" "}
          <span className="font-mono">drag()</span>.
        </p>
        {typeof maybeOnDragPropValue === "function" ? (
          <p className="mb-2">
            It looks like you set{" "}
            <span className="font-mono">{onDragPropName}</span> to a function.
            Callbacks should be wrapped in{" "}
            <span className="font-mono">drag()</span> too!
          </p>
        ) : (
          <>
            <p className="mb-2">Got value:</p>
            <PrettyPrint value={maybeOnDragPropValue} />
          </>
        )}
      </>
    )
  );
}

function drawHoisted(hoisted: HoistedSvgx): Svgx {
  return (
    <>
      {Array.from(hoisted.entries())
        .sort(([_keyA, elemA], [_keyB, elemB]) => {
          const zIndexA = parseInt((elemA.props as any)["data-z-index"]) || 0;
          const zIndexB = parseInt((elemB.props as any)["data-z-index"]) || 0;
          return zIndexA - zIndexB;
        })
        .map(([key, element]) => (
          <Fragment key={key}>
            {updatePropsDownTree(element, () => ({
              [onDragPropName as any]: undefined,
            }))}
          </Fragment>
        ))}
    </>
  );
}

function postProcessForDrawing(element: Svgx): HoistedSvgx {
  return pipe(element, assignPaths, accumulateTransforms, hoistSvg);
}

function computeEnterDraggingMode<T extends object, Config>(
  state: T,
  draggedPath: string,
  draggedId: string | null,
  dragSpec: DragSpec<T>,
  pointerLocal: Vec2,
  manipulable: Manipulable<T, Config>,
  diagramConfig: Config
): DragState<T> {
  console.log("enterDraggingMode", state, draggedPath);

  if (hasKey(dragSpec, "initParams")) {
    return {
      type: "dragging-params",
      draggedPath,
      draggedId,
      pointerLocal,
      curParams: dragSpec.initParams,
      stateFromParams: dragSpec.stateFromParams,
    };
  }

  if (hasKey(dragSpec, "paramPaths")) {
    return {
      type: "dragging-params",
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

  const manifoldSpecs = pipe(
    manyToArray(dragSpec),
    (arr) => (arr.length === 0 ? [span([])] : arr) // things go wrong if no manifolds
  );

  console.log("dragSpec", dragSpec);

  console.log("manifoldSpecs");
  // prettyLog(manifoldSpecs);

  const makeManifoldPoint = (s: TargetStateLike<T>): ManifoldPoint<T> => {
    const targetState = toTargetState(s);

    // Use a no-op draggable to avoid attaching event handlers
    const content = manipulable({
      state: targetState.targetState,
      drag,
      draggedId,
      setState: noOp,
      config: diagramConfig,
    });
    const hoisted = postProcessForDrawing(content);
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
          <PrettyPrint value={s} />
        </>
      )
    );

    console.log("making manifold point; element:");
    prettyLog(element);

    const accumulatedTransform = getAccumulatedTransform(element);
    const transforms = parseTransform(accumulatedTransform || "");

    return {
      state: targetState.targetState,
      hoisted,
      position: localToGlobal(transforms, pointerLocal),
      dragSpecCallbackAtNewState: getDragSpecCallbackOnElement<T>(element),
      andThen: targetState.andThen,
    };
  };

  const startingPoint = makeManifoldPoint(state);

  const manifolds = manifoldSpecs.map(({ states }) => {
    const points = [
      startingPoint,
      ...states
        .filter((s) => !_.isEqual(s, state))
        .map((state) => makeManifoldPoint(state)),
    ];
    const delaunay = Delaunay.from(points.map((info) => info.position.arr()));
    return { points, delaunay };
  });

  return {
    type: "dragging",
    draggedPath,
    draggedId,
    pointerLocal,
    startingPoint,
    manifolds,
  };
}

function computeRenderState<T extends object, Config>(
  dragState: DragState<T>,
  pointer: { x: number; y: number } | null,
  drawerConfig: {
    snapRadius: number;
    chainDrags: boolean;
    relativePointerMotion: boolean;
    animationDuration: number;
  },
  manipulable: Manipulable<T, Config>,
  postProcessForInteraction: (element: Svgx, state: T) => HoistedSvgx,
  setDragState: (newDragState: DragState<T>) => void,
  diagramConfig: Config
): {
  hoistedToRender: HoistedSvgx;
  currentHoisted: HoistedSvgx;
  newState: T | null;
  pendingTransition: DragState<T> | null;
  debugRender: React.ReactNode;
} {
  let hoistedToRender: HoistedSvgx;
  let currentHoisted: HoistedSvgx = new Map();
  let newState: T | null = null;
  let pendingTransition: DragState<T> | null = null;
  let debugRender: React.ReactElement[] = [];

  if (dragState.type === "idle") {
    // console.log("rendering while idle");
    const content = manipulable({
      state: dragState.state,
      drag,
      draggedId: null,
      setState: (
        newState: SetStateAction<T>,
        {
          easing = d3Ease.easeCubicInOut,
          seconds = 0.4,
          immediate = false,
        } = {}
      ) => {
        newState =
          typeof newState === "function" ? newState(dragState.state) : newState;

        if (immediate) {
          setDragState({
            type: "idle",
            state: newState,
          });
          return;
        }

        // animate to new state
        const endContent = manipulable({
          state: newState,
          drag,
          draggedId: null,
          setState: noOp,
          config: diagramConfig,
        });
        setDragState({
          type: "animating",
          startHoisted: postProcessForDrawing(content),
          targetHoisted: postProcessForDrawing(endContent),
          targetState: newState,
          startTime: Date.now(),
          easing,
          duration: seconds * 1000,
        });
      },
      config: diagramConfig,
    });
    // console.log("content from idle state:", content);
    // prettyLog(content, { label: "content from idle state" });
    hoistedToRender = postProcessForInteraction(content, dragState.state);
    currentHoisted = hoistedToRender;
  } else if (dragState.type === "animating") {
    const now = Date.now();
    const elapsed = now - dragState.startTime;
    const progress = Math.min(elapsed / dragState.duration, 1);
    const easedProgress = dragState.easing(progress);

    hoistedToRender = lerpHoisted(
      dragState.startHoisted,
      dragState.targetHoisted,
      easedProgress
    );
  } else if (dragState.type === "dragging") {
    assert(!!pointer, "Pointer must be defined while dragging");

    const draggableDestPt = Vec2(pointer);

    const manifoldProjections = dragState.manifolds.map((manifold) => ({
      ...projectOntoConvexHull(manifold.delaunay, draggableDestPt),
      manifold,
    }));

    // Compute debug visualization
    manifoldProjections.forEach((proj, manifoldIdx) => {
      const { manifold, projectedPt } = proj;

      // Draw red circles at manifold points
      manifold.points.forEach((pt, ptIdx) => {
        debugRender.push(
          <circle
            key={`manifold-${manifoldIdx}-point-${ptIdx}`}
            cx={pt.position.x}
            cy={pt.position.y}
            r={drawerConfig.snapRadius}
            fill="red"
            opacity={0.3}
          />
        );
      });

      // Draw red triangulation edges
      const { triangles, points } = manifold.delaunay;
      for (let i = 0; i < triangles.length; i += 3) {
        const ax = points[2 * triangles[i]];
        const ay = points[2 * triangles[i] + 1];
        const bx = points[2 * triangles[i + 1]];
        const by = points[2 * triangles[i + 1] + 1];
        const cx = points[2 * triangles[i + 2]];
        const cy = points[2 * triangles[i + 2] + 1];

        debugRender.push(
          <path
            d={path("M", ax, ay, "L", bx, by, "L", cx, cy, "Z")}
            stroke="red"
            strokeWidth={2}
            fill="none"
          />
        );
      }

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
          x1={draggableDestPt.x}
          y1={draggableDestPt.y}
          x2={projectedPt.x}
          y2={projectedPt.y}
          stroke="blue"
          strokeWidth={2}
        />
      );
    });

    const bestManifoldProjection = _.minBy(
      manifoldProjections,
      (proj) => proj.dist
    )!;

    if (drawerConfig.relativePointerMotion) {
      // TODO: implement relative pointer motion
      // dragState.pointerOffset = Vec2(pointer).sub(
      //   bestManifoldProjection.projectedPt,
      // );
    }

    const closestManifoldPt = _.minBy(
      dragState.manifolds.flatMap((m) => m.points),
      (info) => draggableDestPt.dist(info.position)
    )!;

    // TODO: it would be nice to animate towards .state before
    // jumping to .andThen
    newState = closestManifoldPt.andThen ?? closestManifoldPt.state;

    // Check if it's time to snap
    if (
      drawerConfig.chainDrags &&
      bestManifoldProjection.projectedPt.dist(closestManifoldPt.position) <
        drawerConfig.snapRadius
    ) {
      if (!_.isEqual(newState, dragState.startingPoint.state)) {
        // time to snap!

        const dragSpecCallback = closestManifoldPt.dragSpecCallbackAtNewState;

        // console.log("snapping to new state", newState, dragSpecCallback);

        // special case: the thing we're snapping to doesn't have a drag spec at all
        if (!dragSpecCallback) {
          pendingTransition = { type: "idle", state: newState };
        } else {
          // normal case
          pendingTransition = computeEnterDraggingMode(
            newState,
            dragState.draggedPath,
            dragState.draggedId,
            dragSpecCallback(),
            dragState.pointerLocal,
            manipulable,
            diagramConfig
          );
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
    // console.log("render while dragging");
  } else if (dragState.type === "dragging-params") {
    assert(!!pointer, "Pointer must be defined while dragging-params");

    const objectiveFn = (params: number[]) => {
      const candidateState = dragState.stateFromParams(...params);
      const content = pipe(
        manipulable({
          state: candidateState,
          drag,
          draggedId: dragState.draggedId,
          setState: noOp,
          config: diagramConfig,
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

    newState = dragState.stateFromParams(...dragState.curParams);
    const content = manipulable({
      state: newState,
      drag,
      draggedId: dragState.draggedId,
      setState: noOp,
      config: diagramConfig,
    });
    hoistedToRender = postProcessForDrawing(content);

    // Debug rendering for dragging-params
    const processedContent = pipe(content, assignPaths, accumulateTransforms);
    const element = findByPath(dragState.draggedPath, processedContent);
    if (element) {
      const accumulateTransform = getAccumulatedTransform(element);
      const transforms = parseTransform(accumulateTransform || "");
      const achievedPos = localToGlobal(transforms, dragState.pointerLocal);

      debugRender.push(
        <circle
          key="dragging-params-achieved"
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
          key="dragging-params-line"
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
  } else {
    assertNever(dragState);
  }

  return {
    hoistedToRender,
    currentHoisted,
    newState,
    pendingTransition,
    debugRender,
  };
}

interface ManipulableProps<T extends object, Config> {
  manipulable: Manipulable<T, Config>;
  initialState: T;
  width?: number;
  height?: number;
  drawerConfig?: {
    snapRadius?: number;
    chainDrags?: boolean;
    relativePointerMotion?: boolean;
    animationDuration?: number;
  };
  diagramConfig: Config;
}

export function ManipulableDrawer<T extends object, Config>({
  manipulable,
  initialState,
  width,
  height,
  drawerConfig = {},
  diagramConfig,
}: ManipulableProps<T, Config>) {
  // console.log("ManipulableDrawer render");

  const throwRenderError = useRenderError();

  const { onDragStateChange, debugMode } = useDemoContext();

  const [dragState, setDragStateRaw] = useState<DragState<T>>({
    type: "idle",
    state: initialState,
  });
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const pendingStateTransition = useRef<DragState<T> | null>(null);

  const drawerConfigWithDefaults = {
    snapRadius: drawerConfig.snapRadius ?? 10,
    chainDrags: drawerConfig.chainDrags ?? true,
    relativePointerMotion: drawerConfig.relativePointerMotion ?? false,
    animationDuration: drawerConfig.animationDuration ?? 300,
  };

  const setDragState = useCallback(
    (newDragState: DragState<T>) => {
      // console.log("setDragState", newDragState);
      setDragStateRaw(newDragState);
      onDragStateChange?.(newDragState);
    },
    [onDragStateChange]
  );

  // Animation loop
  useEffect(() => {
    let rafId: number;
    const animate = () => {
      if (dragState.type === "animating") {
        const now = Date.now();
        const elapsed = now - dragState.startTime;
        const progress = Math.min(elapsed / dragState.duration, 1);

        if (progress >= 1) {
          setDragState({ type: "idle", state: dragState.targetState });
        } else {
          setDragStateRaw({ ...dragState });
          rafId = requestAnimationFrame(animate);
        }
      }
    };
    if (dragState.type === "animating") {
      rafId = requestAnimationFrame(animate);
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [dragState, setDragState]);

  // Handle pending state transitions from render
  useLayoutEffect(() => {
    if (pendingStateTransition.current) {
      setDragState(pendingStateTransition.current);
      pendingStateTransition.current = null;
    }
  });

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

  const [Svgx, setSvgx] = useState<SVGSVGElement | null>(null);

  function postProcessForInteraction(element: Svgx, state: T): HoistedSvgx {
    return pipe(
      element,
      (el) => {
        // prettyLog(el, { label: "original element" });
        return el;
      },
      assignPaths,
      (el) => {
        // prettyLog(el, { label: "postProcessForInteraction element" });
        return el;
      },
      accumulateTransforms,
      (el) =>
        updatePropsDownTree(el, (el) => {
          const dragSpecCallback = getDragSpecCallbackOnElement<T>(el);
          if (!dragSpecCallback) return;
          return {
            style: { cursor: "grab", ...(el.props.style || {}) },
            onPointerDown: (e: PointerEvent) => {
              try {
                // console.log("onPointerDown");
                e.stopPropagation();
                assert(!!Svgx, "SVG element must be set");
                const rect = Svgx.getBoundingClientRect();
                const pointerPos = Vec2(
                  e.clientX - rect.left,
                  e.clientY - rect.top
                );
                setPointer(pointerPos);
                const accumulatedTransform = getAccumulatedTransform(el);
                const transforms = parseTransform(accumulatedTransform || "");
                const pointerLocal = globalToLocal(transforms, pointerPos);
                const path = getPath(el);
                assert(!!path, "Draggable element must have a path");
                setDragState(
                  computeEnterDraggingMode(
                    state,
                    path,
                    el.props.id || null,
                    dragSpecCallback(),
                    pointerLocal,
                    manipulable,
                    diagramConfig
                  )
                );
              } catch (error) {
                throwRenderError(error);
              }
            },
          };
        }),
      hoistSvg
    );
  }

  const renderState = computeRenderState(
    dragState,
    pointer,
    drawerConfigWithDefaults,
    manipulable,
    postProcessForInteraction,
    setDragState,
    diagramConfig
  );
  const { hoistedToRender, newState, pendingTransition, debugRender } =
    renderState;

  if (pendingTransition) {
    pendingStateTransition.current = pendingTransition;
  }

  useEffect(() => {
    if (dragState.type === "dragging" || dragState.type === "dragging-params") {
      document.body.style.cursor = "grabbing";
    } else {
      document.body.style.cursor = "default";
    }
  }, [dragState.type]);

  // Attach document-level event listeners during drag
  useEffect(() => {
    if (!Svgx) return;

    if (dragState.type !== "dragging" && dragState.type !== "dragging-params") {
      return;
    }

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      if (paused) return;
      const rect = Svgx.getBoundingClientRect();
      setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handlePointerUp = () => {
      if (paused) return;
      if (dragState.type === "dragging" && newState) {
        const targetContent = manipulable({
          state: newState,
          drag,
          draggedId: null,
          setState: noOp,
          config: diagramConfig,
        });
        setDragState({
          type: "animating",
          startHoisted: hoistedToRender,
          targetHoisted: postProcessForDrawing(targetContent),
          targetState: newState,
          startTime: Date.now(),
          easing: d3Ease.easeElastic,
          duration: drawerConfigWithDefaults.animationDuration,
        });
      } else if (dragState.type === "dragging-params" && newState) {
        setDragState({ type: "idle", state: newState });
      }
    };

    const handlePointerCancel = () => {
      setPointer(null);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [
    drawerConfig,
    diagramConfig,
    dragState.type,
    drawerConfig.animationDuration,
    hoistedToRender,
    manipulable,
    newState,
    paused,
    setDragState,
    Svgx,
    drawerConfigWithDefaults.animationDuration,
  ]);

  // prettyLog(sortedEntries, { label: "sortedEntries for rendering" });

  return (
    <svg
      ref={setSvgx}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible select-none touch-none"
    >
      {drawHoisted(hoistedToRender)}
      {debugMode && debugRender}
    </svg>
  );
}
