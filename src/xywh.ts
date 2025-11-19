import { Vec2 } from "./vec2";

export type XYWH = readonly [number, number, number, number];

export const XYWH = (x: number, y: number, w: number, h: number): XYWH => {
  if (w < 0) {
    x -= w;
    w = -w;
  }
  if (h < 0) {
    y -= h;
    h = -h;
  }
  return [x, y, w, h];
};

export const inXYWH = (t: Vec2, [x, y, w, h]: XYWH) => {
  return x <= t.x && t.x <= x + w && y <= t.y && t.y <= y + h;
};

export const fromCenter = (center: Vec2, w: number, h: number): XYWH => {
  return XYWH(center.x - w / 2, center.y - h / 2, w, h);
};

export const translateXYWH = (xywh: XYWH, v: Vec2): XYWH => {
  return XYWH(xywh[0] + v.x, xywh[1] + v.y, xywh[2], xywh[3]);
};

export const merge = (a: XYWH | null, b: XYWH | null): XYWH | null => {
  if (a === null) return b;
  if (b === null) return a;
  const x1 = Math.min(a[0], b[0]);
  const y1 = Math.min(a[1], b[1]);
  const x2 = Math.max(a[0] + a[2], b[0] + b[2]);
  const y2 = Math.max(a[1] + a[3], b[1] + b[3]);
  return XYWH(x1, y1, x2 - x1, y2 - y1);
};

export const mergeMany = (xywhs: (XYWH | null)[]): XYWH | null => {
  return xywhs.reduce((acc, xywh) => merge(acc, xywh), null);
};

export const tl = (xywh: XYWH): Vec2 => Vec2(xywh[0], xywh[1]);
export const tr = (xywh: XYWH): Vec2 => Vec2(xywh[0] + xywh[2], xywh[1]);
export const bl = (xywh: XYWH): Vec2 => Vec2(xywh[0], xywh[1] + xywh[3]);
export const br = (xywh: XYWH): Vec2 =>
  Vec2(xywh[0] + xywh[2], xywh[1] + xywh[3]);
export const tm = (xywh: XYWH): Vec2 => Vec2(xywh[0] + xywh[2] / 2, xywh[1]);
export const bm = (xywh: XYWH): Vec2 =>
  Vec2(xywh[0] + xywh[2] / 2, xywh[1] + xywh[3]);
export const ml = (xywh: XYWH): Vec2 => Vec2(xywh[0], xywh[1] + xywh[3] / 2);
export const mr = (xywh: XYWH): Vec2 =>
  Vec2(xywh[0] + xywh[2], xywh[1] + xywh[3] / 2);
export const mm = (xywh: XYWH): Vec2 =>
  Vec2(xywh[0] + xywh[2] / 2, xywh[1] + xywh[3] / 2);

export const expand = (xywh: XYWH, dx: number, dy?: number): XYWH => {
  if (dy === undefined) dy = dx;
  return [xywh[0] - dx, xywh[1] - dy, xywh[2] + 2 * dx, xywh[3] + 2 * dy];
};
