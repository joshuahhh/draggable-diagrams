import { ReactElement, SetStateAction } from "react";
import { DragSpec } from "./DragSpec2";
import { ErrorWithJSX } from "./ErrorBoundary";
import { PrettyPrint } from "@joshuahhh/pretty-print";
import { Svgx } from "./svgx";
import { isObject } from "./utils";

/**
 * A Manipulable is a function that takes state and draggable helper, returns SVG JSX.
 */
export type Manipulable<T extends object> = (
  props: ManipulableProps<T>
) => Svgx;

export type ManipulableProps<T extends object> = {
  state: T;
  drag: typeof unsafeDrag<T>;
  draggedId: string | null;
  ghostId: string | null;
  setState: SetState<T>;
};

// # setState

export type SetState<T> = (
  newState: SetStateAction<T>,
  props?: {
    easing?: (t: number) => number;
    seconds?: number;
    immediate?: boolean;
  }
) => void;

// # drag

export type Drag<T> = typeof unsafeDrag<T>;

// this is exported so that ManipulableDrawer can import it and
// provide it to manipulables, but it's important for type-safety
// that manipulables not use it directly.
export function unsafeDrag<T>(
  dragSpec: (() => DragSpec<T>) | DragSpec<T>
): OnDragPropValue<T> {
  return {
    type: onDragPropValueSymbol,
    value: typeof dragSpec === "function" ? dragSpec : () => dragSpec,
  };
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

export function getDragSpecCallbackOnElement<T>(
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
