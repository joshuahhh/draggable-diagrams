import { Falsey } from "lodash";
import "react";
import type { OnDragPropValue } from "./manipulable";

declare module "react" {
  interface SVGAttributes<T> {
    /**
     * Custom attribute for attaching drag specifications to SVG elements.
     * Use the `drag()` function to create the value for this attribute.
     *
     * @example
     * // Dragging numeric state properties
     * <circle data-on-drag={drag(vary(["x"], ["y"]))} />
     *
     * @example
     * // Dragging with custom drag spec function
     * <rect data-on-drag={drag(() => [straightTo(state1), straightTo(state2)])} />
     *
     * @see ManipulableSvg for more details
     */
    "data-on-drag"?: OnDragPropValue<any> | Falsey;

    "data-z-index"?: number;
  }
}
