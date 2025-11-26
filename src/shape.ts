import * as d3 from "d3-shape";
import _ from "lodash";
import { Layer } from "./layer";
import { IPointerManager } from "./pointer";
import { assert, Many, manyToArray } from "./utils";
import { lerp, Vec2, Vec2able } from "./vec2";
import { fromCenter, inXYWH, lerpXYWH, mm, translateXYWH, XYWH } from "./xywh";

// # what's a diagram?

type Transform = Vec2;
function addTranslateToTransform(
  transform: Transform,
  offset: Vec2,
): Transform {
  return transform.add(offset);
}

type Path =
  | { type: "absolute"; key: string }
  | { type: "relative"; key: string };
function prependRelative(path: Path, key: string): Path {
  return path.type === "absolute"
    ? path
    : { type: "relative", key: key + "/" + path.key };
}
function prependAbsolute(path: Path, key: string): Path {
  return path.type === "absolute"
    ? path
    : { type: "absolute", key: key + "/" + path.key };
}

type FlatShape = {
  shape: Shape;
  path: Path;
  draggableKey?: string;
  transform: Transform;
  zIndex: number;
};

// DiagramFrames help us keep track of points across transformed
// diagrams.
type DiagramFrame = {
  id: string;
  transform: Transform;
};

export class Diagram {
  id: string;
  frames: DiagramFrame[];

  constructor(
    readonly flatShapes: FlatShape[],
    framesIn: DiagramFrame[],
  ) {
    this.id = _.uniqueId("diagram_");
    this.frames = [...framesIn, { id: this.id, transform: Vec2(0) }];
  }

  protected mapFlatShapes(
    fn: (fs: FlatShape) => FlatShape,
    newFrames?: DiagramFrame[],
  ): Diagram {
    return new Diagram(this.flatShapes.map(fn), newFrames ?? this.frames);
  }

  translate(offset: Vec2able): Diagram {
    return this.mapFlatShapes(
      (fs) => ({
        ...fs,
        transform: addTranslateToTransform(fs.transform, Vec2(offset)),
      }),
      this.frames.map((f) => ({
        ...f,
        transform: addTranslateToTransform(f.transform, Vec2(offset)),
      })),
    );
  }

  absoluteKey(key: string): Diagram {
    return this.mapFlatShapes((fs) => ({
      ...fs,
      path: prependAbsolute(fs.path, key),
    }));
  }

  zIndex(zIndex: number): Diagram {
    return this.mapFlatShapes((fs) => ({ ...fs, zIndex }));
  }
}

export class SingletonDiagram extends Diagram {
  constructor(readonly flatShape: FlatShape) {
    super([flatShape], []);
  }

  draggable(draggableKey: string, condition: boolean = true): Diagram {
    if (!condition) {
      return this;
    } else {
      return this.mapFlatShapes((fs) => ({ ...fs, draggableKey }));
    }
  }
}

export class GroupBuilderDiagram extends Diagram {
  nextIdx = 0;

  constructor() {
    super([], []);
  }

  push(diagram: Diagram): void {
    this.flatShapes.push(
      ...diagram.flatShapes.map((fs) => ({
        ...fs,
        path: prependRelative(fs.path, `${this.nextIdx}`),
      })),
    );
    this.frames.push(...diagram.frames);
    this.nextIdx++;
  }
}

export function groupBuilder() {
  return new GroupBuilderDiagram();
}

export function group(...manyDiagrams: Many<Diagram>[]): Diagram {
  const diagrams = manyToArray(manyDiagrams);
  const builder = groupBuilder();
  for (const diagram of diagrams) {
    builder.push(diagram);
  }
  return builder;
}

export interface ShapeDrawProps {
  lyr: Layer;
  interactiveCtx?: InteractiveContext;
}

export interface InteractiveContext {
  pointer: IPointerManager;
  onDragStart: (draggableKey: string, pointerOffset: Vec2) => void;
}

export interface Shape {
  draw(props: ShapeDrawProps): XYWH | null;
  lerp(other: Shape, t: number): Shape;
}

export type Optional<T> = T | Record<never, never>;

export interface FillAttributes {
  fillStyle: string;
}

export interface StrokeAttributes {
  strokeStyle: string;
  lineWidth?: number;
}

function drawFill(attrs: Optional<FillAttributes>, lyr: Layer) {
  if ("fillStyle" in attrs) {
    lyr.fillStyle = attrs.fillStyle;
    lyr.fill();
  }
}

function drawStroke(attrs: Optional<StrokeAttributes>, lyr: Layer) {
  if ("strokeStyle" in attrs) {
    lyr.strokeStyle = attrs.strokeStyle;
    lyr.lineWidth = attrs.lineWidth ?? 1;
    lyr.stroke();
  }
}

function assertSameFill(
  attrsA: Optional<FillAttributes>,
  attrsB: Optional<FillAttributes>,
) {
  if ("fillStyle" in attrsA || "fillStyle" in attrsB) {
    assert("fillStyle" in attrsA && "fillStyle" in attrsB);
    assert(attrsA.fillStyle === attrsB.fillStyle);
  }
}

function assertSameStroke(
  attrsA: Optional<StrokeAttributes>,
  attrsB: Optional<StrokeAttributes>,
) {
  if ("strokeStyle" in attrsA || "strokeStyle" in attrsB) {
    assert("strokeStyle" in attrsA && "strokeStyle" in attrsB);
    assert(attrsA.strokeStyle === attrsB.strokeStyle);
    assert(attrsA.lineWidth === attrsB.lineWidth);
  }
}

// # actual shapes!

function shapeFactory<C extends new (attrs: any) => Shape>(ctor: C) {
  return (attributes: ConstructorParameters<C>[0]) =>
    new SingletonDiagram({
      shape: new ctor(attributes),
      path: { type: "relative", key: "" },
      transform: Vec2(0),
      zIndex: 0,
    });
}

class Circle implements Shape {
  constructor(
    private attrs: {
      center: Vec2;
      radius: number;
    } & Optional<FillAttributes> &
      Optional<StrokeAttributes>,
  ) {}

  draw({ lyr }: ShapeDrawProps) {
    lyr.do(() => {
      lyr.beginPath();
      lyr.arc(...this.attrs.center.arr(), this.attrs.radius, 0, Math.PI * 2);
      drawFill(this.attrs, lyr);
      drawStroke(this.attrs, lyr);
    });
    return fromCenter(
      this.attrs.center,
      this.attrs.radius * 2,
      this.attrs.radius * 2,
    );
  }

  lerp(other: Shape, t: number): Shape {
    assert(other instanceof Circle);
    assertSameFill(this.attrs, other.attrs);
    assertSameStroke(this.attrs, other.attrs);
    return new Circle({
      ...this.attrs,
      center: this.attrs.center.lerp(other.attrs.center, t),
      radius: lerp(this.attrs.radius, other.attrs.radius, t),
    });
  }
}
export const circle = shapeFactory(Circle);

export class Rectangle implements Shape {
  constructor(
    private attrs: {
      xywh: XYWH;
      label?: string;
    } & Optional<FillAttributes> &
      Optional<StrokeAttributes>,
  ) {}

  draw({ lyr }: ShapeDrawProps) {
    lyr.do(() => {
      lyr.beginPath();
      lyr.rect(...this.attrs.xywh);
      drawFill(this.attrs, lyr);
      drawStroke(this.attrs, lyr);
    });

    const label = this.attrs.label;
    if (label) {
      lyr.do(() => {
        lyr.fillStyle = "black";
        lyr.font = "20px sans-serif";
        lyr.textAlign = "center";
        lyr.textBaseline = "middle";
        lyr.fillText(label, ...mm(this.attrs.xywh).arr());
      });
    }

    return this.attrs.xywh;
  }

  lerp(other: Shape, t: number): Shape {
    assert(other instanceof Rectangle);
    assertSameFill(this.attrs, other.attrs);
    assertSameStroke(this.attrs, other.attrs);
    assert(this.attrs.label === other.attrs.label);
    return new Rectangle({
      ...this.attrs,
      xywh: lerpXYWH(this.attrs.xywh, other.attrs.xywh, t),
    });
  }
}
export const rectangle = shapeFactory(Rectangle);

export class Line implements Shape {
  constructor(
    private attrs: {
      from: Vec2;
      to: Vec2;
    } & StrokeAttributes,
  ) {}

  draw({ lyr }: ShapeDrawProps) {
    lyr.do(() => {
      lyr.beginPath();
      lyr.moveTo(...this.attrs.from.arr());
      lyr.lineTo(...this.attrs.to.arr());
      drawStroke(this.attrs, lyr);
    });
    return null;
  }

  lerp(other: Shape, t: number): Shape {
    assert(other instanceof Line);
    assertSameStroke(this.attrs, other.attrs);
    return new Line({
      from: this.attrs.from.lerp(other.attrs.from, t),
      to: this.attrs.to.lerp(other.attrs.to, t),
      strokeStyle: this.attrs.strokeStyle,
      lineWidth: this.attrs.lineWidth,
    });
  }
}
export const line = shapeFactory(Line);

export class Polygon implements Shape {
  constructor(
    private attrs: {
      points: Vec2[];
    } & Optional<FillAttributes> &
      Optional<StrokeAttributes>,
  ) {}

  draw({ lyr }: ShapeDrawProps) {
    lyr.do(() => {
      lyr.beginPath();
      lyr.moveTo(...this.attrs.points[0].arr());
      for (let i = 1; i < this.attrs.points.length; i++) {
        lyr.lineTo(...this.attrs.points[i].arr());
      }
      lyr.closePath();
      drawFill(this.attrs, lyr);
      drawStroke(this.attrs, lyr);
    });
    const minX = _.min(this.attrs.points.map((p) => p.x))!;
    const minY = _.min(this.attrs.points.map((p) => p.y))!;
    const maxX = _.max(this.attrs.points.map((p) => p.x))!;
    const maxY = _.max(this.attrs.points.map((p) => p.y))!;
    return XYWH(minX, minY, maxX - minX, maxY - minY);
  }

  lerp(other: Shape, t: number): Shape {
    assert(other instanceof Polygon);
    assertSameFill(this.attrs, other.attrs);
    assertSameStroke(this.attrs, other.attrs);
    assert(this.attrs.points.length === other.attrs.points.length);
    return new Polygon({
      ...this.attrs,
      points: this.attrs.points.map((p, i) => p.lerp(other.attrs.points[i], t)),
    });
  }
}
export const polygon = shapeFactory(Polygon);

export class Curve implements Shape {
  constructor(
    private attrs: {
      points: Vec2[];
    } & StrokeAttributes,
  ) {}

  draw({ lyr }: ShapeDrawProps) {
    lyr.do(() => {
      const curve = d3.curveCardinal(lyr);
      lyr.beginPath();
      curve.lineStart();
      for (const pt of this.attrs.points) {
        curve.point(...pt.arr());
      }
      curve.lineEnd();
      drawStroke(this.attrs, lyr);
    });
    return null;
  }

  lerp(other: Shape, t: number): Shape {
    assert(other instanceof Curve);
    assertSameStroke(this.attrs, other.attrs);
    assert(this.attrs.points.length === other.attrs.points.length);
    return new Curve({
      ...this.attrs,
      points: this.attrs.points.map((p, i) => p.lerp(other.attrs.points[i], t)),
    });
  }
}
export const curve = shapeFactory(Curve);

// # doing stuff with diagrams!

export function drawDiagram(
  diagram: Diagram,
  lyr: Layer,
  interactiveCtx?: InteractiveContext,
): void {
  const sortedFlatShapes = _.sortBy(diagram.flatShapes, (s) => s.zIndex);

  for (const flatShape of sortedFlatShapes) {
    let bbox: XYWH | null = null;
    lyr.do(() => {
      lyr.translate(...flatShape.transform.arr());
      bbox = flatShape.shape.draw({ lyr, interactiveCtx });
    });

    if (flatShape.draggableKey && interactiveCtx && bbox) {
      const bboxAbsolute = translateXYWH(bbox, flatShape.transform);
      if (inXYWH(interactiveCtx.pointer.hoverPointer, bboxAbsolute)) {
        interactiveCtx.pointer.setCursor("grab");
      }
      interactiveCtx.pointer.addClickHandler(bboxAbsolute, () => {
        const pointerLocal = interactiveCtx.pointer.dragPointer!.sub(
          flatShape.transform,
        );
        interactiveCtx.onDragStart(flatShape.draggableKey!, pointerLocal);
      });
    }
  }
}

export function lerpDiagrams(a: Diagram, b: Diagram, t: number): Diagram {
  const aKeyed = _.keyBy(a.flatShapes, (fs) => fs.path.key);
  const bKeyed = _.keyBy(b.flatShapes, (fs) => fs.path.key);

  const allKeys = _.union(Object.keys(aKeyed), Object.keys(bKeyed));
  const lerpedFlatShapes: FlatShape[] = allKeys.map((key) => {
    const aFs = aKeyed[key];
    const bFs = bKeyed[key];
    if (aFs && bFs) {
      return {
        shape: aFs.shape.lerp(bFs.shape, t),
        path: aFs.path,
        transform: aFs.transform.lerp(bFs.transform, t),
        zIndex: lerp(aFs.zIndex, bFs.zIndex, t),
      };
    } else {
      return aFs ?? bFs!;
    }
  });

  // TODO: we don't lerp frames cuz they're only used at construction
  // time?
  return new Diagram(lerpedFlatShapes, []);
}

export function lerpDiagrams3(
  a: Diagram,
  b: Diagram,
  c: Diagram,
  { l0, l1, l2 }: { l0: number; l1: number; l2: number },
) {
  if (l0 + l1 < 1e-6) {
    return c;
  }
  const ab = lerpDiagrams(a, b, l1 / (l0 + l1));
  return lerpDiagrams(ab, c, l2);
}

export function flatShapeByDraggableKey(
  diagram: Diagram,
  draggableKey: string,
): FlatShape {
  const fs = diagram.flatShapes.find((fs) => fs.draggableKey === draggableKey);
  if (!fs) {
    throw new Error(`No shape with key ${draggableKey}`);
  }
  return fs;
}

// # the return of the point in the diagram

export type PointInDiagram = {
  diagramId: string;
  point: Vec2;
};

export function pointInDiagram(diagram: Diagram, point: Vec2): PointInDiagram {
  return { diagramId: diagram.id, point };
}

export function resolvePointInDiagram(
  pointInDiagram: PointInDiagram,
  diagram: Diagram,
): Vec2 {
  const fs = diagram.frames.find(
    (frame) => frame.id === pointInDiagram.diagramId,
  );
  assert(!!fs, "Frame ID must exist in diagram");
  return pointInDiagram.point.add(fs.transform);
}
