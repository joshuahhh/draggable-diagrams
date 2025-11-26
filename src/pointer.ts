import _ from "lodash";
import { Layer } from "./layer";
import { Vec2 } from "./vec2";
import { pointInPoly, polyArea } from "./xywh";

// Coordinates statement: In PointerManager, all coordinates are in
// canvas space. Using withOffset produces a PointerManager where
// coordinates are offset by the given vector.

export type IPointerManager = {
  isDragging: boolean;
  hoverPointer: Vec2;
  dragPointer: Vec2 | null;

  addClickHandler(poly: Vec2[], onClick: () => void): void;
  addPointerUpHandler(onUp: () => void): void;
  setCursor(cursor: string): void;
};

export class PointerManager implements IPointerManager {
  public isDragging = false;
  public hoverPointer = Vec2(0);
  public dragPointer: Vec2 | null = null;

  private clickables: {
    poly: Vec2[];
    onClick: () => void;
  }[] = [];
  private onPointerUps: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    const updatePointer = (e: PointerEvent) => {
      // Convert clientX/Y to canvas-relative coordinates
      const rect = this.canvas.getBoundingClientRect();
      this.hoverPointer = Vec2(e.clientX - rect.left, e.clientY - rect.top);
      this.dragPointer = this.isDragging ? this.hoverPointer : null;
    };

    this.canvas.addEventListener("pointerdown", (e) => {
      this.isDragging = true;
      updatePointer(e);

      const clickable = this.hoveredClickable();
      if (clickable) {
        clickable.onClick();
      }
    });

    document.addEventListener("pointermove", (e) => {
      updatePointer(e);
    });

    document.addEventListener("pointerup", (e) => {
      this.isDragging = false;
      updatePointer(e);

      this.onPointerUps.forEach((f) => f());
    });
  }

  hoveredClickable() {
    return (
      this.hoverPointer &&
      // get smalleset clickable containing hoverPointer
      _.minBy(
        this.clickables.filter((c) => pointInPoly(this.hoverPointer, c.poly)),
        ({ poly }) => polyArea(poly),
      )
    );
  }

  addClickHandler(poly: Vec2[], onClick: () => void) {
    this.clickables.push({ poly, onClick });
  }

  addPointerUpHandler(onUp: () => void) {
    this.onPointerUps.push(onUp);
  }

  prepareForDraw() {
    this.clickables = [];
    this.onPointerUps = [];
  }

  setCursor(cursor: string) {
    this.canvas.style.cursor = cursor;
  }

  drawClickablesDebug(lyr: Layer) {
    for (const clickable of this.clickables) {
      debugPoly(lyr, clickable.poly);
    }
  }
}

export function pointerManagerWithOffset(
  pointer: IPointerManager,
  offset: Vec2,
): IPointerManager {
  return new PointerManagerOffset(pointer, offset);
}

export class PointerManagerOffset implements IPointerManager {
  constructor(
    private pointer: IPointerManager,
    private offset: Vec2,
  ) {}

  get isDragging() {
    return this.pointer.isDragging;
  }
  get hoverPointer() {
    return this.pointer.hoverPointer.sub(this.offset);
  }
  get dragPointer() {
    const dp = this.pointer.dragPointer;
    return dp ? dp.sub(this.offset) : null;
  }

  addClickHandler(poly: Vec2[], onClick: () => void): void {
    this.pointer.addClickHandler(
      poly.map((p) => p.add(this.offset)),
      onClick,
    );
  }
  addPointerUpHandler(onUp: () => void): void {
    this.pointer.addPointerUpHandler(onUp);
  }
  setCursor(cursor: string): void {
    this.pointer.setCursor(cursor);
  }
}
