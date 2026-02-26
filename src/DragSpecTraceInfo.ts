import { DragSpecData } from "./DragSpec";
import { Vec2 } from "./math/vec2";
import { LayeredSvgx } from "./svgx/layers";

export type RenderedState = { layered: LayeredSvgx; position: Vec2 };

/**
 * Maps each DragSpec variant's `type` discriminant to its trace info
 * shape.
 */
export type DragSpecTraceInfoByType = {
  fixed: { renderedStates: RenderedState[] };
  "with-floating": { outputRendered: LayeredSvgx };
  closest: { bestIndex: number };
  "with-background": { inForeground: boolean };
  "and-then": Record<string, never>;
  during: { outputRendered: LayeredSvgx };
  vary: { renderedStates: RenderedState[]; currentParams: number[] };
  "with-distance": Record<string, never>;
  "with-snap-radius": {
    snapped: boolean;
    outputRendered: LayeredSvgx;
  };
  "with-drop-transition": Record<string, never>;
  "with-branch-transition": Record<string, never>;
  between: {
    renderedStates: RenderedState[];
    closestIndex: number;
    outputRendered: LayeredSvgx;
  };
  "switch-to-state-and-follow": { renderedStates: RenderedState[] };
  "drop-target": { renderedStates: RenderedState[]; inside: boolean };
  "with-chaining": Record<string, never>;
};

/** Get typed trace info from a spec node, or undefined if not annotated. */
export function getTraceInfo<S extends DragSpecData<any>>(
  spec: S,
): DragSpecTraceInfoByType[S["type"]] | undefined {
  return spec.traceInfo as DragSpecTraceInfoByType[S["type"]] | undefined;
}

/** Return a copy of the spec with typed trace info attached. */
export function setTraceInfo<S extends DragSpecData<any>>(
  spec: S,
  traceInfo: DragSpecTraceInfoByType[S["type"]],
): S {
  return { ...spec, traceInfo };
}
