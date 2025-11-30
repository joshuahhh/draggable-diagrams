import { Delaunay } from "d3-delaunay";
import { easeElastic } from "d3-ease";
import _ from "lodash";
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  PointerEvent,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { projectOntoConvexHull } from "./delaunay";
import { useDemoContext } from "./DemoContext";
import { DragSpec, span } from "./DragSpec";
import {
  FlattenedSvg,
  flattenSvg,
  getAccumulatedTransform,
  SvgElem,
} from "./jsx-flatten";
import { lerpSvgNode } from "./jsx-lerp";
import { assignPaths, findByPath, getPath } from "./jsx-path";
import { minimize } from "./minimize";
import { getAtPath, setAtPath } from "./paths";
import { parseTransform } from "./svg-transform";
import { assert, assertNever, hasKey, manyToArray, pipe } from "./utils";
import { Vec2, Vec2able } from "./vec2";

export function translate(v: Vec2able): string;
export function translate(x: number, y: number): string;
export function translate(a: Vec2able | number, b?: number): string {
  const [x, y] = b !== undefined ? [a, b] : Vec2(a).arr();
  return `translate(${x},${y}) `; // end in space
}

/**
 * A ManipulableSvg is a function that takes state and draggable helper, returns SVG JSX.
 */
export type ManipulableSvg<T extends object> = (props: {
  state: T;
  draggable: (
    element: SvgElem,
    dragSpec: (() => DragSpec<T>) | DragSpec<T>,
  ) => SvgElem;
}) => SvgElem;

/**
 * Extracts the position from an SVG element's transform attribute.
 * Only supports translate transforms - throws if other transform types are present.
 * Returns Vec2(0, 0) if no transform.
 */
function extractPosition(element: SvgElem): Vec2 {
  // prettyLog(element, { label: "extractPosition element" });

  const transformStr = getAccumulatedTransform(element);
  assert(
    transformStr !== undefined,
    "extractPosition: no accumulated transform",
  );

  if (!transformStr) return Vec2(0, 0);

  const transforms = parseTransform(transformStr);

  // Only support translate transforms
  let x = 0;
  let y = 0;
  for (const t of transforms) {
    if (t.type === "translate") {
      x += t.x;
      y += t.y;
    } else {
      throw new Error(
        `extractPosition only supports translate transforms, found: ${t.type}`,
      );
    }
  }

  console.log("extractPosition:", transformStr, "->", x, y);

  return Vec2(x, y);
}

function lerpFlattened(
  a: FlattenedSvg,
  b: FlattenedSvg,
  t: number,
): FlattenedSvg {
  const result: FlattenedSvg = new Map();
  const allKeys = new Set([...a.keys(), ...b.keys()]);

  for (const key of allKeys) {
    const aVal = a.get(key);
    const bVal = b.get(key);

    if (aVal && bVal) {
      result.set(key, lerpSvgNode(aVal, bVal, t));
    } else if (aVal) {
      result.set(key, aVal);
    } else if (bVal) {
      result.set(key, bVal);
    }
  }

  return result;
}

function lerpFlattened3(
  a: FlattenedSvg,
  b: FlattenedSvg,
  c: FlattenedSvg,
  { l0, l1, l2 }: { l0: number; l1: number; l2: number },
): FlattenedSvg {
  if (l0 + l1 < 1e-6) return c;
  const ab = lerpFlattened(a, b, l1 / (l0 + l1));
  return lerpFlattened(ab, c, l2);
}

type ManifoldPoint<T> = {
  state: T;
  flattened: FlattenedSvg;
  dragSpecCallbackAtNewState: (() => DragSpec<T>) | undefined;
  offset: Vec2;
};

type Manifold<T> = {
  points: ManifoldPoint<T>[];
  delaunay: Delaunay<Delaunay.Point>;
};

type DragState<T> =
  | { type: "idle"; state: T }
  | {
      type: "dragging";
      draggablePath: string;
      pointerOffset: Vec2;
      startingPoint: ManifoldPoint<T>;
      manifolds: Manifold<T>[];
    }
  | {
      type: "dragging-params";
      draggablePath: string;
      pointerOffset: Vec2;
      curParams: number[];
      stateFromParams: (...params: number[]) => T;
    }
  | {
      type: "animating";
      startFlattened: FlattenedSvg;
      targetState: T;
      startTime: number;
      duration: number;
    };

interface ManipulableSvgProps<T extends object> {
  manipulableSvg: ManipulableSvg<T>;
  initialState: T;
  config?: {
    snapRadius?: number;
    transitionWhileDragging?: boolean;
    relativePointerMotion?: boolean;
    animationDuration?: number;
  };
}

function findByPathInFlattened(
  path: string,
  flattened: FlattenedSvg,
): SvgElem | null {
  for (const element of flattened.values()) {
    const found = findByPath(path, element);
    if (found) return found;
  }
  return null;
}

// // if (dragState.type !== "idle") return element;

// // Get unique key for this draggable
// const props = element.props as any;
// const draggableCallKey = "dck_" + String(Math.random());

// // Add cursor style and pointer down handler
// return cloneElement(element, {
//   ...{
//     ["data-draggable-call-key"]: draggableCallKey,
//     ["data-drag-spec"]: dragSpec,
//   },
//   style: { cursor: "grab", ...(props.style || {}) },
//   onPointerDown: (e: PointerEvent) => {
//     console.log("onPointerDown");
//     e.stopPropagation();

//     const svg = (e.currentTarget as SVGElement).ownerSVGElement;
//     if (!svg) return;

//     const rect = svg.getBoundingClientRect();
//     const pointerPos = Vec2(e.clientX - rect.left, e.clientY - rect.top);

//     // Compute pointer offset from element position using current flattened
//     const elementInFlattened = currentFlattened.get(key);
//     const elementPos = elementInFlattened
//       ? extractPosition(elementInFlattened)
//       : Vec2(0, 0);
//     const pointerOffset = pointerPos.sub(elementPos);

//     enterDraggingMode(dragState.state, key, dragSpec, pointerOffset);
//   },
// });

const draggablePropName = "data-drag-spec";

// Create draggable helper function
function draggable<T>(
  element: SvgElem,
  dragSpec: (() => DragSpec<T>) | DragSpec<T>,
): SvgElem {
  return cloneElement(element, {
    [draggablePropName as any]:
      typeof dragSpec === "function" ? dragSpec : () => dragSpec,
  });
}

function getDragSpecCallbackOnElement<T>(
  element: ReactElement,
): (() => DragSpec<T>) | undefined {
  const props = element.props as any;
  return props[draggablePropName];
}

// Recurse through the SVG tree, applying a desired function to all draggable elements
function mapDraggables<T>(
  node: SvgElem,
  fn: (el: SvgElem, dragSpecCallback: () => DragSpec<T>) => SvgElem,
): SvgElem {
  const props = node.props as any;

  const newElement = cloneElement(node, {
    children: Children.toArray(props.children).map((child) =>
      isValidElement(child) ? mapDraggables(child as SvgElem, fn) : child,
    ),
  });

  const dragSpecCallback = getDragSpecCallbackOnElement<T>(node);
  return dragSpecCallback ? fn(newElement, dragSpecCallback) : newElement;
}

function stripDraggables<T>(node: SvgElem): SvgElem {
  return mapDraggables<T>(node, (el) =>
    cloneElement(el, {
      [draggablePropName as any]: undefined,
    }),
  );
}

function postProcessForDrawing(element: SvgElem): FlattenedSvg {
  return pipe(element, assignPaths, (d) => flattenSvg(d, true));
}

function computeEnterDraggingMode<T extends object>(
  state: T,
  draggablePath: string,
  dragSpec: DragSpec<T>,
  pointerOffset: Vec2,
  manipulableSvg: ManipulableSvg<T>,
): DragState<T> {
  console.log("enterDraggingMode", state, draggablePath);

  if (hasKey(dragSpec, "initParams")) {
    return {
      type: "dragging-params",
      draggablePath,
      pointerOffset,
      curParams: dragSpec.initParams,
      stateFromParams: dragSpec.stateFromParams,
    };
  }

  if (hasKey(dragSpec, "paramPaths")) {
    return {
      type: "dragging-params",
      draggablePath,
      pointerOffset,
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
    (arr) => (arr.length === 0 ? [span([])] : arr), // things go wrong if no manifolds
  );

  console.log("dragSpec", dragSpec);

  console.log("manifoldSpecs");
  // prettyLog(manifoldSpecs);

  const makeManifoldPoint = (s: T): ManifoldPoint<T> => {
    console.log("makeManifoldPoint", s);
    // Use a no-op draggable to avoid attaching event handlers
    const content = manipulableSvg({ state: s, draggable });
    const flattened = postProcessForDrawing(content);
    // prettyLog(flattened, { label: "flattened in makeManifoldPoint" });
    console.log("gonna find", draggablePath, "in flattened:");
    // prettyLog(flattened);
    const element = findByPathInFlattened(draggablePath, flattened);
    assert(
      !!element,
      "makeManifoldPoint: can't find draggable element in flattened SVG",
    );

    console.log("making manifold point; element:");
    // prettyLog(element);

    const offset = extractPosition(element);

    return {
      state: s,
      flattened,
      offset,
      dragSpecCallbackAtNewState: getDragSpecCallbackOnElement<T>(element),
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
    const delaunay = Delaunay.from(points.map((info) => info.offset.arr()));
    return { points, delaunay };
  });

  return {
    type: "dragging",
    draggablePath,
    pointerOffset,
    startingPoint,
    manifolds,
  };
}

function computeRenderState<T extends object>(
  dragState: DragState<T>,
  pointer: { x: number; y: number } | null,
  drawerConfig: {
    snapRadius: number;
    transitionWhileDragging: boolean;
    relativePointerMotion: boolean;
    animationDuration: number;
  },
  manipulableSvg: ManipulableSvg<T>,
  postProcessForInteraction: (element: SvgElem, state: T) => FlattenedSvg,
): {
  flattenedToRender: FlattenedSvg;
  currentFlattened: FlattenedSvg;
  newState: T | null;
  pendingTransition: DragState<T> | null;
  debugRender: React.ReactNode;
} {
  let flattenedToRender: FlattenedSvg;
  let currentFlattened: FlattenedSvg = new Map();
  let newState: T | null = null;
  let pendingTransition: DragState<T> | null = null;
  let debugRender: React.ReactElement[] = [];

  if (dragState.type === "idle") {
    const content = manipulableSvg({
      state: dragState.state,
      draggable: draggable<T>,
    });
    flattenedToRender = postProcessForInteraction(content, dragState.state);
    currentFlattened = flattenedToRender;
  } else if (dragState.type === "animating") {
    const now = Date.now();
    const elapsed = now - dragState.startTime;
    const progress = Math.min(elapsed / dragState.duration, 1);
    const easedProgress = easeElastic(progress);

    const targetContent = manipulableSvg({
      state: dragState.targetState,
      draggable,
    });
    const targetFlattened = postProcessForDrawing(targetContent);

    flattenedToRender = lerpFlattened(
      dragState.startFlattened,
      targetFlattened,
      easedProgress,
    );
  } else if (dragState.type === "dragging") {
    assert(!!pointer, "Pointer must be defined while dragging");

    const draggableDestPt = Vec2(pointer).sub(dragState.pointerOffset);

    const manifoldProjections = dragState.manifolds.map((manifold) => ({
      ...projectOntoConvexHull(manifold.delaunay, draggableDestPt),
      manifold,
    }));

    // Compute debug visualization
    manifoldProjections.forEach((proj, manifoldIdx) => {
      const { manifold, projectedPt } = proj;

      // prettyLog(
      //   manifold.points.map((p) => p.offset),
      //   { label: "got manifold points at" },
      // );

      // Draw red circles at manifold points
      manifold.points.forEach((pt, ptIdx) => {
        debugRender.push(
          <circle
            key={`manifold-${manifoldIdx}-point-${ptIdx}`}
            cx={pt.offset.x}
            cy={pt.offset.y}
            r={drawerConfig.snapRadius}
            fill="red"
            opacity={0.3}
          />,
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
            key={`manifold-${manifoldIdx}-tri-${i / 3}`}
            d={`M ${ax} ${ay} L ${bx} ${by} L ${cx} ${cy} Z`}
            stroke="red"
            strokeWidth={2}
            fill="none"
          />,
        );
      }

      // Draw blue circle at projected point
      debugRender.push(
        <circle
          key={`manifold-${manifoldIdx}-projection`}
          cx={projectedPt.x}
          cy={projectedPt.y}
          r={10}
          stroke="blue"
          strokeWidth={2}
          fill="none"
        />,
      );

      // Draw blue line from draggable dest to projected point
      debugRender.push(
        <line
          key={`manifold-${manifoldIdx}-line`}
          x1={draggableDestPt.x}
          y1={draggableDestPt.y}
          x2={projectedPt.x}
          y2={projectedPt.y}
          stroke="blue"
          strokeWidth={2}
        />,
      );
    });

    const bestManifoldProjection = _.minBy(
      manifoldProjections,
      (proj) => proj.dist,
    )!;

    if (drawerConfig.relativePointerMotion) {
      dragState.pointerOffset = Vec2(pointer).sub(
        bestManifoldProjection.projectedPt,
      );
    }

    const closestManifoldPt = _.minBy(
      dragState.manifolds.flatMap((m) => m.points),
      (info) => draggableDestPt.dist(info.offset),
    )!;

    newState = closestManifoldPt.state;

    // Check if it's time to snap
    if (
      drawerConfig.transitionWhileDragging &&
      bestManifoldProjection.projectedPt.dist(closestManifoldPt.offset) <
        drawerConfig.snapRadius
    ) {
      if (!_.isEqual(newState, dragState.startingPoint.state)) {
        // time to snap!

        const dragSpecCallback = closestManifoldPt.dragSpecCallbackAtNewState;

        console.log("snapping to new state", newState, dragSpecCallback);

        // special case: the thing we're snapping to doesn't have a drag spec at all
        if (!dragSpecCallback) {
          pendingTransition = { type: "idle", state: newState };
        } else {
          // normal case
          pendingTransition = computeEnterDraggingMode(
            newState,
            dragState.draggablePath,
            dragSpecCallback(),
            dragState.pointerOffset,
            manipulableSvg,
          );
        }
      }
      flattenedToRender = closestManifoldPt.flattened;
    } else {
      // Interpolate based on projection type
      if (bestManifoldProjection.type === "vertex") {
        const { ptIdx } = bestManifoldProjection;
        flattenedToRender =
          bestManifoldProjection.manifold.points[ptIdx].flattened;
      } else if (bestManifoldProjection.type === "edge") {
        const { ptIdx0, ptIdx1, t } = bestManifoldProjection;
        flattenedToRender = lerpFlattened(
          bestManifoldProjection.manifold.points[ptIdx0].flattened,
          bestManifoldProjection.manifold.points[ptIdx1].flattened,
          t,
        );
      } else {
        const { ptIdx0, ptIdx1, ptIdx2, barycentric } = bestManifoldProjection;
        flattenedToRender = lerpFlattened3(
          bestManifoldProjection.manifold.points[ptIdx0].flattened,
          bestManifoldProjection.manifold.points[ptIdx1].flattened,
          bestManifoldProjection.manifold.points[ptIdx2].flattened,
          barycentric,
        );
      }
    }
    // console.log("render while dragging");
  } else if (dragState.type === "dragging-params") {
    assert(!!pointer, "Pointer must be defined while dragging-params");

    const draggableDestPt = Vec2(pointer).sub(dragState.pointerOffset);

    const objectiveFn = (params: number[]) => {
      const candidateState = dragState.stateFromParams(...params);
      const content = manipulableSvg({ state: candidateState, draggable }); // don't post-process
      const element = findByPath(dragState.draggablePath, content);
      if (!element) return Infinity;

      const pos = extractPosition(element);
      return draggableDestPt.dist2(pos);
    };

    const r = minimize(objectiveFn, dragState.curParams);
    dragState.curParams = r.solution;

    newState = dragState.stateFromParams(...dragState.curParams);
    const content = manipulableSvg({ state: newState, draggable });
    flattenedToRender = postProcessForDrawing(content);
  } else {
    assertNever(dragState);
  }

  return {
    flattenedToRender,
    currentFlattened,
    newState,
    pendingTransition,
    debugRender,
  };
}

export function ManipulableSvgDrawer<T extends object>({
  manipulableSvg,
  initialState,
  config = {},
}: ManipulableSvgProps<T>) {
  // console.log("ManipulableSvgDrawer render");

  const { onDragStateChange, debugView } = useDemoContext();

  const [dragState, setDragStateRaw] = useState<DragState<T>>({
    type: "idle",
    state: initialState,
  });
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const pendingStateTransition = useRef<DragState<T> | null>(null);

  const drawerConfig = {
    snapRadius: config.snapRadius ?? 10,
    transitionWhileDragging: config.transitionWhileDragging ?? true,
    relativePointerMotion: config.relativePointerMotion ?? false,
    animationDuration: config.animationDuration ?? 300,
  };

  const setDragState = useCallback(
    (newDragState: DragState<T>) => {
      console.log("setDragState", newDragState);
      setDragStateRaw(newDragState);
      onDragStateChange?.(newDragState);
    },
    [onDragStateChange],
  );

  // Will be populated during render
  let currentFlattened: FlattenedSvg = new Map();

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

  const [svgElem, setSvgElem] = useState<SVGSVGElement | null>(null);

  function postProcessForInteraction(element: SvgElem, state: T): FlattenedSvg {
    return pipe(
      element,
      assignPaths,
      (el) =>
        mapDraggables<T>(el, (el, dragSpecCallback) => {
          return cloneElement(el, {
            style: { cursor: "grab", ...(el.props.style || {}) },
            onPointerDown: (e: PointerEvent) => {
              console.log("onPointerDown");
              e.stopPropagation();
              assert(!!svgElem, "SVG element must be set");
              const rect = svgElem.getBoundingClientRect();
              const pointerPos = Vec2(
                e.clientX - rect.left,
                e.clientY - rect.top,
              );
              setPointer(pointerPos);
              // Compute pointer offset from element position using current flattened
              const elementInFlattened = currentFlattened.get(
                el.props.id || "",
              );
              const elementPos = elementInFlattened
                ? extractPosition(elementInFlattened)
                : Vec2(0, 0);
              const pointerOffset = pointerPos.sub(elementPos);
              const path = getPath(el);
              assert(!!path, "Draggable element must have a path");
              setDragState(
                computeEnterDraggingMode(
                  state,
                  path,
                  dragSpecCallback(),
                  pointerOffset,
                  manipulableSvg,
                ),
              );
            },
          });
        }),
      (d) => flattenSvg(d, true),
      (flattened) => {
        // console.log("postProcessForInteraction result:", flattened);
        // prettyLog(flattened);
        return flattened;
      },
    );
  }

  const renderState = computeRenderState(
    dragState,
    pointer,
    drawerConfig,
    manipulableSvg,
    postProcessForInteraction,
  );
  const { flattenedToRender, newState, pendingTransition, debugRender } =
    renderState;
  currentFlattened = renderState.currentFlattened;

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
    if (!svgElem) return;

    if (dragState.type !== "dragging" && dragState.type !== "dragging-params") {
      return;
    }

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      const rect = svgElem.getBoundingClientRect();
      setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const handlePointerUp = () => {
      if (dragState.type === "dragging" && newState) {
        setDragState({
          type: "animating",
          startFlattened: flattenedToRender,
          targetState: newState,
          startTime: Date.now(),
          duration: drawerConfig.animationDuration,
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
    dragState.type,
    drawerConfig.animationDuration,
    flattenedToRender,
    newState,
    setDragState,
    svgElem,
  ]);

  return (
    <svg
      ref={setSvgElem}
      width="800"
      height="600"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from(flattenedToRender.entries()).map(([key, element]) => (
        <Fragment key={key}>{stripDraggables(element)}</Fragment>
      ))}
      {debugView && debugRender}
    </svg>
  );
}
