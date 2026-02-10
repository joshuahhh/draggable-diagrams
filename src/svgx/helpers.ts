import { Vec2, Vec2able } from "../math/vec2";

export function translate(v: Vec2able): string;
export function translate(x: number, y: number): string;
export function translate(a: Vec2able | number, b?: number): string {
  const [x, y] = b !== undefined ? [a, b] : Vec2(a).arr();
  return `translate(${x},${y}) `; // end in space
}

export function rotateDeg(degrees: number, c: Vec2able = Vec2(0)): string {
  const [cx, cy] = Vec2(c).arr();
  return `rotate(${degrees},${cx},${cy}) `; // end in space
}

export function rotateRad(radians: number, c: Vec2able = Vec2(0)): string {
  return rotateDeg((radians * 180) / Math.PI, c);
}

export function scale(sx: number, sy?: number): string {
  if (sy === undefined) sy = sx;
  return `scale(${sx},${sy}) `; // end in space
}

export function path(...pts: (Vec2able | string | number)[]): string {
  return pts
    .map((pt) =>
      typeof pt === "string"
        ? pt
        : typeof pt === "number"
          ? pt.toString()
          : Vec2(pt).str(),
    )
    .join(" ");
}
