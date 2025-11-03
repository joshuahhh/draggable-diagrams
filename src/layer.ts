import { add, v, Vec2 } from "./vec2";

/**
 * Properties that return (or directly are) values that don't depend
 * on context state. These can safely be proxied immediately to the
 * underlying context.
 */
const CTX_DIRECT_PROPERTIES: (keyof CanvasRenderingContext2D)[] = [
  "canvas",
  "createConicGradient",
  "createImageData",
  "createLinearGradient",
  "createPattern",
  "createRadialGradient",
  "getContextAttributes",
];

/**
 * Properties that return values dependent on context state. These
 * cannot be used with Layer at all.
 */
const CTX_UNSAFE_PROPERTIES: (keyof CanvasRenderingContext2D)[] = [
  "getImageData",
  "getLineDash",
  "getTransform",
  "isContextLost",
  "isPointInPath",
  "isPointInStroke",
  "measureText",
];

const includes = <T>(arr: T[], item: any): item is T => arr.includes(item);

class LayerImpl {
  private commands: (((ctx: CanvasRenderingContext2D) => void) | LayerImpl)[] =
    [];

  private thisProxy: Layer;

  private localTranslation: Vec2 | null = null;
  private parentLayer: LayerImpl | null = null;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private drawable: boolean,
  ) {
    this.thisProxy = new Proxy<any>(this, {
      get: (target, prop) => {
        if (prop in target) {
          return (target as any)[prop];
        }

        if (includes(CTX_DIRECT_PROPERTIES, prop)) {
          const value = this.ctx[prop];
          return typeof value === "function" ? value.bind(this.ctx) : value;
        }

        if (includes(CTX_UNSAFE_PROPERTIES, prop)) {
          throw new Error(`Layer doesn't support ${String(prop)}; sorry.`);
        }

        // Assume the property is a method, and return a function to capture calls
        return (...args: any[]) => {
          this.commands.push((ctx) => {
            // @ts-ignore
            ctx[prop](...args);
          });
        };
      },

      set: (target, prop, value) => {
        if (prop in target) {
          (target as any)[prop] = value;
          return true;
        }

        // Capture property assignments
        this.commands.push((ctx) => {
          // @ts-ignore
          ctx[prop] = value;
        });
        return true;
      },
    });
  }

  private _draw(): void {
    for (const command of this.commands) {
      if (command instanceof LayerImpl) {
        if (command.localTranslation === null) {
          command._draw();
        } else {
          this.ctx.save();
          this.ctx.translate(...command.localTranslation);
          command._draw();
          this.ctx.restore();
        }
      } else {
        command(this.ctx);
      }
    }
  }

  draw(): void {
    if (this.drawable) {
      this._draw();
      this.drawable = false;
    } else {
      throw new Error("Can't draw a non-root / already-drawn layer");
    }
  }

  place(child: Layer, localTranslation = v(0)): void {
    child.localTranslation = localTranslation;
    child.parentLayer = this;
    child.drawable = false;
    this.commands.push(child);
  }

  do(f: (lyr: Layer) => void) {
    this.thisProxy.save();
    f(this.thisProxy);
    this.thisProxy.restore();
  }

  withContext(f: (ctx: CanvasRenderingContext2D) => void) {
    this.commands.push(f);
  }

  // To get stuff out of LayerImpl, we use static methods (which have
  // access to private fields)

  static make(...args: ConstructorParameters<typeof LayerImpl>): Layer {
    return new LayerImpl(...args).thisProxy;
  }

  static commandCount(lyr: LayerImpl): number {
    return lyr.commands
      .map((cmd) =>
        cmd instanceof LayerImpl ? LayerImpl.commandCount(cmd) : 1,
      )
      .reduce((a, b) => a + b, 0);
  }

  // Point stuff

  point(localPoint: Vec2): PointOnLayer {
    return { __layer: this, __point: localPoint };
  }

  resolvePoint(pol: PointOnLayer): Vec2 {
    let { __layer: layer, __point: point } = pol;

    while (true) {
      if (layer === this) {
        return point;
      }
      if (layer.localTranslation !== null) {
        point = add(point, layer.localTranslation);
      }
      if (layer.parentLayer === null) {
        throw new Error("Point's layer is not a descendant of this layer");
      }
      layer = layer.parentLayer;
    }
  }
}

export type Layer = CanvasRenderingContext2D & LayerImpl;

export function layer(lyr: CanvasRenderingContext2D): Layer {
  return LayerImpl.make(lyr, true);
}

export function getLayerCommandCount(lyr: Layer): number {
  return LayerImpl.commandCount(lyr);
}

export type PointOnLayer = {
  // TODO: just trying to make these hard to accidentally access
  // directly
  __layer: LayerImpl;
  __point: Vec2;
};

const trashCanvas = document.createElement("canvas");
const trashCtx = trashCanvas.getContext("2d")!;
export const noLyr: Layer = LayerImpl.make(trashCtx, false);
