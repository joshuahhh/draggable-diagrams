import _ from "lodash";
import { PathIn } from "./paths";
import { HoistedSvgx } from "./svgx/hoist";
import { assertNever } from "./utils";

// # DragSpec
//
// v2 drag spec: a composable algebra for floating + params drags.
// Plain data, no classes. Combinators are functions that produce new specs.
//
// Not in scope (yet): span/manifold stuff.

// ## Data representation

export type DragSpec<T> =
  | DragSpecDetach<T>
  | DragSpecClosest<T>
  | DragSpecWithBackground<T>
  | DragSpecAndThen<T>;
// | DragSpecVary<T>;

export type DragSpecDetach<T> = {
  type: "detach";
  state: T;
};

export type DragSpecClosest<T> = {
  type: "closest";
  specs: DragSpec<T>[];
};

export type DragSpecWithBackground<T> = {
  type: "with-background";
  foreground: DragSpec<T>;
  background: DragSpec<T>;
};

export type DragSpecAndThen<T> = {
  type: "and-then";
  spec: DragSpec<T>;
  andThen: T;
};

export type DragSpecVary<T> =
  | {
      type: "vary-paths";
      baseState?: T;
      paramPaths: PathIn<T, number>[];
    }
  | {
      type: "vary-params";
      baseState?: T;
      initParams: number[];
      stateFromParams: (...params: number[]) => T;
    };

// ## Constructors

export function detach<T>(state: T): DragSpec<T> {
  return { type: "detach", state };
}

export function closest<T>(specs: DragSpec<T>[]): DragSpec<T> {
  return { type: "closest", specs };
}

export function withBackground<T>(
  foreground: DragSpec<T>,
  background: DragSpec<T>
): DragSpec<T> {
  return { type: "with-background", foreground, background };
}

export function andThen<T>(spec: DragSpec<T>, andThen: T): DragSpec<T> {
  return { type: "and-then", spec, andThen };
}

// export function vary<T>(...paramPaths: PathIn<T, number>[]): DragSpec<T>;
// export function vary<T>(
//   baseState: T,
//   ...paramPaths: PathIn<T, number>[]
// ): DragSpec<T>;
// export function vary(...args: unknown[]): DragSpec<any> {
//   if (args.length > 0 && !Array.isArray(args[0])) {
//     const [baseState, ...paramPaths] = args;
//     return { type: "vary-paths", paramPaths: paramPaths as any, baseState };
//   }
//   return { type: "vary-paths", paramPaths: args as any };
// }

// export function params<T>(
//   initParams: number[],
//   stateFromParams: (...params: number[]) => T
// ): DragSpec<T> {
//   return { type: "vary-params", initParams, stateFromParams };
// }

// # Behavior

type DragState<T> = {};

type DragResult<T> = {
  rendered: HoistedSvgx;
  dropState: T;
};

type DragBehavior<T> = (state: DragState<T>) => DragResult<T>;

export function dragSpecToBehavior<T>(spec: DragSpec<T>): DragBehavior<T> {
  if (spec.type === "detach") {
    // TODO: render backdrop and floating
    return () => ({
      rendered: undefined as any, // TODO: composite backdrop and floating
      dropState: spec.state,
    });
  } else if (spec.type === "closest") {
    const subBehaviors = spec.specs.map((subSpec) =>
      dragSpecToBehavior(subSpec)
    );
    return (state) => {
      const subResults = subBehaviors.map((subBehavior) => subBehavior(state));
      return _.minBy(subResults, (subResult) => {
        return undefined as any as number; // TODO
      })!;
    };
  } else if (spec.type === "with-background") {
    const foregroundBehavior = dragSpecToBehavior(spec.foreground);
    const backgroundBehavior = dragSpecToBehavior(spec.background);
    return (state) => {
      const foregroundResult = foregroundBehavior(state);
      const distance = undefined as any as number; // TODO
      if (distance > 50) {
        // TODO
        return backgroundBehavior(state);
      } else {
        return foregroundResult;
      }
    };
  } else if (spec.type === "and-then") {
    const subBehavior = dragSpecToBehavior(spec.spec);
    return (state) => ({ ...subBehavior(state), dropState: spec.andThen });
  } else {
    assertNever(spec);
  }
}
