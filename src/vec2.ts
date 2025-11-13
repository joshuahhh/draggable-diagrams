// mini Vec2 library by Elliot & Josh

export type Vec2 = Vec2Class;

export type Vec2able =
  | Vec2
  | [number, number]
  | readonly [number, number]
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
  } else if (Array.isArray(xOrXY)) {
    return new Vec2Class(xOrXY[0], xOrXY[1]);
  } else {
    // TS doesn't think `readonly [number, number]` passes the
    // Array.isArray check
    return xOrXY as Vec2;
  }
}

class Vec2Class {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  arr(): [number, number] {
    return [this.x, this.y];
  }

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

  dist(v: Vec2able): number {
    v = Vec2(v);
    return this.sub(v).len();
  }

  lerp(v: Vec2able, t: number): Vec2 {
    v = Vec2(v);
    return Vec2(lerp(this.x, v.x, t), lerp(this.y, v.y, t));
  }

  projOnto(v: Vec2able): Vec2 {
    v = Vec2(v);
    const scalar = this.dot(v) / v.len2();
    return v.mul(scalar);
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
