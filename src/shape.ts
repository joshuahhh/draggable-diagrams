import * as d3 from "d3-shape";
import _ from "lodash";
import { Layer } from "./layer";
import { IPointerManager } from "./pointer";
import { assert, assertNever } from "./utils";
import { lerp, Vec2 } from "./vec2";
import { fromCenter, inXYWH, mergeMany, mm, translate, XYWH } from "./xywh";

// Coordinates statement: Offsets are relative. PointInShape is nice.
// The only tricky part is that when we drawFlatShapes, we interact
// with the pointer system, and that's global. That's why you pass
// `globalOffset` into drawFlatShapes.

export type Shape =
  | {
      type: "circle";
      center: Vec2;
      radius: number;
      fillStyle: string;
      nodeId?: string;
    }
  | {
      type: "line";
      from: Vec2;
      to: Vec2;
      strokeStyle: string;
      lineWidth: number;
    }
  | {
      type: "curve";
      points: Vec2[];
      strokeStyle: string;
      lineWidth: number;
    }
  | {
      type: "rectangle";
      xywh: XYWH;
      fillStyle?: string;
      strokeStyle?: string;
      lineWidth?: number;
      label?: string;
    }
  | {
      type: "group";
      shapes: Shape[];
    }
  | {
      type: "keyed-group";
      shapes: Record<string, Shape>;
    }
  | {
      type: "lazy";
      state:
        | {
            hasRun: false;
            getShape: (resolveHere: (pis: PointInShape) => Vec2) => Shape;
          }
        | { hasRun: true; shape: Shape };
    }
  | {
      type: "transform";
      shape: Shape;
      offset: Vec2;
    }
  | {
      type: "keyed";
      shape: Shape;
      key: string;
      isDraggable: boolean;
    }
  | {
      type: "z-index";
      shape: Shape;
      zIndex: number;
    };

export type Group = Extract<Shape, { type: "group" }>;
export function group(debugName?: string, shapes: Shape[] = []): Group {
  return { ...(debugName && { debugName }), type: "group", shapes };
}

export type KeyedGroup = Extract<Shape, { type: "keyed-group" }>;
export function keyedGroup(shapes: Record<string, Shape> = {}): KeyedGroup {
  return { type: "keyed-group", shapes };
}

export type Transform = Extract<Shape, { type: "transform" }>;
export function transform(offset: Vec2, shape: Shape): Transform {
  return { type: "transform", shape, offset };
}

export type Lazy = Extract<Shape, { type: "lazy" }>;
export function lazy(
  getShape: (Lazy["state"] & { hasRun: false })["getShape"],
): Lazy {
  return { type: "lazy", state: { hasRun: false, getShape } };
}

export type Keyed = Extract<Shape, { type: "keyed" }>;
export function keyed(key: string, isDraggable: boolean, shape: Shape): Keyed {
  return { type: "keyed", key, shape, isDraggable };
}

export type ZIndex = Extract<Shape, { type: "z-index" }>;
export function zIndex(zIndex: number, shape: Shape): ZIndex {
  return { type: "z-index", shape, zIndex };
}

// this is just a way of tagging that we've run the shape through
// origToInterpolatable
export type InterpolatableShape = Shape & { interpolatable: true };

/** Returns all children of a shape. */
export function shapeChildren(
  shape: Shape,
  okIfLazyHasNotRun: boolean,
): Shape[] {
  switch (shape.type) {
    case "group":
      return shape.shapes;
    case "keyed-group":
      return Object.values(shape.shapes);
    case "transform":
      return [shape.shape];
    case "keyed":
      return [shape.shape];
    case "z-index":
      return [shape.shape];
    case "lazy":
      if (shape.state.hasRun) {
        return [shape.state.shape];
      } else {
        if (okIfLazyHasNotRun) {
          return [];
        } else {
          throw new Error("Cannot get children of lazy shape that hasn't run");
        }
      }
    case "circle":
      return [];
    case "line":
      return [];
    case "curve":
      return [];
    case "rectangle":
      return [];
    default:
      assertNever(shape);
  }
}

export function makeParentMap(shape: Shape): Map<Shape, Shape> {
  const map = new Map<Shape, Shape>();
  function helper(s: Shape, parent: Shape | null) {
    if (parent) {
      map.set(s, parent);
    }
    for (const child of shapeChildren(s, true)) {
      helper(child, s);
    }
  }
  helper(shape, null);
  return map;
}

export function makeOffsetMap(shape: Shape, offset: Vec2): Map<Shape, Vec2> {
  const map = new Map<Shape, Vec2>();
  function helper(s: Shape, offset: Vec2) {
    if (s.type === "transform") {
      offset = offset.add(s.offset);
    }
    map.set(s, offset);
    for (const child of shapeChildren(s, true)) {
      helper(child, offset);
    }
  }
  helper(shape, offset);
  return map;
}

export function runLazyShapes(
  shape: Shape,
  offsetMap: Map<Shape, Vec2>,
): Shape {
  if (shape.type === "lazy" && !shape.state.hasRun) {
    const newShape = shape.state.getShape((pis) =>
      resolvePointInShape(pis, shape, offsetMap),
    );
    shape.state = { hasRun: true, shape: newShape };
  }
  for (const child of shapeChildren(shape, false)) {
    runLazyShapes(child, offsetMap);
  }
  return shape;
}

export function pullOutKeyedShapes(shape: Shape): Shape {
  const kg = keyedGroup();
  function helper(s: Shape, offset: Vec2) {
    if (s.type === "keyed") {
      kg.shapes[s.key] = transform(offset, { ...s });
      // TODO: hack
      for (const key in s) {
        delete (s as any)[key];
      }
      Object.assign(s, { type: "group", shapes: [] });
    }
    if (s.type === "transform") {
      offset = offset.add(s.offset);
    }
    for (const child of shapeChildren(s, true)) {
      helper(child, offset);
    }
  }
  helper(shape, Vec2(0));
  return group(`pulling out keyed shapes`, [shape, kg]);
}

export type PointInShape = {
  __shape: Shape;
  __point: Vec2;
};

export function pointInShape(shape: Shape, localPoint: Vec2): PointInShape {
  return { __shape: shape, __point: localPoint };
}

// export function shapeOffset(shape: Shape): Vec2 {
//   if (shape.type === "group") {
//     return shape.offset ?? Vec2(0);
//   }
//   return Vec2(0);
// }

export function resolvePointInShape(
  pis: PointInShape,
  dstShape: Shape,
  offsetMap: Map<Shape, Vec2>,
): Vec2 {
  let { __shape: srcShape, __point: point } = pis;
  const srcOffset = offsetMap.get(srcShape);
  assert(!!srcOffset, "Source shape must have offset in offset map");
  const dstOffset = offsetMap.get(dstShape);
  assert(!!dstOffset, "Destination shape must have offset in offset map");
  return point.add(srcOffset!).sub(dstOffset!);

  // console.log("resolving point", pis, "in", dstShape);

  // while (true) {
  //   if (srcShape === dstShape) {
  //     return point;
  //   }
  //   if (srcShape.type === "transform") {
  //     point = point.add(srcShape.offset);
  //   }
  //   const parent = parentMap.get(srcShape);
  //   if (!parent) {
  //     throw new Error("Point's group is not a descendant of target group");
  //   }
  //   srcShape = parent;
  // }
}

type DrawShapeContext = {
  pointer: IPointerManager;
  onDragStart: (draggableKey: string, pointerOffset: Vec2) => void;
};

export type FlatShape =
  | (Extract<Shape, { type: "circle" | "line" | "curve" | "rectangle" }> & {
      zIndex: number;
    })
  | { type: "draggable-target"; key: string; bbox: XYWH; origin: Vec2 };

export function flattenShape(
  shape: Shape,
  offset: Vec2,
  zIndex: number,
): { flatShapes: FlatShape[]; bbox: XYWH | null } {
  // console.group("flattenShape", shape, offset, zIndex);
  try {
    switch (shape.type) {
      case "circle":
        return {
          flatShapes: [
            {
              type: "circle",
              center: shape.center.add(offset),
              radius: shape.radius,
              fillStyle: shape.fillStyle,
              nodeId: shape.nodeId,
              zIndex,
            },
          ],
          bbox: fromCenter(
            shape.center.add(offset),
            shape.radius * 2,
            shape.radius * 2,
          ),
        };
      case "line":
        return {
          flatShapes: [
            {
              type: "line",
              from: shape.from.add(offset),
              to: shape.to.add(offset),
              strokeStyle: shape.strokeStyle,
              lineWidth: shape.lineWidth,
              zIndex,
            },
          ],
          bbox: null, // TODO: i'm too lazy to compute line bbox
        };
      case "curve":
        return {
          flatShapes: [
            {
              type: "curve",
              points: shape.points.map((p) => p.add(offset)),
              strokeStyle: shape.strokeStyle,
              lineWidth: shape.lineWidth,
              zIndex,
            },
          ],
          bbox: null, // TODO: i'm too lazy to compute curve bbox
        };
      case "rectangle":
        return {
          flatShapes: [
            {
              ...shape,
              xywh: translate(shape.xywh, offset),
              zIndex,
            },
          ],
          bbox: translate(shape.xywh, offset),
        };
      case "group": {
        const results = shape.shapes.map((s) =>
          flattenShape(s, offset, zIndex),
        );
        return {
          flatShapes: results.flatMap((r) => r.flatShapes),
          bbox: mergeMany(results.map((r) => r.bbox)),
        };
      }
      case "keyed-group": {
        const results = Object.values(shape.shapes).map((s) =>
          flattenShape(s, offset, zIndex),
        );
        return {
          flatShapes: results.flatMap((r) => r.flatShapes),
          bbox: mergeMany(results.map((r) => r.bbox)),
        };
      }
      case "transform":
        return flattenShape(shape.shape, offset.add(shape.offset), zIndex);
      case "keyed":
        const result = flattenShape(shape.shape, offset, zIndex);
        return {
          flatShapes: [
            ...result.flatShapes,
            ...(shape.isDraggable
              ? [
                  {
                    type: "draggable-target" as const,
                    key: shape.key,
                    bbox: result.bbox!,
                    origin: offset,
                  },
                ]
              : []),
          ],
          bbox: result.bbox,
        };
      case "z-index":
        return flattenShape(shape.shape, offset, shape.zIndex);
      case "lazy":
        assert(shape.state.hasRun);
        return flattenShape(shape.state.shape, offset, zIndex);
      default:
        return assertNever(shape);
    }
  } finally {
    // console.groupEnd();
  }
}

// /** Returns a bounding box in global coordinates */
// export function drawShape(
//   /** Layer to draw on. We assume drawShape is called without
//    * transformations applied to lyr. */
//   lyr: Layer,
//   shape: Shape,
//   /** The offset vector that defines the relationship between local
//    * coordinates and global coordinates – global = local + offset. */
//   offset: Vec2,
//   ctx: DrawShapeContext,
// ): XYWH | null {
//   switch (shape.type) {
//     case "circle": {
//       const newCenter = shape.center.add(offset);
//       lyr.do(() => {
//         lyr.fillStyle = shape.fillStyle;
//         lyr.beginPath();
//         lyr.arc(...newCenter.arr(), shape.radius, 0, Math.PI * 2);
//         lyr.fill();
//       });
//       return fromCenter(newCenter, shape.radius * 2, shape.radius * 2);
//     }
//     case "line": {
//       lyr.do(() => {
//         lyr.strokeStyle = shape.strokeStyle;
//         lyr.lineWidth = shape.lineWidth;
//         lyr.beginPath();
//         lyr.moveTo(...shape.from.add(offset).arr());
//         lyr.lineTo(...shape.to.add(offset).arr());
//         lyr.stroke();
//       });
//       return null; // lines have no bounding box
//     }
//     case "curve": {
//       lyr.do(() => {
//         lyr.strokeStyle = shape.strokeStyle;
//         lyr.lineWidth = shape.lineWidth;
//         const curve = d3.curveCardinal(lyr);
//         lyr.beginPath();
//         curve.lineStart();
//         for (const pt of shape.points) {
//           curve.point(...pt.add(offset).arr());
//         }
//         curve.lineEnd();
//         lyr.stroke();
//       });
//       return null; // curves have no bounding box
//     }
//     case "group": {
//       let bbox: XYWH | null = null;
//       for (const child of shape.shapes) {
//         const childBbox = drawShape(lyr, child, offset, ctx);
//         bbox = merge(bbox, childBbox);
//       }
//       return bbox;
//     }
//     case "keyed-group": {
//       let bbox: XYWH | null = null;
//       for (const key of Object.keys(shape.shapes)) {
//         const childBbox = drawShape(lyr, shape.shapes[key], offset, ctx);
//         bbox = merge(bbox, childBbox);
//       }
//       return bbox;
//     }
//     case "keyed": {
//       const bbox = drawShape(lyr, shape.shape, offset, ctx);
//       if (shape.isDraggable && bbox) {
//         if (inXYWH(...ctx.pointer.hoverPointer.arr(), bbox)) {
//           ctx.pointer.setCursor("grab");
//         }
//         // console.log("adding click handler for draggable", bbox);
//         ctx.pointer.addClickHandler(bbox, () => {
//           // this is the pointer position in the group's inner coordinates
//           const pointerLocal = ctx.pointer.dragPointer!.sub(offset);
//           ctx.onDragStart(shape.key, pointerLocal);
//         });
//       }
//       return bbox;
//     }
//     case "transform": {
//       const bbox = drawShape(lyr, shape.shape, offset.add(shape.offset), ctx);
//       return bbox && translate(bbox, shape.offset);
//     }
//     case "z-index": {
//       return drawShape(lyr, shape.shape, offset, ctx);
//     }
//     case "lazy": {
//       assert(shape.state.hasRun, "Cannot draw lazy shape that has not run yet");
//       return drawShape(lyr, shape.state.shape, offset, ctx);
//     }
//     default: {
//       assertNever(shape);
//     }
//   }
// }

/** Returns a bounding box in global coordinates */
export function drawFlatShapes(
  /** Layer to draw on. We assume drawShape is called without
   * transformations applied to lyr. */
  lyr: Layer,
  flatShapes: FlatShape[],
  ctx?: DrawShapeContext,
): void {
  // first sort by z-index
  const [draggableTargets, drawableShapes] = _.partition(
    flatShapes,
    (s) => s.type === "draggable-target",
  );
  const sortedDrawableShapes = _.sortBy(drawableShapes, (s) => s.zIndex);

  for (const shape of sortedDrawableShapes) {
    switch (shape.type) {
      case "circle": {
        lyr.do(() => {
          lyr.fillStyle = shape.fillStyle;
          lyr.beginPath();
          lyr.arc(...shape.center.arr(), shape.radius, 0, Math.PI * 2);
          lyr.fill();
        });
        break;
      }
      case "line": {
        lyr.do(() => {
          lyr.strokeStyle = shape.strokeStyle;
          lyr.lineWidth = shape.lineWidth;
          lyr.beginPath();
          lyr.moveTo(...shape.from.arr());
          lyr.lineTo(...shape.to.arr());
          lyr.stroke();
        });
        break;
      }
      case "curve": {
        lyr.do(() => {
          lyr.strokeStyle = shape.strokeStyle;
          lyr.lineWidth = shape.lineWidth;
          const curve = d3.curveCardinal(lyr);
          lyr.beginPath();
          curve.lineStart();
          for (const pt of shape.points) {
            curve.point(...pt.arr());
          }
          curve.lineEnd();
          lyr.stroke();
        });
        break;
      }
      case "rectangle": {
        lyr.do(() => {
          if (shape.fillStyle) {
            lyr.fillStyle = shape.fillStyle;
            lyr.fillRect(...shape.xywh);
          }
          if (shape.strokeStyle) {
            lyr.strokeStyle = shape.strokeStyle;
            lyr.lineWidth = shape.lineWidth || 1;
            lyr.strokeRect(...shape.xywh);
          }
          if (shape.label) {
            lyr.fillStyle = "black";
            lyr.font = "20px sans-serif";
            lyr.textAlign = "center";
            lyr.textBaseline = "middle";
            lyr.fillText(shape.label, ...mm(shape.xywh).arr());
          }
        });
        break;
      }
      default:
        assertNever(shape);
    }
  }

  // now handle draggable targets
  if (ctx) {
    for (const shape of draggableTargets) {
      if (inXYWH(...ctx.pointer.hoverPointer.arr(), shape.bbox)) {
        ctx.pointer.setCursor("grab");
      }
      // console.log("adding click handler for draggable", bbox);
      ctx.pointer.addClickHandler(shape.bbox, () => {
        // this is the pointer position in the group's inner coordinates
        const pointerLocal = ctx.pointer.dragPointer!.sub(shape.origin);
        ctx.onDragStart(shape.key, pointerLocal);
      });
    }
  }
}

// HACK: I don't really know how to do this well
export function pruneEmptyGroups(shape: Shape): Shape | null {
  switch (shape.type) {
    case "circle":
      return shape;
    case "line":
      return shape;
    case "curve":
      return shape;
    case "rectangle":
      return shape;
    case "group": {
      const prunedShapes = shape.shapes
        .map(pruneEmptyGroups)
        .filter((s) => s !== null);
      if (prunedShapes.length === 0) {
        return null;
      }
      return {
        ...shape,
        shapes: prunedShapes,
      };
    }
    case "keyed-group": {
      const prunedShapes = _(shape.shapes)
        .mapValues(pruneEmptyGroups)
        .pickBy((s) => s !== null)
        .value();
      return {
        ...shape,
        shapes: prunedShapes,
      };
    }
    case "transform": {
      const prunedShape = pruneEmptyGroups(shape.shape);
      if (!prunedShape) {
        return null;
      }
      return {
        ...shape,
        shape: prunedShape,
      };
    }
    case "keyed": {
      const prunedShape = pruneEmptyGroups(shape.shape);
      if (!prunedShape) {
        return null;
      }
      return {
        ...shape,
        shape: prunedShape,
      };
    }
    case "z-index": {
      const prunedShape = pruneEmptyGroups(shape.shape);
      if (!prunedShape) {
        return null;
      }
      return {
        ...shape,
        shape: prunedShape,
      };
    }
    case "lazy":
      assert(shape.state.hasRun);
      const prunedShape = pruneEmptyGroups(shape.state.shape);
      if (!prunedShape) {
        return null;
      }
      return {
        ...shape,
        state: {
          hasRun: true,
          shape: prunedShape,
        },
      };
    default:
      assertNever(shape);
  }
}

export function origToInterpolatable(shape: Shape): InterpolatableShape {
  // const parentMap = makeParentMap(shape);
  const offsetMap = makeOffsetMap(shape, Vec2(0));
  // console.log("r.shape", r.shape);
  // console.log("parentMap", parentMap);
  const shape2 = runLazyShapes(shape, offsetMap);
  const shape3 = pullOutKeyedShapes(shape2);
  const shape4 = pruneEmptyGroups(shape3) ?? group();
  // TODO: should we be scared of losing identity here?
  return { ...shape4, interpolatable: true };
}

export function drawInterpolatable(
  lyr: Layer,
  shape: InterpolatableShape,
  ctx?: DrawShapeContext,
): void {
  const flatShapes = flattenShape(shape, Vec2(0), 0).flatShapes;
  // console.log("flatShapes", flatShapes);
  drawFlatShapes(lyr, flatShapes, ctx);
}

// export function stripParents(shape: Shape): Shape {
//   if (shape.type === "group") {
//     return {
//       ...shape,
//       parent: undefined,
//       shapes: shape.shapes.map(stripParents),
//     };
//   } else if (shape.type === "keyed-group") {
//     return {
//       ...shape,
//       parent: undefined,
//       shapes: _.mapValues(shape.shapes, stripParents),
//     };
//   }
//   return shape;
// }

export function lerpShapes(
  a: InterpolatableShape,
  b: InterpolatableShape,
  t: number,
): InterpolatableShape {
  return { ...lerpShapesImpl(a, b, t), interpolatable: true };
}

export function lerpShapes3(
  a: InterpolatableShape,
  b: InterpolatableShape,
  c: InterpolatableShape,
  { l0, l1, l2 }: { l0: number; l1: number; l2: number },
) {
  if (l0 + l1 < 1e-6) {
    return c;
  }
  const ab = lerpShapes(a, b, l1 / (l0 + l1));
  return lerpShapes(ab, c, l2);
}

function lerpShapesImpl(a: Shape, b: Shape, t: number): Shape {
  function assertSameType<T extends Shape>(a: T, b: Shape): asserts b is T {
    assert(a.type === b.type);
  }

  switch (a.type) {
    case "circle":
      assertSameType(a, b);
      assert(a.fillStyle === b.fillStyle);
      return {
        type: "circle",
        center: a.center.lerp(b.center, t),
        radius: lerp(a.radius, b.radius, t),
        fillStyle: a.fillStyle,
        nodeId: a.nodeId,
      };
    case "line":
      assertSameType(a, b);
      assert(a.strokeStyle === b.strokeStyle);
      return {
        type: "line",
        from: a.from.lerp(b.from, t),
        to: a.to.lerp(b.to, t),
        strokeStyle: a.strokeStyle,
        lineWidth: lerp(a.lineWidth, b.lineWidth, t),
      };
    case "curve":
      assertSameType(a, b);
      assert(a.strokeStyle === b.strokeStyle);
      assert(a.points.length === b.points.length);
      return {
        type: "curve",
        points: a.points.map((ap, i) => ap.lerp(b.points[i], t)),
        strokeStyle: a.strokeStyle,
        lineWidth: lerp(a.lineWidth, b.lineWidth, t),
      };
    case "rectangle":
      assertSameType(a, b);
      assert(a.fillStyle === b.fillStyle);
      assert(a.strokeStyle === b.strokeStyle);
      assert(a.label === b.label);
      return {
        type: "rectangle",
        xywh: [
          lerp(a.xywh[0], b.xywh[0], t),
          lerp(a.xywh[1], b.xywh[1], t),
          lerp(a.xywh[2], b.xywh[2], t),
          lerp(a.xywh[3], b.xywh[3], t),
        ],
        fillStyle: a.fillStyle,
        strokeStyle: a.strokeStyle,
        lineWidth:
          a.lineWidth === undefined || b.lineWidth === undefined
            ? undefined
            : lerp(a.lineWidth, b.lineWidth, t),
        label: a.label,
      };
    case "group":
      assertSameType(a, b);
      assert(a.shapes.length === b.shapes.length);
      return {
        type: "group",
        shapes: a.shapes.map((as, i) => lerpShapesImpl(as, b.shapes[i], t)),
      };
    case "keyed-group":
      assertSameType(a, b);
      // TODO: creating / removing objects requires changing number of keys
      // assert(
      //   Object.keys(a.shapes).length === Object.keys(b.shapes).length &&
      //     Object.keys(a.shapes).every((k) => k in b.shapes),
      // );
      const allKeys = _.union(Object.keys(a.shapes), Object.keys(b.shapes));
      return {
        type: "keyed-group",
        shapes: Object.fromEntries(
          allKeys.map((k) => {
            const as = a.shapes[k];
            const bs = b.shapes[k];
            if (as && bs) {
              return [k, lerpShapesImpl(as, bs, t)];
            } else {
              return [k, as || bs];
            }
          }),
        ),
        // shapes: _.mapValues(a.shapes, (as, k) =>
        //   lerpShapes(as, b.shapes[k], t),
        // ),
      };
    case "transform":
      assertSameType(a, b);
      return {
        type: "transform",
        shape: lerpShapesImpl(a.shape, b.shape, t),
        offset: a.offset.lerp(b.offset, t),
      };
    case "z-index":
      assertSameType(a, b);
      assert(a.zIndex === b.zIndex);
      return {
        type: "z-index",
        shape: lerpShapesImpl(a.shape, b.shape, t),
        zIndex: a.zIndex,
      };
    case "lazy":
      assertSameType(a, b);
      assert(a.state.hasRun);
      assert(b.state.hasRun);
      return {
        type: "lazy",
        state: {
          hasRun: true,
          shape: lerpShapesImpl(a.state.shape, b.state.shape, t),
        },
      };
    case "keyed":
      assertSameType(a, b);
      assert(a.key === b.key);
      assert(a.isDraggable === b.isDraggable);
      return {
        type: "keyed",
        key: a.key,
        isDraggable: a.isDraggable,
        shape: lerpShapesImpl(a.shape, b.shape, t),
      };
    default:
      return assertNever(a);
  }
}

export function shapeByKey(shape: Shape, key: string) {
  return shapeByKeyHelper(shape, key, Vec2(0));
}
function shapeByKeyHelper(
  shape: Shape,
  key: string,
  offset: Vec2,
): { shape: Shape; offset: Vec2 } | null {
  if (shape.type === "keyed" && shape.key === key) {
    return { shape, offset };
  }
  if (shape.type === "transform") {
    offset = offset.add(shape.offset);
  }
  for (const child of shapeChildren(shape, true)) {
    const result = shapeByKeyHelper(child, key, offset);
    if (result) {
      return result;
    }
  }
  return null;
}
