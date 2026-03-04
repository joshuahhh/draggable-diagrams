import { produce } from "immer";
import _ from "lodash";
import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { DragSpec, DragSpecBuilder, param } from "../DragSpec";
import { Vec2 } from "../math/vec2";
import { rotateDeg, translate } from "../svgx/helpers";
import { makeId } from "../utils";

// --- Shape geometry ---

type ShapeKind = "square" | "triangle" | "hexagon" | "octagon";

const SIDE = 50;
const HALF = SIDE / 2;
const TRI_H = (SIDE * Math.sqrt(3)) / 2;

/** Regular polygon with `n` sides of length `SIDE`, centered at origin. */
function regularPolygonVertices(n: number): Vec2[] {
  // Circumradius from side length: R = SIDE / (2 * sin(π/n))
  const R = SIDE / (2 * Math.sin(Math.PI / n));
  // Start from top (-90°) so the bottom edge is flat
  return Array.from({ length: n }, (_, i) =>
    Vec2.polarDeg(R, -90 + (360 * i) / n),
  );
}

// Vertices relative to center, at rotation=0
function shapeVertices(kind: ShapeKind): Vec2[] {
  switch (kind) {
    case "square":
      return [
        Vec2(-HALF, -HALF),
        Vec2(HALF, -HALF),
        Vec2(HALF, HALF),
        Vec2(-HALF, HALF),
      ];
    case "triangle": {
      const cy = TRI_H / 3; // centroid is 1/3 from base
      return [Vec2(0, -(TRI_H - cy)), Vec2(HALF, cy), Vec2(-HALF, cy)];
    }
    case "hexagon":
      return regularPolygonVertices(6);
    case "octagon":
      return regularPolygonVertices(8);
  }
}

function shapePoints(kind: ShapeKind): string {
  return shapeVertices(kind)
    .map((v) => v.str(" "))
    .join(" ");
}

// --- Edge representation for snapping ---

type Edge = { a: Vec2; b: Vec2 };

/** Get edges of a shape in world space (after position + rotation) */
function worldEdges(kind: ShapeKind, pos: Vec2, rotDeg: number): Edge[] {
  const verts = shapeVertices(kind).map((v) => v.rotateDeg(rotDeg).add(pos));
  return verts.map((v, i) => ({ a: v, b: verts[(i + 1) % verts.length] }));
}

function edgeMidpoint(e: Edge): Vec2 {
  return e.a.mid(e.b);
}

function edgeLength(e: Edge): number {
  return e.a.dist(e.b);
}

function edgeDir(e: Edge): Vec2 {
  return e.b.sub(e.a).norm();
}

// --- Snap computation ---

type Snap = {
  pos: Vec2;
  rotDeg: number;
};

const OVERLAP_EPSILON = 2; // pixels of overlap tolerance for tessellation

/**
 * Check if a shape at a given pos/rot overlaps any existing shape.
 * Uses a simple center-distance check against all vertices.
 */
function overlapsAny(
  kind: ShapeKind,
  pos: Vec2,
  rotDeg: number,
  shapes: Shape[],
  excludeId?: string,
): boolean {
  const newVerts = shapeVertices(kind).map((v) => v.rotateDeg(rotDeg).add(pos));
  for (const s of shapes) {
    if (s.id === excludeId) continue;
    const existingVerts = shapeVertices(s.kind).map((v) =>
      v.rotateDeg(s.rotDeg).add(Vec2(s.x, s.y)),
    );
    // SAT-lite: check if polygons overlap using vertex-in-polygon
    if (polygonsOverlap(newVerts, existingVerts, OVERLAP_EPSILON)) return true;
  }
  return false;
}

/** Rough overlap check: do any vertices of A lie well inside B or vice versa? */
function polygonsOverlap(
  vertsA: Vec2[],
  vertsB: Vec2[],
  epsilon: number,
): boolean {
  // Use separating axis theorem for convex polygons
  const axes = [...getAxes(vertsA), ...getAxes(vertsB)];
  for (const axis of axes) {
    const [minA, maxA] = project(vertsA, axis);
    const [minB, maxB] = project(vertsB, axis);
    // If there's a gap (accounting for epsilon), no overlap on this axis
    if (maxA - epsilon <= minB || maxB - epsilon <= minA) return false;
  }
  return true;
}

function getAxes(verts: Vec2[]): Vec2[] {
  return verts.map((v, i) => {
    const next = verts[(i + 1) % verts.length];
    const edge = next.sub(v);
    return Vec2(-edge.y, edge.x).norm(); // perpendicular
  });
}

function project(verts: Vec2[], axis: Vec2): [number, number] {
  const dots = verts.map((v) => v.dot(axis));
  return [Math.min(...dots), Math.max(...dots)];
}

/**
 * Compute all valid edge-to-edge snaps for placing `kind` against
 * existing shapes. Two edges snap when they share the same length
 * and can be aligned flush (reversed direction).
 */
function computeSnaps(
  kind: ShapeKind,
  shapes: Shape[],
  excludeId?: string,
): Snap[] {
  const snaps: Snap[] = [];
  const newEdgesAtZero = worldEdges(kind, Vec2(0), 0);

  for (const s of shapes) {
    if (s.id === excludeId) continue;
    const existingEdges = worldEdges(s.kind, Vec2(s.x, s.y), s.rotDeg);

    for (const existingEdge of existingEdges) {
      const eLen = edgeLength(existingEdge);
      const existDir = edgeDir(existingEdge);
      const targetDir = existDir.mul(-1);
      const targetAngleRad = targetDir.angleRad();

      // Pick the new edge closest in angle (least rotation needed)
      const compatible = newEdgesAtZero.filter(
        (e) => Math.abs(edgeLength(e) - eLen) <= 0.1,
      );
      if (compatible.length === 0) continue;

      const normalizeAngle = (r: number) => {
        r = ((r + Math.PI) % (2 * Math.PI)) - Math.PI;
        return r < -Math.PI ? r + 2 * Math.PI : r;
      };
      const rotRadFor = (e: Edge) =>
        normalizeAngle(targetAngleRad - edgeDir(e).angleRad());

      const bestNewEdge = _.minBy(compatible, (e) => Math.abs(rotRadFor(e)))!;
      const bestRotRad = rotRadFor(bestNewEdge);
      const rotDeg = (bestRotRad * 180) / Math.PI;

      // After rotating the new shape, compute where its center needs to be
      // so that the new edge's midpoint matches the existing edge's midpoint
      const newEdgeRotated = {
        a: bestNewEdge.a.rotateRad(bestRotRad),
        b: bestNewEdge.b.rotateRad(bestRotRad),
      };
      const newMid = edgeMidpoint(newEdgeRotated);
      const existMid = edgeMidpoint(existingEdge);
      const pos = existMid.sub(newMid);

      // Normalize rotation to [0, 360)
      const normRot = ((rotDeg % 360) + 360) % 360;

      // Check it doesn't overlap existing shapes
      if (!overlapsAny(kind, pos, normRot, shapes, excludeId)) {
        snaps.push({ pos, rotDeg: normRot });
      }
    }
  }

  return snaps;
}

// --- State ---

type Shape = {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  rotDeg: number;
};

type State = {
  shapes: Record<string, Shape>;
};

// Palette items (in palette space, not on canvas)
const PALETTE_ITEMS: { kind: ShapeKind; x: number; y: number }[] = [
  { kind: "square", x: 50, y: 75 },
  { kind: "triangle", x: 140, y: 75 },
  { kind: "hexagon", x: 245, y: 75 },
  { kind: "octagon", x: 370, y: 75 },
];

const initialState: State = { shapes: {} };

// --- Palette rendering ---

const PALETTE_W = 480;
const PALETTE_H = 150;

const SHAPE_COLORS: Record<ShapeKind, string> = {
  square: "#93c5fd",
  triangle: "#fca5a5",
  hexagon: "#86efac",
  octagon: "#fde68a",
};

const SHAPE_STROKES: Record<ShapeKind, string> = {
  square: "#3b82f6",
  triangle: "#ef4444",
  hexagon: "#16a34a",
  octagon: "#ca8a04",
};

// --- The draggable ---

const SNAP_RADIUS = 30;

/** Build a snap-or-free-drag spec for a shape in a given state. */
function shapeSpec(
  d: DragSpecBuilder<State>,
  st: State,
  shapeId: string,
): DragSpec<State> {
  const shape = st.shapes[shapeId];
  const shapesArr = Object.values(st.shapes);
  const snaps = computeSnaps(shape.kind, shapesArr, shapeId);

  const snapStates = snaps.map((snap) =>
    produce(st, (draft) => {
      draft.shapes[shapeId].x = snap.pos.x;
      draft.shapes[shapeId].y = snap.pos.y;
      draft.shapes[shapeId].rotDeg = snap.rotDeg;
    }),
  );

  const freeSpec = d.vary(st, [
    param("shapes", shapeId, "x"),
    param("shapes", shapeId, "y"),
  ]);

  const snapOrFree =
    snapStates.length > 0
      ? d.closest(snapStates).withSnapRadius(SNAP_RADIUS).whenFar(freeSpec)
      : freeSpec;

  const stateWithout = produce(st, (draft) => {
    delete draft.shapes[shapeId];
  });

  return d
    .closest([snapOrFree, d.dropTarget(stateWithout, "trash-bin")])
    .withInitContext((ctx) => ({ ...ctx, pointerLocal: Vec2(0) }));
}

const draggable: Draggable<State> = ({ state, d, draggedId }) => {
  const shapesArr = Object.values(state.shapes);

  return (
    <g>
      {/* Canvas shapes */}
      {shapesArr.map((shape) => {
        const isDragged = draggedId === `shape-${shape.id}`;

        return (
          <g
            id={`shape-${shape.id}`}
            transform={translate(shape.x, shape.y) + rotateDeg(shape.rotDeg)}
            data-z-index={isDragged ? 10 : 1}
            dragology={() => shapeSpec(d, state, shape.id)}
          >
            <polygon
              points={shapePoints(shape.kind)}
              fill={SHAPE_COLORS[shape.kind]}
              stroke={SHAPE_STROKES[shape.kind]}
              strokeWidth={2}
            />
          </g>
        );
      })}

      {/* Trash bin */}
      <g id="trash-bin" transform={translate(530, 380)}>
        <rect
          width={50}
          height={50}
          fill="#fee"
          stroke="#999"
          strokeWidth={2}
          strokeDasharray="4,4"
          rx={4}
        />
        <text
          x={25}
          y={25}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={28}
          pointerEvents="none"
        >
          {"\u{1F5D1}"}
        </text>
      </g>

      {/* Palette background */}
      <g id="palette-bg" data-z-index={0}>
        <rect
          width={PALETTE_W}
          height={PALETTE_H}
          rx={8}
          fill="#f3f4f6"
          stroke="#d1d5db"
          strokeWidth={1.5}
        />
        <text
          x={PALETTE_W / 2}
          y={12}
          textAnchor="middle"
          fontSize={10}
          fill="#999"
        >
          drag to add
        </text>
      </g>

      {/* Palette items */}
      <g id="palette" data-z-index={20}>
        {PALETTE_ITEMS.map((item, i) => {
          const newId = makeId();
          const newShape: Shape = {
            id: newId,
            kind: item.kind,
            x: 0,
            y: 0,
            rotDeg: 0,
          };
          const stateWithNew = produce(state, (draft) => {
            draft.shapes[newId] = newShape;
          });

          return (
            <g
              id={`palette-${i}`}
              transform={translate(item.x, item.y)}
              data-z-index={21}
              dragology={() =>
                d.switchToStateAndFollow(stateWithNew, `shape-${newId}`)
              }
            >
              <polygon
                points={shapePoints(item.kind)}
                fill={SHAPE_COLORS[item.kind]}
                stroke={SHAPE_STROKES[item.kind]}
                strokeWidth={2}
                opacity={0.8}
              />
            </g>
          );
        })}
      </g>
    </g>
  );
};

export default demo(
  () => (
    <div>
      <DemoDraggable
        draggable={draggable}
        initialState={initialState}
        width={600}
        height={450}
      />
    </div>
  ),
  {
    tags: [
      "d.closest",
      "d.vary",
      "d.switchToStateAndFollow",
      "spec.withSnapRadius",
      "spec.whenFar",
      "discrete on top of continuous",
    ],
  },
);
