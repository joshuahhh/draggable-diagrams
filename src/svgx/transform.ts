import { assert } from "vitest";
import { Vec2, Vec2able } from "../math/vec2";

/**
 * Parses and interpolates SVG transform strings.
 */

export type Transform =
  | { type: "translate"; x: number; y: number }
  | { type: "rotate"; degrees: number; cx: number; cy: number }
  | { type: "scale"; x: number; y: number };

/**
 * Parses an SVG transform string into an array of transform objects.
 */
export function parseTransform(str: string): Transform[] {
  if (!str || str.trim() === "") return [];

  const transforms: Transform[] = [];

  // Match transform functions like "translate(10, 20)" or "rotate(45)"
  const regex = /(\w+)\s*\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(str)) !== null) {
    const type = match[1];
    const args = match[2].split(/[\s,]+/).map((s) => parseFloat(s.trim()));

    switch (type) {
      case "translate":
        transforms.push({
          type: "translate",
          x: args[0] || 0,
          y: args[1] || 0,
        });
        break;
      case "rotate":
        transforms.push({
          type: "rotate",
          degrees: args[0] || 0,
          cx: args[1] || 0,
          cy: args[2] || 0,
        });
        break;
      case "scale":
        transforms.push({
          type: "scale",
          x: args[0] || 1,
          y: args[1] !== undefined ? args[1] : args[0] || 1,
        });
        break;
    }
  }

  return transforms;
}

export function localToGlobal(transforms: Transform[], able: Vec2able): Vec2 {
  let point = Vec2(able);
  // Apply transforms in reverse order (SVG transforms are right-to-left)
  for (const t of transforms.slice().reverse()) {
    switch (t.type) {
      case "translate":
        point = point.add([t.x, t.y]);
        break;
      case "rotate":
        point = point
          .sub([t.cx ?? 0, t.cy ?? 0])
          .rotateDeg(t.degrees)
          .add([t.cx ?? 0, t.cy ?? 0]);
        break;
      case "scale":
        point = point.scale([t.x, t.y]);
        break;
    }
  }
  return point;
}

export function globalToLocal(transforms: Transform[], able: Vec2able): Vec2 {
  let point = Vec2(able);
  // Apply inverse transforms in forward order (opposite of localToGlobal)
  for (const t of transforms) {
    switch (t.type) {
      case "translate":
        point = point.sub([t.x, t.y]);
        break;
      case "rotate":
        point = point
          .sub([t.cx ?? 0, t.cy ?? 0])
          .rotateDeg(-t.degrees)
          .add([t.cx ?? 0, t.cy ?? 0]);
        break;
      case "scale":
        point = point.scale([1 / t.x, 1 / t.y]);
        break;
    }
  }
  return point;
}

/**
 * Serializes an array of transform objects back to a string.
 */
export function serializeTransform(transforms: Transform[]): string {
  return transforms
    .map((t) => {
      switch (t.type) {
        case "translate":
          return `translate(${t.x}, ${t.y})`;
        case "rotate":
          return `rotate(${t.degrees}, ${t.cx}, ${t.cy})`;
        case "scale":
          return t.x === t.y ? `scale(${t.x})` : `scale(${t.x}, ${t.y})`;
      }
    })
    .join(" ");
}

/**
 * Interpolates between two transform arrays.
 */
export function lerpTransforms(
  a: Transform[],
  b: Transform[],
  t: number
): Transform[] {
  // Special case: if both are just chains of translations, collapse and lerp
  const aAllTranslate = a.every((t) => t.type === "translate");
  const bAllTranslate = b.every((t) => t.type === "translate");

  if (aAllTranslate && bAllTranslate) {
    const aSum = Vec2(0).add(...a);
    const bSum = Vec2(0).add(...b);
    return [{ type: "translate", ...aSum.lerp(bSum, t).xy() }];
  }

  // Otherwise, lengths and types must match exactly
  if (a.length !== b.length) {
    throw new Error(
      `Cannot lerp transforms with different lengths: ${a.length} vs ${b.length}`
    );
  }

  const result: Transform[] = [];

  for (let i = 0; i < a.length; i++) {
    const ta = a[i];
    const tb = b[i];

    // Types must match
    if (ta.type !== tb.type) {
      throw new Error(
        `Cannot lerp transforms with different types at index ${i}: ${ta.type} vs ${tb.type}`
      );
    }

    switch (ta.type) {
      case "translate":
        assert(tb.type === "translate");
        result.push({
          type: "translate",
          x: lerp(ta.x, tb.x, t),
          y: lerp(ta.y, tb.y, t),
        });
        break;
      case "rotate": {
        assert(tb.type === "rotate");
        result.push({
          type: "rotate",
          degrees: lerpDegrees(ta.degrees, tb.degrees, t),
          cx: lerp(ta.cx, tb.cx, t),
          cy: lerp(ta.cy, tb.cy, t),
        });
        break;
      }
      case "scale":
        assert(tb.type === "scale");
        result.push({
          type: "scale",
          x: lerp(ta.x, tb.x, t),
          y: lerp(ta.y, tb.y, t),
        });
        break;
    }
  }

  return result;
}

function lerpDegrees(a: number, b: number, t: number): number {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return a + delta * t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Lerps between two transform strings.
 */
export function lerpTransformString(a: string, b: string, t: number): string {
  if (!a && !b) return "";

  const transformsA = parseTransform(a);
  const transformsB = parseTransform(b);

  // If one is empty and the other is all translations, treat empty as translate(0,0)
  if (
    transformsA.length === 0 &&
    transformsB.every((t) => t.type === "translate")
  ) {
    const lerpedTransforms = lerpTransforms(
      [{ type: "translate", x: 0, y: 0 }],
      transformsB,
      t
    );
    return serializeTransform(lerpedTransforms);
  }
  if (
    transformsB.length === 0 &&
    transformsA.every((t) => t.type === "translate")
  ) {
    const lerpedTransforms = lerpTransforms(
      transformsA,
      [{ type: "translate", x: 0, y: 0 }],
      t
    );
    return serializeTransform(lerpedTransforms);
  }

  // Otherwise both must be non-empty
  if (!a) return b;
  if (!b) return a;

  const lerpedTransforms = lerpTransforms(transformsA, transformsB, t);

  return serializeTransform(lerpedTransforms);
}
