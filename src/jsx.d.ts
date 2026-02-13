import { Falsey } from "lodash";
import "react";
import { DragSpecBrand } from "./DragSpec";
import { DragParams } from "./draggable";

declare module "react" {
  interface SVGAttributes<T> {
    /**
     * Custom attribute for attaching drag specifications to SVG elements.
     * Set to a function returning a DragSpec.
     *
     * @example
     * <circle data-on-drag={() => d.vary(state, ["x"], ["y"])} />
     *
     * @example
     * <rect data-on-drag={() => d.between([state1, state2])} />
     */
    "data-on-drag"?: ((params: DragParams) => DragSpecBrand) | Falsey;

    "data-z-index"?: number;
    "data-transition"?: boolean;
  }
}
