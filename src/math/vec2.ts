// mini Vec2 library by Elliot & Josh

export type Vec2 = Vec2Class;

export type Vec2able =
  | Vec2
  | [number, number, ...any]
  | readonly [number, number]
  | { x: number; y: number }
  | number;

export function Vec2(xy: Vec2able): Vec2;
export function Vec2(x: number, y: number): Vec2;
export function Vec2(xOrXY: number | Vec2able, y?: number): Vec2 {
  if (typeof xOrXY === "number") {
    if (y === undefined) {
      return new Vec2Class(xOrXY, xOrXY);
    } else {
      return new Vec2Class(xOrXY, y);
    }
  } else if (typeof xOrXY === "object" && "x" in xOrXY && "y" in xOrXY) {
    return new Vec2Class(xOrXY.x, xOrXY.y);
  } else if (Array.isArray(xOrXY)) {
    return new Vec2Class(xOrXY[0], xOrXY[1]);
  } else {
    // TS doesn't think `readonly [number, number]` passes the
    // Array.isArray check
    return xOrXY as any as Vec2Class;
  }
}

class Vec2Class {
  constructor(readonly x: number, readonly y: number) {}

  // # extraction

  arr(): [number, number] {
    return [this.x, this.y];
  }

  str(sep = ","): string {
    return `${this.x}${sep}${this.y}`;
  }

  xy(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  xy1(): { x1: number; y1: number } {
    return { x1: this.x, y1: this.y };
  }

  xy2(): { x2: number; y2: number } {
    return { x2: this.x, y2: this.y };
  }

  cxy(): { cx: number; cy: number } {
    return { cx: this.x, cy: this.y };
  }

  // # operations

  eq(v: Vec2able): boolean {
    v = Vec2(v);
    return this.x === v.x && this.y === v.y;
  }

  add(v: Vec2able): Vec2 {
    v = Vec2(v);
    return Vec2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vec2able): Vec2 {
    v = Vec2(v);
    return Vec2(this.x - v.x, this.y - v.y);
  }

  mul(n: number): Vec2 {
    return Vec2(this.x * n, this.y * n);
  }

  div(n: number): Vec2 {
    return Vec2(this.x / n, this.y / n);
  }

  scale(v: Vec2able): Vec2 {
    v = Vec2(v);
    return Vec2(this.x * v.x, this.y * v.y);
  }

  dot(v: Vec2able): number {
    v = Vec2(v);
    return this.x * v.x + this.y * v.y;
  }

  cross(v: Vec2able): number {
    v = Vec2(v);
    return this.x * v.y - this.y * v.x;
  }

  len2(): number {
    return this.dot(this);
  }

  len(): number {
    return Math.sqrt(this.len2());
  }

  norm(): Vec2 {
    return this.div(this.len());
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  angleTo(v: Vec2able): number {
    v = Vec2(v);
    return Math.atan2(v.y - this.y, v.x - this.x);
  }

  dist2(v: Vec2able): number {
    v = Vec2(v);
    return this.sub(v).len2();
  }

  dist(v: Vec2able): number {
    v = Vec2(v);
    return this.sub(v).len();
  }

  lerp(v: Vec2able, t: number): Vec2 {
    v = Vec2(v);
    return Vec2(lerp(this.x, v.x, t), lerp(this.y, v.y, t));
  }

  projOnto(v: Vec2able): Vec2 {
    // TODO weird that we need a new variable here to make TS happy
    const v2 = Vec2(v);
    const scalar = this.dot(v2) / v2.len2();
    return v2.mul(scalar);
  }

  towards(v: Vec2able, d: number): Vec2 {
    // TODO weird that we need a new variable here to make TS happy
    const v2 = Vec2(v);
    return this.add(v2.sub(this).norm().mul(d));
  }

  rotate(angleRad: number): Vec2 {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    return Vec2(this.x * cosA - this.y * sinA, this.x * sinA + this.y * cosA);
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
