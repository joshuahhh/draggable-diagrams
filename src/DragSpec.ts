import { PathIn } from "./paths";
import { Many, manyToArray } from "./utils";

// DragSpec is the value that specifies how dragging works. It can,
// in some cases, be a bunch of nested arrays or nulls or whatever.
// TODO: more sophisticated combos
export type DragSpec<T> = Many<DragSpecManifold<T>> | DragSpecParams<T>;

export type DragSpecManifold<T> = { type: "manifold"; states: T[] };

export type DragSpecParams<T> =
  | { type: "param-paths"; paramPaths: PathIn<T, number>[] }
  | {
      type: "params";
      initParams: number[];
      stateFromParams: (...params: number[]) => T;
    };

export function span<T>(...manyStates: Many<T>[]): DragSpecManifold<T> {
  return { type: "manifold", states: manyToArray(manyStates) };
}
export function straightTo<T>(state: T): DragSpecManifold<T> {
  return { type: "manifold", states: [state] };
}
export function params<T>(
  initParams: number[],
  stateFromParams: (...params: number[]) => T,
): DragSpecParams<T> {
  return { type: "params", initParams, stateFromParams };
}
export function numsAtPaths<T>(
  paramPaths: PathIn<T, number>[],
): DragSpecParams<T> {
  return { type: "param-paths", paramPaths };
}
export function numAtPath<T>(paramPath: PathIn<T, number>): DragSpecParams<T> {
  return { type: "param-paths", paramPaths: [paramPath] };
}
