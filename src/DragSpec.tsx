import { SVGProps } from "react";
import {
  Transition,
  TransitionLike,
  resolveTransitionLike,
} from "./DraggableRenderer";
import { PathIn } from "./paths";
import { Many, assert, manyToArray } from "./utils";

// # DragSpecData

export type DragSpecData<T> =
  | DragSpecJust<T>
  | DragSpecFloating<T>
  | DragSpecClosest<T>
  | DragSpecWithBackground<T>
  | DragSpecAndThen<T>
  | DragSpecVary<T>
  | DragSpecWithDistance<T>
  | DragSpecWithSnapRadius<T>
  | DragSpecWithDropTransition<T>
  | DragSpecBetween<T>
  | DragSpecSwitchToStateAndFollow<T>
  | DragSpecDropTarget<T>
  | DragSpecWithBranchTransition<T>;

export type DragSpecJust<T> = {
  type: "just";
  state: T;
};

export type DragSpecFloating<T> = {
  type: "floating";
  state: T;
  ghost: SVGProps<SVGElement> | undefined;
};

export type DragSpecClosest<T> = {
  type: "closest";
  specs: DragSpecData<T>[];
};

export type DragSpecWithBackground<T> = {
  type: "with-background";
  foreground: DragSpecData<T>;
  background: DragSpecData<T>;
  radius: number;
};

export type DragSpecWithSnapRadius<T> = {
  type: "with-snap-radius";
  spec: DragSpecData<T>;
  radius: number;
  transition: Transition | false;
  chain: boolean;
};

export type DragSpecWithDropTransition<T> = {
  type: "with-drop-transition";
  spec: DragSpecData<T>;
  transition: Transition | undefined;
};

export type DragSpecWithBranchTransition<T> = {
  type: "with-branch-transition";
  spec: DragSpecData<T>;
  transition: Transition | false;
};

export type DragSpecAndThen<T> = {
  type: "and-then";
  spec: DragSpecData<T>;
  andThenState: T;
};

export type DragSpecVary<T> = {
  type: "vary";
  state: T;
  paramPaths: PathIn<T, number>[];
  constraint?(state: T): Many<number>;
  constrainByParams?: boolean;
};

export type DragSpecWithDistance<T> = {
  type: "with-distance";
  spec: DragSpecData<T>;
  f: (distance: number) => number;
};

export type DragSpecBetween<T> = {
  type: "between";
  states: T[];
};

export type DragSpecSwitchToStateAndFollow<T> = {
  type: "switch-to-state-and-follow";
  state: T;
  draggedId: string;
  followSpec?: DragSpec<T>;
};

export type DragSpecDropTarget<T> = {
  type: "drop-target";
  state: T;
  targetId: string;
};

// # DragSpec

// Full API, including methods and a brand.
export type DragSpec<T> = DragSpecData<T> & DragSpecMethods<T> & DragSpecBrand;

// Brand marker so jsx.d.ts can reference DragSpec without a generic parameter.
declare const _dragSpecBrand: unique symbol;
export type DragSpecBrand = { readonly [_dragSpecBrand]: true };

// Fluent methods available on every DragSpec value.
export interface DragSpecMethods<T> {
  andThen(state: T): DragSpec<T>;
  withBackground<B>(
    background: DragSpec<B>,
    opts?: { radius?: number },
  ): DragSpec<T | B>;
  withSnapRadius(
    radius: number,
    options?: { transition?: TransitionLike; chain?: boolean },
  ): DragSpec<T>;
  withDropTransition(transition?: TransitionLike): DragSpec<T>;
  withBranchTransition(transition: TransitionLike): DragSpec<T>;
  withDistance(f: (distance: number) => number): DragSpec<T>;
}

const dragSpecMethods: DragSpecMethods<any> & ThisType<DragSpec<any>> = {
  andThen(state) {
    return attachMethods({ type: "and-then", spec: this, andThenState: state });
  },
  withBackground(bg, { radius = 50 } = {}) {
    return attachMethods({
      type: "with-background",
      foreground: this,
      background: bg,
      radius,
    });
  },
  withSnapRadius(radius, { transition = false, chain = false } = {}) {
    return attachMethods({
      type: "with-snap-radius",
      spec: this,
      radius,
      transition: resolveTransitionLike(transition) ?? false,
      chain,
    });
  },
  withDropTransition(transition = true) {
    return attachMethods({
      type: "with-drop-transition",
      spec: this,
      transition: resolveTransitionLike(transition),
    });
  },
  withBranchTransition(transition) {
    return attachMethods({
      type: "with-branch-transition",
      spec: this,
      transition: resolveTransitionLike(transition) ?? false,
    });
  },
  withDistance(f) {
    return attachMethods({ type: "with-distance", spec: this, f });
  },
};

function attachMethods<T>(data: DragSpecData<T>): DragSpec<T> {
  return Object.assign(Object.create(dragSpecMethods), data);
}

// # DragSpecBuilder

export class DragSpecBuilder<T> {
  /**
   * This drag behavior simply shows a static view of the given
   * state.
   */
  just(states: T[]): DragSpec<T>[];
  just(state: T): DragSpec<T>;
  just(stateOrStates: T | T[]): DragSpec<T> | DragSpec<T>[] {
    if (Array.isArray(stateOrStates))
      return stateOrStates.map((s) => this.just(s));
    return attachMethods({ type: "just", state: stateOrStates });
  }

  /**
   * This drag behavior "detaches" a dragged element from its
   * original position and lets it be dragged freely. Optionally, a
   * "ghost" element can be rendered at the original position while
   * dragging. Often used with `closest`.
   */
  floating(
    states: T[],
    opts?: { ghost?: SVGProps<SVGElement> | true },
  ): DragSpec<T>[];
  floating(
    state: T,
    opts?: { ghost?: SVGProps<SVGElement> | true },
  ): DragSpec<T>;
  floating(
    stateOrStates: T | T[],
    { ghost }: { ghost?: SVGProps<SVGElement> | true } = {},
  ): DragSpec<T> | DragSpec<T>[] {
    if (Array.isArray(stateOrStates))
      return stateOrStates.map((s) => this.floating(s, { ghost }));
    return attachMethods({
      type: "floating",
      state: stateOrStates,
      ghost: ghost === true ? { opacity: 0.5 } : ghost,
    });
  }

  /**
   * This drag behavior lets you interpolate smoothly between states
   * by dragging inside their convex hull.
   */
  between(...states: Many<T>[]): DragSpec<T> {
    assert(states.length > 0, "between requires at least one state");
    return attachMethods({ type: "between", states: manyToArray(states) });
  }

  /**
   * This drag behavior combines multiple behaviors. During the drag,
   * it continuously switches to the behavior that gets the dragged
   * element closest to the pointer.
   */
  closest(...specs: Many<DragSpec<T>>[]): DragSpec<T> {
    return attachMethods({ type: "closest", specs: manyToArray(specs) });
  }

  /**
   * This drag behavior allows you to vary numbers in a state
   * continuously by dragging. Provide a starting state and paths to
   * the parameters you want to vary. An optional final parameter can
   * configure constraints.
   */
  vary(state: T, ...paramPaths: PathIn<T, number>[]): DragSpec<T>;
  vary(
    state: T,
    ...args: [...PathIn<T, number>[], VaryOptions<T>]
  ): DragSpec<T>;
  vary(state: T, ...args: (PathIn<T, number> | VaryOptions<T>)[]): DragSpec<T> {
    const { paramPaths, options } = parseVaryArgs<T>(args);
    return attachMethods({ type: "vary", state, paramPaths, ...options });
  }

  /**
   * This drag behavior renders a state and checks whether the
   * pointer is inside the bounds of a target element (identified by
   * ID). Distance is 0 when inside, Infinity when outside.
   */
  dropTarget(state: T, targetId: string): DragSpec<T> {
    return attachMethods({ type: "drop-target", state, targetId });
  }

  /**
   * This drag behavior immediately transitions into a new state,
   * then continues the drag from a different element in that state,
   * identified by ID. If followSpec is provided, it will be used to
   * continue the drag; otherwise, the spec attached to the new
   * element (via data-on-drag) will be used.
   */
  switchToStateAndFollow(
    state: T,
    draggedId: string,
    followSpec?: DragSpec<T>,
  ): DragSpec<T> {
    return attachMethods({
      type: "switch-to-state-and-follow",
      state,
      draggedId,
      followSpec,
    });
  }
}

export type VaryOptions<T> = {
  /**
   * A constraint function returns one or more numbers, all of which
   * will be constrained to be negative. You can use `lessThan(a, b)`
   * to express a < b constraints.
   */
  constraint?: (state: T) => Many<number>;
  /**
   * For use alongside `constraint`. If the parameters you are
   * varying represent cartesian coordinates in screen space, you can
   * set this to "true" for better performance. But this will lead to
   * less accurate results if the varied parameters are, say, angles.
   */
  constrainByParams?: boolean;
};

function parseVaryArgs<T>(args: (PathIn<T, number> | VaryOptions<T>)[]): {
  paramPaths: PathIn<T, number>[];
  options: VaryOptions<T>;
} {
  const last = args[args.length - 1];
  if (
    args.length > 0 &&
    last &&
    !Array.isArray(last) &&
    typeof last === "object"
  ) {
    return {
      paramPaths: args.slice(0, -1) as PathIn<T, number>[],
      options: last,
    };
  }
  return { paramPaths: args as PathIn<T, number>[], options: {} };
}

/** Constraint helper: returns a - b, so a < b when result ≤ 0 */
export function lessThan(a: number, b: number): number {
  return a - b;
}
