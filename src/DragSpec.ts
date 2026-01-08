import { isObject } from "lodash";
import { SVGProps } from "react";
import { PathIn } from "./paths";
import { assert, hasKey, Many, manyToArray } from "./utils";

// # DragSpec

/**
 * DragSpec is information a diagram author attaches to an SVG
 * element to say what states should be accessible by dragging it
 * (and how).
 */
export type DragSpec<T> =
  | Many<DragSpecManifold<T>>
  | DragSpecParams<T>
  | DragSpecFloating<T>;

// TODO: more sophisticated combos

export type DragSpecManifold<T> =
  | {
      type: "manifold";
      states: Exit<T>[];
    }
  | {
      type: "straight-to";
      state: Exit<T>;
    };

export type DragSpecParams<T> =
  | { type: "param-paths"; paramPaths: PathIn<T, number>[] }
  | {
      type: "params";
      initParams: number[];
      stateFromParams: (...params: number[]) => T;
    };

export type DragSpecFloating<T> = {
  type: "floating";
  states: Exit<T>[];
  backdropExit: Exit<T> | undefined;
  ghost: boolean | SVGProps<SVGElement>;
  onTop: boolean;
};

export type DragSpecFree<T> = {
  type: "free";
  states: Exit<T>[];
  animate: boolean;
};

// # Exit

/**
 * An Exit is a state you want to be able to transition into by
 * dragging towards it. It optionally includes "what to do when you
 * get there" via `andThen`.
 *
 * It might be better to see `state` as "what you'll see if you drag
 * here" and `andThen` as "what you'll actually go to if you drag
 * here"; doesn't seem like we're actually "sequencing" these.
 */
export type Exit<T> = {
  state: T;
  /**
   * If defined, a state to immediately transition to after reaching
   * this state.
   */
  andThen: T | undefined;
};

export type ExitLike<T> = T | Exit<T>;
export function isExit<T>(state: ExitLike<T>): state is Exit<T> {
  return isObject(state) && hasKey(state, "state") && hasKey(state, "andThen");
}
export function toExit<T>(state: ExitLike<T>): Exit<T> {
  return isExit(state) ? state : { state, andThen: undefined };
}

// # Constructors

export function span<T>(
  ...manyStates: Many<ExitLike<T>>[]
): DragSpecManifold<T> {
  const states = manyToArray(manyStates);
  assert(
    states.length > 0,
    "span requires at least one state... did you forget the starting state?"
  );
  return {
    type: "manifold",
    states: states.map(toExit),
  };
}

export function straightTo<T>(state: ExitLike<T>): DragSpecManifold<T> {
  return { type: "straight-to", state: toExit(state) };
}

/**
 * A "floating" drag-spec says that the dragged item should be freely
 * draggable, "floating" over the diagram.
 */
export function floating<T>(
  /**
   * States that can be accessed by moving the dragged item to their
   * position.
   */
  states: Many<ExitLike<T>>,
  options?: {
    /**
     * If provided, drags to locations far from `states` will access
     * this state.
     */
    backdrop?: ExitLike<T>;
    /**
     * When a state from `states` is shown during the drag, the
     * dragged item is typically removed from the background, since
     * it will be shown floating. By setting `ghost` to `true`, the
     * dragged item will not be removed, and will instead exist as a
     * "ghost" alongside the floating version, showing a potential
     * future position of the dragged item. We signal the ghost to
     * the render function via `ghostId` for arbitrary custom
     * display. As a shortcut, if this option is set to SVG
     * attributes, those attributes will be applied to the ghost
     * element (alongside the typical `true` behavior).
     */
    ghost?: boolean | SVGProps<SVGElement>;
    /**
     * If true (default), the floating item will be rendered on top
     * of all other elements during the drag.
     */
    onTop?: boolean;
    // TODO: various animation options
  }
): DragSpecFloating<T> {
  return {
    type: "floating",
    states: manyToArray(states).map(toExit),
    backdropExit: options?.backdrop ? toExit(options.backdrop) : undefined,
    ghost: options?.ghost ?? false,
    onTop: options?.onTop ?? true,
  };
}

// export function detachReattach<T>(
//   detachedState: T,
//   reattachedStates: Many<TargetStateLike<T>>
// ): DragSpecDetachReattach<T> {
//   return {
//     type: "detach-reattach",
//     detachedState,
//     reattachedStates: manyToArray(reattachedStates).map(toTargetState),
//   };
// }

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

export function andThen<T>(state: T, andThen: T): Exit<T> {
  return { state, andThen };
}
