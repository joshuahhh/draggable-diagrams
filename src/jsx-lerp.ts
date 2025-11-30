import React from "react";
import { SvgElem } from "./jsx-flatten";
import { lerpTransformString } from "./svg-transform";

/**
 * Lerps between two SVG JSX nodes.
 * Interpolates transforms and recursively lerps children.
 */
export function lerpSvgNode(a: SvgElem, b: SvgElem, t: number): SvgElem {
  // Elements should be the same type
  if (a.type !== b.type) {
    throw new Error(
      `Cannot lerp between different element types: ${String(a.type)} and ${String(b.type)}`,
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
    if (key.startsWith("data-")) continue;

    const valA = propsA[key];
    const valB = propsB[key];

    if (typeof valA === "number" && typeof valB === "number") {
      lerpedNumericProps[key] = lerp(valA, valB, t);
    } else if (valA === valB) {
      // Non-numeric props must be the same
      lerpedNumericProps[key] = valA;
    } else if (valA !== undefined && valB === undefined) {
      lerpedNumericProps[key] = valA;
    } else if (valA === undefined && valB !== undefined) {
      lerpedNumericProps[key] = valB;
    } else {
      // Different non-numeric values
      throw new Error(
        `Cannot lerp prop "${key}": different non-numeric values (${valA} vs ${valB})`,
      );
    }
  }

  // Lerp children recursively
  const childrenA = React.Children.toArray(propsA.children) as SvgElem[];
  const childrenB = React.Children.toArray(propsB.children) as SvgElem[];

  let lerpedChildren: SvgElem[] = [];

  if (childrenA.length === childrenB.length) {
    lerpedChildren = childrenA.map((childA, i) => {
      const childB = childrenB[i];
      if (React.isValidElement(childA) && React.isValidElement(childB)) {
        return lerpSvgNode(childA, childB, t);
      }
      // For text nodes or other non-element children, just use A
      return childA;
    });
  } else {
    // Children counts differ
    throw new Error(
      `Cannot lerp children: different child counts (${childrenA.length} vs ${childrenB.length})`,
    );
  }

  return React.cloneElement(a, {
    ...lerpedNumericProps,
    ...(lerpedTransform ? { transform: lerpedTransform } : {}),
    children: lerpedChildren,
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
