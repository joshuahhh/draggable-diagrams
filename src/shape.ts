import * as d3 from "d3-shape";
import _ from "lodash";
import { Layer } from "./layer";
import { assertNever } from "./utils";
import { lerp, Vec2 } from "./vec2";

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
      type: "group";
      shapes: Shape[];
      offset?: Vec2;
      parent?: Group;
    }
  | {
      type: "keyed-group";
      shapes: Record<string, Shape>;
      offset?: Vec2;
      parent?: Group;
    }
  | {
      type: "lazy";
      getShape: () => Shape;
    };

export type Group = Shape & { type: "group" };
export type KeyedGroup = Shape & { type: "keyed-group" };

export function group(): Group {
  return { type: "group", shapes: [] };
}

export function keyedGroup(): KeyedGroup {
  return { type: "keyed-group", shapes: {} };
}

export function placeGroup(
  parent: Group,
  child: Group | KeyedGroup,
  offset?: Vec2,
): void {
  child.parent = parent;
  if (offset) {
    child.offset = offset;
  }
  parent.shapes.push(child);
}

export type PointInGroup = {
  __group: Group;
  __point: Vec2;
};

export function pointInGroup(group: Group, localPoint: Vec2): PointInGroup {
  return { __group: group, __point: localPoint };
}

export function resolvePointInGroup(target: Group, pig: PointInGroup): Vec2 {
  let { __group: group, __point: point } = pig;

  while (true) {
    if (group === target) {
      return point;
    }
    if (group.offset) {
      point = point.add(group.offset);
    }
    if (!group.parent) {
      throw new Error("Point's group is not a descendant of target group");
    }
    group = group.parent;
  }
}

export function drawShape(lyr: Layer, shape: Shape): void {
  lyr.do(() => {
    switch (shape.type) {
      case "circle":
        lyr.fillStyle = shape.fillStyle;
        lyr.beginPath();
        lyr.arc(...shape.center.arr(), shape.radius, 0, Math.PI * 2);
        lyr.fill();
        break;
      case "line":
        lyr.strokeStyle = shape.strokeStyle;
        lyr.lineWidth = shape.lineWidth;
        lyr.beginPath();
        lyr.moveTo(...shape.from.arr());
        lyr.lineTo(...shape.to.arr());
        lyr.stroke();
        break;
      case "curve":
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
        break;
      case "group":
        lyr.do(() => {
          if (shape.offset) {
            lyr.translate(...shape.offset.arr());
          }

          for (const child of shape.shapes) {
            drawShape(lyr, child);
          }
        });
        break;
      case "keyed-group":
        lyr.do(() => {
          if (shape.offset) {
            lyr.translate(...shape.offset.arr());
          }

          for (const key of Object.keys(shape.shapes)) {
            drawShape(lyr, shape.shapes[key]);
          }
        });
        break;
      case "lazy":
        drawShape(lyr, shape.getShape());
        break;
      default:
        assertNever(shape);
    }
  });
}

export function stripParents(shape: Shape): Shape {
  if (shape.type === "group") {
    return {
      ...shape,
      parent: undefined,
      shapes: shape.shapes.map(stripParents),
    };
  } else if (shape.type === "keyed-group") {
    return {
      ...shape,
      parent: undefined,
      shapes: _.mapValues(shape.shapes, stripParents),
    };
  }
  return shape;
}

export function resolveLazy(shape: Shape): Shape {
  if (shape.type === "lazy") {
    return resolveLazy(shape.getShape());
  } else if (shape.type === "group") {
    return {
      ...shape,
      shapes: shape.shapes.map(resolveLazy),
    };
  } else if (shape.type === "keyed-group") {
    return {
      ...shape,
      shapes: _.mapValues(shape.shapes, (v) => resolveLazy(v)),
    };
  }
  return shape;
}

export function lerpShapes(a: Shape, b: Shape, t: number): Shape {
  function assertSameType<T extends Shape>(a: T, b: Shape): asserts b is T {
    if (a.type !== b.type)
      throw new Error(
        `Cannot interpolate shapes of different types (${a.type} vs ${b.type})`,
      );
  }

  switch (a.type) {
    case "circle":
      assertSameType(a, b);
      if (b.fillStyle !== a.fillStyle)
        throw new Error("Cannot interpolate shapes with different styles");
      return {
        type: "circle",
        center: a.center.lerp(b.center, t),
        radius: lerp(a.radius, b.radius, t),
        fillStyle: a.fillStyle,
        nodeId: a.nodeId,
      };
    case "line":
      assertSameType(a, b);
      if (b.strokeStyle !== a.strokeStyle)
        throw new Error("Cannot interpolate shapes with different styles");
      return {
        type: "line",
        from: a.from.lerp(b.from, t),
        to: a.to.lerp(b.to, t),
        strokeStyle: a.strokeStyle,
        lineWidth: lerp(a.lineWidth, b.lineWidth, t),
      };
    case "curve":
      assertSameType(a, b);
      if (b.strokeStyle !== a.strokeStyle)
        throw new Error("Cannot interpolate shapes with different styles");
      if (b.points.length !== a.points.length)
        throw new Error(
          "Cannot interpolate curves with different point counts",
        );
      return {
        type: "curve",
        points: a.points.map((ap, i) => ap.lerp(b.points[i], t)),
        strokeStyle: a.strokeStyle,
        lineWidth: lerp(a.lineWidth, b.lineWidth, t),
      };
    case "group":
      assertSameType(a, b);
      if (b.shapes.length !== a.shapes.length)
        throw new Error(
          "Cannot interpolate groups with different shape counts",
        );
      return {
        type: "group",
        shapes: a.shapes.map((as, i) => lerpShapes(as, b.shapes[i], t)),
        offset: (a.offset ?? Vec2(0)).lerp(b.offset ?? Vec2(0), t),
      };
    case "keyed-group":
      assertSameType(a, b);
      if (
        Object.keys(a.shapes).length !== Object.keys(b.shapes).length ||
        Object.keys(a.shapes).some((k) => !(k in b.shapes))
      )
        throw new Error("Cannot interpolate keyed groups with different keys");
      return {
        type: "keyed-group",
        shapes: _.mapValues(a.shapes, (as, k) =>
          lerpShapes(as, b.shapes[k], t),
        ),
        offset: (a.offset ?? Vec2(0)).lerp(b.offset ?? Vec2(0), t),
      };
    case "lazy":
      throw new Error("Cannot interpolate lazy shapes");
    default:
      return assertNever(a);
  }
}
