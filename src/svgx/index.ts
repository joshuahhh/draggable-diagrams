import { ReactElement, SVGProps } from "react";

// SVGX is our slang for "messing around with SVG represented as
// React elements, generally provided by a diagram author as JSX".

export type Svgx = ReactElement<SVGProps<SVGElement>>;
