import { isObject } from "lodash";
import { PathIn } from "./paths";
import { hasKey, Many, manyToArray } from "./utils";

// DragSpec is the value that specifies how dragging works. It can,
// in some cases, be a bunch of nested arrays or nulls or whatever.
// TODO: more sophisticated combos
export type DragSpec<T> =
  | Many<DragSpecManifold<T>>
  | DragSpecParams<T>
  | DragSpecDetachReattach<T>;

const targetStateSymbol: unique symbol = Symbol("TargetState");

export type TargetState<T> = {
  type: typeof targetStateSymbol;
  targetState: T;
  andThen: T | undefined;
};

export type DragSpecManifold<T> = {
  type: "manifold";
  states: TargetState<T>[];
};

export type DragSpecParams<T> =
  | { type: "param-paths"; paramPaths: PathIn<T, number>[] }
  | {
      type: "params";
      initParams: number[];
      stateFromParams: (...params: number[]) => T;
    };

export type DragSpecDetachReattach<T> = {
  type: "detach-reattach";
  detachedState: T;
  reattachedStates: T[];
};

export type TargetStateLike<T> = T | TargetState<T>;
export function toTargetState<T>(state: TargetStateLike<T>): TargetState<T> {
  if (
    isObject(state) &&
    hasKey(state, "type") &&
    state.type === targetStateSymbol
  ) {
    return state as TargetState<T>;
  } else {
    return {
      type: targetStateSymbol,
      targetState: state as T,
      andThen: undefined,
    };
  }
}

export function span<T>(
  ...manyStates: Many<TargetStateLike<T>>[]
): DragSpecManifold<T> {
  return {
    type: "manifold",
    states: manyToArray(manyStates).map(toTargetState),
  };
}

export function straightTo<T>(state: TargetStateLike<T>): DragSpecManifold<T> {
  return { type: "manifold", states: [toTargetState(state)] };
}

export function detachReattach<T>(
  detachedState: T,
  reattachedStates: T[]
): DragSpecDetachReattach<T> {
  return { type: "detach-reattach", detachedState, reattachedStates };
}

export function params<T>(
  initParams: number[],
  stateFromParams: (...params: number[]) => T
): DragSpecParams<T> {
  return { type: "params", initParams, stateFromParams };
}

export function numsAtPaths<T>(
  paramPaths: PathIn<T, number>[]
): DragSpecParams<T> {
  return { type: "param-paths", paramPaths };
}

export function numAtPath<T>(paramPath: PathIn<T, number>): DragSpecParams<T> {
  return { type: "param-paths", paramPaths: [paramPath] };
}

export function andThen<T>(targetState: T, andThen: T): TargetState<T> {
  return {
    type: targetStateSymbol,
    targetState,
    andThen,
  };
}
