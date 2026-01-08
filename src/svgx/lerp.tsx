import { rgb } from "d3-color";
import { interpolateHcl } from "d3-interpolate";
import { interpolatePath } from "d3-interpolate-path";
import React, { cloneElement } from "react";
import { shouldRecurseIntoChildren, Svgx } from ".";
import { ErrorWithJSX } from "../ErrorBoundary";
import { prettyLog, PrettyPrint } from "../pretty-print";
import { emptyToUndefined } from "../utils";
import { HoistedSvgx } from "./hoist";
import { lerpTransformString } from "./transform";

// SVG properties that should be interpolated as colors
const COLOR_PROPS = new Set([
  "fill",
  "stroke",
  "color",
  "stop-color",
  "flood-color",
  "lighting-color",
  // CSS properties that can appear in style objects
  "backgroundColor",
  "borderColor",
  "outlineColor",
]);

const NO_LERP_PROPS = new Set(["pointerEvents"]);

const DEFAULT_VALUE_FOR_KEY: { [key: string]: any } = {
  opacity: 1,
};

/**
 * Parses a points string (e.g., "0,0 10,5 20,10") into an array of [x, y] pairs.
 */
function parsePoints(pointsStr: string): number[][] {
  // Split on whitespace and/or commas, filter empty strings
  const tokens = pointsStr
    .trim()
    .split(/[\s,]+/)
    .filter((s) => s.length > 0)
    .map((s) => parseFloat(s));

  const points: number[][] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    points.push([tokens[i], tokens[i + 1]]);
  }
  return points;
}

/**
 * Serializes an array of [x, y] pairs back to a points string.
 */
function serializePoints(points: number[][]): string {
  return points.map((p) => `${p[0]},${p[1]}`).join(" ");
}

/**
 * Lerps between two points strings.
 */
function lerpPoints(pointsA: string, pointsB: string, t: number): string {
  const parsedA = parsePoints(pointsA);
  const parsedB = parsePoints(pointsB);

  if (parsedA.length !== parsedB.length) {
    throw new Error(
      `Cannot lerp points: different point counts (${parsedA.length} vs ${parsedB.length})`
    );
  }

  const lerped = parsedA.map((pa, i) => {
    const pb = parsedB[i];
    return [lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t)];
  });

  return serializePoints(lerped);
}

/**
 * Lerps a single value based on its type and property name.
 */
function lerpValue(key: string, valA: any, valB: any, t: number): any {
  // Check equality first before attempting interpolation
  if (valA === valB) {
    return valA;
  }

  valA ??= DEFAULT_VALUE_FOR_KEY[key];
  valB ??= DEFAULT_VALUE_FOR_KEY[key];

  if (valA !== undefined && valB === undefined) {
    return valA;
  } else if (valA === undefined && valB !== undefined) {
    return valB;
  } else if (typeof valA === "number" && typeof valB === "number") {
    return lerp(valA, valB, t);
  } else if (
    key === "points" &&
    typeof valA === "string" &&
    typeof valB === "string"
  ) {
    return lerpPoints(valA, valB, t);
  } else if (
    key === "d" &&
    typeof valA === "string" &&
    typeof valB === "string"
  ) {
    // Interpolate SVG path data using d3-interpolate-path
    const pathInterpolator = interpolatePath(valA, valB);
    return pathInterpolator(t);
  } else if (
    COLOR_PROPS.has(key) &&
    typeof valA === "string" &&
    typeof valB === "string"
  ) {
    // Handle "none" as transparent
    const isANone = valA === "none";
    const isBNone = valB === "none";

    if (isANone || isBNone) {
      // Get the actual color (the one that's not "none")
      const actualColor = isANone ? valB : valA;
      const colorRgb = rgb(actualColor);

      if (colorRgb === null) {
        // If color parsing failed, fall through to error
        throw new Error(
          `Cannot lerp prop "${key}": invalid color value (${actualColor})`
        );
      }

      // Create transparent version of the color
      const transparentColor = rgb(colorRgb.r, colorRgb.g, colorRgb.b, 0);
      const opaqueColor = rgb(colorRgb.r, colorRgb.g, colorRgb.b, 1);

      // Interpolate between transparent and opaque
      const colorInterp = isANone
        ? interpolateHcl(transparentColor.formatRgb(), opaqueColor.formatRgb())
        : interpolateHcl(opaqueColor.formatRgb(), transparentColor.formatRgb());

      return colorInterp(t);
    }

    // Interpolate colors using HCL color space
    const colorInterp = interpolateHcl(valA, valB);
    return colorInterp(t);
  } else if (typeof valA === "string" && typeof valB === "string") {
    // Try to parse both as numbers
    const numA = parseFloat(valA);
    const numB = parseFloat(valB);

    if (!isNaN(numA) && !isNaN(numB)) {
      // Both are numeric strings - interpolate and return as string
      return String(lerp(numA, numB, t));
    }

    // Non-numeric strings - can't interpolate
    throw new Error(
      `Cannot lerp prop "${key}": different non-numeric values (${valA} vs ${valB})`
    );
  } else {
    // Different non-numeric values
    throw new Error(
      `Cannot lerp prop "${key}": different non-numeric values (${valA} vs ${valB})`
    );
  }
}

/**
 * Lerps between two SVG JSX nodes.
 * Interpolates transforms and recursively lerps children.
 */
export function lerpSvgx(a: Svgx, b: Svgx, t: number): Svgx {
  // console.log("Lerping SVG nodes:", a, b, t);

  // Elements should be the same type
  if (a.type !== b.type) {
    throw new ErrorWithJSX(
      `Cannot lerp between different element types: ${String(
        a.type
      )} and ${String(b.type)}`,
      (
        <>
          <p className="mb-2">
            During interpolation, I found elements of different types at the
            same path in the "before" and "after" SVG trees. I don't know how to
            interpolate between those, sorry.
          </p>
          {a.props.id === b.props.id && (
            <p className="mb-2">
              (FYI: These elements share the ID{" "}
              <span className="font-mono">{a.props.id}</span>. I would guess
              that you are drawing this element in two different code paths, and
              they don't match up.)
            </p>
          )}
          <PrettyPrint value={a} />
          <div className="my-4">vs</div>
          <PrettyPrint value={b} />
        </>
      )
    );
  }

  const propsA = a.props as any;
  const propsB = b.props as any;

  // Lerp transform if present
  const transformA = propsA.transform || "";
  const transformB = propsB.transform || "";
  const lerpedTransform = lerpTransformString(transformA, transformB, t);

  // Lerp numeric props (x, y, width, height, etc.)
  const lerpedNumericProps: any = {};
  const allPropKeys = new Set([...Object.keys(propsA), ...Object.keys(propsB)]);

  for (const key of allPropKeys) {
    if (key === "children" || key === "transform") continue;
    // TODO: audit handling of data- props
    if (key.startsWith("data-")) continue;
    if (/^on[A-Z]/.test(key)) continue;
    if (NO_LERP_PROPS.has(key)) continue;

    const valA = propsA[key];
    const valB = propsB[key];

    // Special handling for style objects
    if (
      key === "style" &&
      typeof valA === "object" &&
      typeof valB === "object"
    ) {
      const styleA = valA || {};
      const styleB = valB || {};
      const lerpedStyle: any = {};
      const allStyleKeys = new Set([
        ...Object.keys(styleA),
        ...Object.keys(styleB),
      ]);

      for (const styleKey of allStyleKeys) {
        lerpedStyle[styleKey] = lerpValue(
          styleKey,
          styleA[styleKey],
          styleB[styleKey],
          t
        );
      }

      lerpedNumericProps[key] = lerpedStyle;
    } else {
      lerpedNumericProps[key] = lerpValue(key, valA, valB, t);
    }
  }

  // Lerp children recursively (skip foreignObject children)
  const childrenA = React.Children.toArray(propsA.children) as Svgx[];
  const childrenB = React.Children.toArray(propsB.children) as Svgx[];

  let lerpedChildren: Svgx[] = [];

  if (!shouldRecurseIntoChildren(a)) {
    // For foreignObject, just use children from A
    lerpedChildren = childrenA;
  } else if (childrenA.length === childrenB.length) {
    lerpedChildren = childrenA.map((childA, i) => {
      const childB = childrenB[i];
      if (React.isValidElement(childA) && React.isValidElement(childB)) {
        return lerpSvgx(childA, childB, t);
      }
      // For text nodes or other non-element children, just use A
      return childA;
    });
  } else {
    // Children counts differ
    prettyLog(childrenA, { label: "Children A" });
    prettyLog(childrenB, { label: "Children B" });
    throw new ErrorWithJSX(
      `Cannot lerp children: different child counts (${childrenA.length} vs ${childrenB.length})`,
      (
        <div>
          <PrettyPrint value={a} />
          <div className="my-4">vs</div>
          <PrettyPrint value={b} />
        </div>
      )
    );
  }

  return React.cloneElement(a, {
    ...lerpedNumericProps,
    ...(lerpedTransform ? { transform: lerpedTransform } : {}),
    children: emptyToUndefined(lerpedChildren),
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpHoisted(
  a: HoistedSvgx,
  b: HoistedSvgx,
  t: number
): HoistedSvgx {
  const result = new Map<string, Svgx>();
  const allKeys = new Set([...a.byId.keys(), ...b.byId.keys()]);

  for (const key of allKeys) {
    const aVal = a.byId.get(key);
    const bVal = b.byId.get(key);

    if (aVal && bVal) {
      // console.log("lerpHoisted is lerping key:", key);
      result.set(key, lerpSvgx(aVal, bVal, t));
    } else if (aVal) {
      // TODO: we're hard-coding "enter/exit by fading"
      const opacity = +(aVal.props.opacity ?? 1) * (1 - t);
      if (opacity > 1e-3) result.set(key, cloneElement(aVal, { opacity }));
    } else if (bVal) {
      const opacity = +(bVal.props.opacity ?? 1) * t;
      if (opacity > 1e-3) result.set(key, cloneElement(bVal, { opacity }));
    }
  }

  return {
    byId: result,
    descendents: null,
  };
}

export function lerpHoisted3(
  a: HoistedSvgx,
  b: HoistedSvgx,
  c: HoistedSvgx,
  { l0, l1, l2 }: { l0: number; l1: number; l2: number }
): HoistedSvgx {
  if (l0 + l1 < 1e-6) return c;
  const ab = lerpHoisted(a, b, l1 / (l0 + l1));
  return lerpHoisted(ab, c, l2);
}
