import { Delaunay } from "d3-delaunay";
import _ from "lodash";
import { assert } from "./utils";
import { Vec2 } from "./vec2";

function findTriangle(
  delaunay: Delaunay<Delaunay.Point>,
  pt: Vec2,
  {
    edge = 0,
    // visit = null,
    limit = Infinity,
  } = {},
): number {
  if (isNaN(edge)) return -1;
  // coords is required for delaunator compatibility.
  const { triangles, halfedges, points } = delaunay;

  const getPrev = (e: number) => (e % 3 === 0 ? e + 2 : e - 1);
  const getNext = (e: number) => (e % 3 === 2 ? e - 2 : e + 1);
  let current = edge,
    start = current,
    n = 0;

  while (true) {
    if (limit-- <= 0) return -1;
    // if (visit) visit(current);

    const next = getNext(current);
    const pc = triangles[current] * 2;
    const pn = triangles[next] * 2;
    const o = orientation(
      points[pc],
      points[pc + 1],
      points[pn],
      points[pn + 1],
      pt.x,
      pt.y,
    );

    if (o >= 0) {
      if (start === (current = next)) break;
    } else {
      if (-1 === (current = halfedges[current])) break;
      start = current = ++n % 2 ? getNext(current) : getPrev(current);
    }
  }
  return current > -1 ? Math.floor(current / 3) : -1;
}

// Returns the orientation of three points A, B and C:
//   -1 = counterclockwise
//    0 = collinear
//    1 = clockwise
// More on the topic: http://www.dcs.gla.ac.uk/~pat/52233/slides/Geometry1x1.pdf
function orientation(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) {
  // Determinant of vectors of the line segments AB and BC:
  // [ cx - bx ][ bx - ax ]
  // [ cy - by ][ by - ay ]
  return Math.sign((cx - bx) * (by - ay) - (cy - by) * (bx - ax));
}

function barycentric(pt: Vec2, p0: Vec2, p1: Vec2, p2: Vec2) {
  const x = pt.x;
  const y = pt.y;
  const x0 = p0.x;
  const y0 = p0.y;
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  const l0 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / den;
  const l1 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / den;
  const l2 = 1 - l0 - l1;
  return { l0, l1, l2 };
}

function delaunayCollinearIdxs(delaunay: Delaunay<Delaunay.Point>): number[] {
  return (delaunay as any).collinear;
}

type ConvexHullProjection =
  | { type: "vertex"; ptIdx: number; projectedPt: Vec2; dist: number }
  | {
      type: "edge";
      ptIdx0: number;
      ptIdx1: number;
      t: number;
      projectedPt: Vec2;
      dist: number;
    }
  | {
      type: "triangle";
      ptIdx0: number;
      ptIdx1: number;
      ptIdx2: number;
      barycentric: { l0: number; l1: number; l2: number };
      projectedPt: Vec2;
      dist: number;
    };

export function projectOntoConvexHull(
  delaunay: Delaunay<Delaunay.Point>,
  pt: Vec2,
): ConvexHullProjection {
  const delPt = (idx: number) =>
    Vec2(delaunay.points[2 * idx], delaunay.points[2 * idx + 1]);

  // First check if we're inside the convex hull
  const triIdx = findTriangle(delaunay, pt);
  if (triIdx !== -1 && !delaunayCollinearIdxs(delaunay)) {
    const ptIdx0 = delaunay.triangles[3 * triIdx + 0];
    const ptIdx1 = delaunay.triangles[3 * triIdx + 1];
    const ptIdx2 = delaunay.triangles[3 * triIdx + 2];
    const ptIdxSet = new Set([ptIdx0, ptIdx1, ptIdx2]);
    assert(ptIdxSet.size >= 2);
    if (ptIdxSet.size === 2) {
      // I think this only happens when there are only two points
      // total, like for the 15 puzzle. IDK why it happens at all.
      const [ptIdx0, ptIdx1] = Array.from(ptIdxSet);
      const pt0 = delPt(ptIdx0);
      const pt1 = delPt(ptIdx1);
      const edge = pt1.sub(pt0);
      const edgeLen2 = edge.len2();
      assert(edgeLen2 > 0);
      const t = pt.sub(pt0).dot(edge) / edgeLen2;
      assert(t >= 0 && t <= 1);
      return { type: "edge", ptIdx0, ptIdx1, t, projectedPt: pt, dist: 0 };
    } else {
      return {
        type: "triangle",
        ptIdx0,
        ptIdx1,
        ptIdx2,
        barycentric: barycentric(
          pt,
          delPt(ptIdx0),
          delPt(ptIdx1),
          delPt(ptIdx2),
        ),
        projectedPt: pt,
        dist: 0,
      };
    }
  }

  // Special case: If the points are collinear, delaunay.hull isn't a
  // hull in cyclic order. We use an undocumented d3-delaunay
  // property to make our own hull.
  const collinearIdxs = delaunayCollinearIdxs(delaunay);
  const hull = collinearIdxs
    ? [
        ...collinearIdxs,
        ..._.reverse(collinearIdxs.slice(1, collinearIdxs.length - 1)),
      ]
    : delaunay.hull;
  const points = delaunay.points;

  let bestProjection: ConvexHullProjection | null = null;

  // Check each edge of the convex hull
  for (let i = 0; i < hull.length; i++) {
    const ptIdx0 = hull[i];
    const ptIdx1 = hull[(i + 1) % hull.length];

    const p0 = Vec2(points[2 * ptIdx0], points[2 * ptIdx0 + 1]);
    const p1 = Vec2(points[2 * ptIdx1], points[2 * ptIdx1 + 1]);

    // Project pt onto the line segment from p0 to p1
    const edge = p1.sub(p0);
    const edgeLen2 = edge.len2();

    if (edgeLen2 < 1e-10) {
      // Degenerate edge, treat as vertex
      const dist = pt.dist(p0);
      if (!bestProjection || dist < bestProjection.dist) {
        bestProjection = {
          type: "vertex",
          ptIdx: ptIdx0,
          projectedPt: p0,
          dist,
        };
      }
      continue;
    }

    // Parameter t for projection onto infinite line
    const t = pt.sub(p0).dot(edge) / edgeLen2;

    // Clamp to [0, 1] to stay on the line segment
    const tClamped = Math.max(0, Math.min(1, t));

    // Closest point on the edge
    const closestPt = p0.lerp(p1, tClamped);
    const dist = pt.dist(closestPt);

    if (!bestProjection || dist < bestProjection.dist) {
      // Check if we're at a vertex or along the edge
      if (tClamped < 1e-6) {
        bestProjection = {
          type: "vertex",
          ptIdx: ptIdx0,
          projectedPt: p0,
          dist,
        };
      } else if (tClamped > 1 - 1e-6) {
        bestProjection = {
          type: "vertex",
          ptIdx: ptIdx1,
          projectedPt: p1,
          dist,
        };
      } else {
        bestProjection = {
          type: "edge",
          ptIdx0,
          ptIdx1,
          t: tClamped,
          projectedPt: closestPt,
          dist,
        };
      }
    }
  }

  return bestProjection!;
}
