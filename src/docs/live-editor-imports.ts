// Barrel file for the LiveEditor's TypeScript environment.
// dts-bundle-generator processes this at build time to produce
// a single .d.ts with all types inlined — no hand-maintenance needed.

// Pull in jsx.d.ts so the compiler sees custom SVG attribute augmentations
import "../jsx.d";

export type {
  Draggable,
  DraggableProps,
  SetState,
  DragParams,
} from "../draggable";

export type {
  DragSpec,
  DragSpecBuilder,
  DragSpecMethods,
  FloatingOptions,
  VaryOptions,
} from "../DragSpec";
export { lessThan } from "../DragSpec";

export type { Transition, TransitionLike } from "../DraggableRenderer";

export type { PathIn } from "../paths";

export type { Many } from "../utils";

export type { Svgx } from "../svgx";

export type { Vec2able } from "../math/vec2";

export { translate, rotateDeg, rotateRad, scale, path } from "../svgx/helpers";
