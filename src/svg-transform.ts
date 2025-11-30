/**
 * Parses and interpolates SVG transform strings.
 */

export type Transform =
  | { type: "translate"; x: number; y: number }
  | { type: "rotate"; angle: number; cx?: number; cy?: number }
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
    const args = match[2].split(/[\s,]+/).map(s => parseFloat(s.trim()));

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
          angle: args[0] || 0,
          cx: args[1],
          cy: args[2],
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
          if (t.cx !== undefined && t.cy !== undefined) {
            return `rotate(${t.angle}, ${t.cx}, ${t.cy})`;
          }
          return `rotate(${t.angle})`;
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
    const aSum = a.reduce(
      (acc, t) => ({
        x: acc.x + (t as any).x,
        y: acc.y + (t as any).y,
      }),
      { x: 0, y: 0 }
    );
    const bSum = b.reduce(
      (acc, t) => ({
        x: acc.x + (t as any).x,
        y: acc.y + (t as any).y,
      }),
      { x: 0, y: 0 }
    );

    return [
      {
        type: "translate",
        x: lerp(aSum.x, bSum.x, t),
        y: lerp(aSum.y, bSum.y, t),
      },
    ];
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
        result.push({
          type: "translate",
          x: lerp((ta as any).x, (tb as any).x, t),
          y: lerp((ta as any).y, (tb as any).y, t),
        });
        break;
      case "rotate":
        result.push({
          type: "rotate",
          angle: lerp((ta as any).angle, (tb as any).angle, t),
          cx: (ta as any).cx !== undefined ? lerp((ta as any).cx, (tb as any).cx, t) : undefined,
          cy: (ta as any).cy !== undefined ? lerp((ta as any).cy, (tb as any).cy, t) : undefined,
        });
        break;
      case "scale":
        result.push({
          type: "scale",
          x: lerp((ta as any).x, (tb as any).x, t),
          y: lerp((ta as any).y, (tb as any).y, t),
        });
        break;
    }
  }

  return result;
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
  if (transformsA.length === 0 && transformsB.every((t) => t.type === "translate")) {
    const lerpedTransforms = lerpTransforms([{ type: "translate", x: 0, y: 0 }], transformsB, t);
    return serializeTransform(lerpedTransforms);
  }
  if (transformsB.length === 0 && transformsA.every((t) => t.type === "translate")) {
    const lerpedTransforms = lerpTransforms(transformsA, [{ type: "translate", x: 0, y: 0 }], t);
    return serializeTransform(lerpedTransforms);
  }

  // Otherwise both must be non-empty
  if (!a) return b;
  if (!b) return a;

  const lerpedTransforms = lerpTransforms(transformsA, transformsB, t);

  return serializeTransform(lerpedTransforms);
}
