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
  | DragSpecSwitchToStateAndFollow<T>;

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
  transition: boolean;
  chain: boolean;
};

export type DragSpecWithDropTransition<T> = {
  type: "with-drop-transition";
  spec: DragSpecData<T>;
  transition: Transition | undefined;
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
    options?: { transition?: boolean; chain?: boolean },
  ): DragSpec<T>;
  withDropTransition(transition?: TransitionLike): DragSpec<T>;
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
    } as DragSpecData<any>);
  },
  withSnapRadius(radius, { transition = false, chain = false } = {}) {
    return attachMethods({
      type: "with-snap-radius",
      spec: this,
      radius,
      transition,
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
  withDistance(f) {
    return attachMethods({ type: "with-distance", spec: this, f });
  },
};

function attachMethods<T>(data: DragSpecData<T>): DragSpec<T> {
  return Object.assign(Object.create(dragSpecMethods), data) as DragSpec<T>;
}

// # DragSpecBuilder

export class DragSpecBuilder<T> {
  just(states: T[]): DragSpec<T>[];
  just(state: T): DragSpec<T>;
  just(stateOrStates: T | T[]): DragSpec<T> | DragSpec<T>[] {
    if (Array.isArray(stateOrStates))
      return stateOrStates.map((s) => this.just(s));
    return attachMethods({ type: "just", state: stateOrStates });
  }

  floating(states: T[], opts?: { ghost?: SVGProps<SVGElement> }): DragSpec<T>[];
  floating(state: T, opts?: { ghost?: SVGProps<SVGElement> }): DragSpec<T>;
  floating(
    stateOrStates: T | T[],
    { ghost }: { ghost?: SVGProps<SVGElement> } = {},
  ): DragSpec<T> | DragSpec<T>[] {
    if (Array.isArray(stateOrStates))
      return stateOrStates.map((s) => this.floating(s, { ghost }));
    return attachMethods({ type: "floating", state: stateOrStates, ghost });
  }

  between(...states: Many<T>[]): DragSpec<T> {
    assert(states.length > 0, "between requires at least one state");
    return attachMethods({ type: "between", states: manyToArray(states) });
  }

  closest(...specs: Many<DragSpec<T>>[]): DragSpec<T> {
    return attachMethods({ type: "closest", specs: manyToArray(specs) });
  }

  vary(state: T, ...paramPaths: PathIn<T, number>[]): DragSpec<T>;
  vary(
    state: T,
    ...args: [...PathIn<T, number>[], VaryOptions<T>]
  ): DragSpec<T>;
  vary(state: T, ...args: (PathIn<T, number> | VaryOptions<T>)[]): DragSpec<T> {
    const { paramPaths, options } = parseVaryArgs<T>(args);
    return attachMethods({ type: "vary", state, paramPaths, ...options });
  }

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
  constraint?: (state: T) => Many<number>;
  /** Use parameter-space distance in pullback (faster, but less accurate) */
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
      options: last as VaryOptions<T>,
    };
  }
  return { paramPaths: args as PathIn<T, number>[], options: {} };
}

/** Constraint helper: returns a - b, so a < b when result ≤ 0 */
export function lessThan(a: number, b: number): number {
  return a - b;
}
