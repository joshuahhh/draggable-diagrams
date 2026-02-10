import { describe, expect, it } from "vitest";
import {
  globalToLocal,
  lerpTransformString,
  localToGlobal,
  parseTransform,
  serializeTransform,
} from "./transform";

describe("parseTransform", () => {
  it("parses translate", () => {
    const result = parseTransform("translate(10, 20)");
    expect(result).toEqual([{ type: "translate", x: 10, y: 20 }]);
  });

  it("parses translate with single value", () => {
    const result = parseTransform("translate(10)");
    expect(result).toEqual([{ type: "translate", x: 10, y: 0 }]);
  });

  it("parses rotate", () => {
    const result = parseTransform("rotate(45)");
    expect(result).toEqual([{ type: "rotate", degrees: 45, cx: 0, cy: 0 }]);
  });

  it("parses rotate with center", () => {
    const result = parseTransform("rotate(45, 50, 100)");
    expect(result).toEqual([{ type: "rotate", degrees: 45, cx: 50, cy: 100 }]);
  });

  it("parses scale", () => {
    const result = parseTransform("scale(2)");
    expect(result).toEqual([{ type: "scale", x: 2, y: 2 }]);
  });

  it("parses scale with two values", () => {
    const result = parseTransform("scale(2, 3)");
    expect(result).toEqual([{ type: "scale", x: 2, y: 3 }]);
  });

  it("parses multiple transforms", () => {
    const result = parseTransform("translate(10, 20) rotate(45) scale(2)");
    expect(result).toEqual([
      { type: "translate", x: 10, y: 20 },
      { type: "rotate", degrees: 45, cx: 0, cy: 0 },
      { type: "scale", x: 2, y: 2 },
    ]);
  });

  it("handles empty string", () => {
    const result = parseTransform("");
    expect(result).toEqual([]);
  });
});

describe("serializeTransform", () => {
  it("serializes translate", () => {
    const result = serializeTransform([{ type: "translate", x: 10, y: 20 }]);
    expect(result).toBe("translate(10, 20)");
  });

  it("serializes rotate", () => {
    const result = serializeTransform([
      { type: "rotate", degrees: 45, cx: 0, cy: 0 },
    ]);
    expect(result).toBe("rotate(45, 0, 0)");
  });

  it("serializes rotate with center", () => {
    const result = serializeTransform([
      { type: "rotate", degrees: 45, cx: 50, cy: 100 },
    ]);
    expect(result).toBe("rotate(45, 50, 100)");
  });

  it("serializes scale", () => {
    const result = serializeTransform([{ type: "scale", x: 2, y: 2 }]);
    expect(result).toBe("scale(2)");
  });

  it("serializes scale with different x and y", () => {
    const result = serializeTransform([{ type: "scale", x: 2, y: 3 }]);
    expect(result).toBe("scale(2, 3)");
  });

  it("serializes multiple transforms", () => {
    const result = serializeTransform([
      { type: "translate", x: 10, y: 20 },
      { type: "rotate", degrees: 45, cx: 0, cy: 0 },
      { type: "scale", x: 2, y: 2 },
    ]);
    expect(result).toBe("translate(10, 20) rotate(45, 0, 0) scale(2)");
  });
});

describe("lerpTransformString", () => {
  it("lerps translate", () => {
    const result = lerpTransformString(
      "translate(0, 0)",
      "translate(100, 100)",
      0.5,
    );
    expect(result).toBe("translate(50, 50)");
  });

  it("lerps at t=0 returns first transform", () => {
    const result = lerpTransformString(
      "translate(0, 0)",
      "translate(100, 100)",
      0,
    );
    expect(result).toBe("translate(0, 0)");
  });

  it("lerps at t=1 returns second transform", () => {
    const result = lerpTransformString(
      "translate(0, 0)",
      "translate(100, 100)",
      1,
    );
    expect(result).toBe("translate(100, 100)");
  });

  it("lerps rotate", () => {
    const result = lerpTransformString("rotate(0)", "rotate(90)", 0.5);
    expect(result).toBe("rotate(45, 0, 0)");
  });

  it("lerps scale", () => {
    const result = lerpTransformString("scale(1)", "scale(3)", 0.5);
    expect(result).toBe("scale(2)");
  });

  it("lerps multiple transforms", () => {
    const result = lerpTransformString(
      "translate(0, 0) rotate(0)",
      "translate(100, 100) rotate(90)",
      0.5,
    );
    expect(result).toBe("translate(50, 50) rotate(45, 0, 0)");
  });

  it("throws on mismatched transform counts", () => {
    expect(() =>
      lerpTransformString(
        "translate(0, 0)",
        "translate(100, 100) rotate(90)",
        0.3,
      ),
    ).toThrow("Cannot lerp transforms with different lengths");
  });

  it("throws on mismatched transform types", () => {
    expect(() =>
      lerpTransformString("translate(0, 0)", "rotate(90)", 0.3),
    ).toThrow("Cannot lerp transforms with different types");
  });

  it("collapses translation chains and lerps them", () => {
    const result = lerpTransformString(
      "translate(10, 20) translate(30, 40)",
      "translate(50, 60) translate(70, 80)",
      0.5,
    );
    // (10+30, 20+40) = (40, 60) lerp to (50+70, 60+80) = (120, 140) at t=0.5
    // Result: ((40+120)/2, (60+140)/2) = (80, 100)
    expect(result).toBe("translate(80, 100)");
  });

  it("collapses single translation on each side", () => {
    const result = lerpTransformString(
      "translate(0, 0)",
      "translate(100, 100)",
      0.5,
    );
    expect(result).toBe("translate(50, 50)");
  });

  it("collapses different length translation chains", () => {
    const result = lerpTransformString(
      "translate(10, 20)",
      "translate(30, 40) translate(50, 60)",
      0.5,
    );
    // Left: (10, 20)
    // Right: (30+50, 40+60) = (80, 100)
    // Lerp: ((10+80)/2, (20+100)/2) = (45, 60)
    expect(result).toBe("translate(45, 60)");
  });

  it("handles empty strings", () => {
    expect(lerpTransformString("", "", 0.5)).toBe("");
    // Empty with translate treats empty as translate(0,0)
    expect(lerpTransformString("translate(10, 20)", "", 0.5)).toBe(
      "translate(5, 10)",
    );
    expect(lerpTransformString("", "translate(10, 20)", 0.5)).toBe(
      "translate(5, 10)",
    );
    // Empty with non-translate just returns the non-empty one
    expect(lerpTransformString("rotate(90)", "", 0.5)).toBe("rotate(90)");
    expect(lerpTransformString("", "rotate(90)", 0.5)).toBe("rotate(90)");
  });

  it("lerps complex transform to itself", () => {
    const transform =
      "translate(100, 100) rotate(180, 0, 0) translate(100, 0) rotate(-180, 0, 0)";
    const result = lerpTransformString(transform, transform, 0.5);
    expect(result).toBe(transform);
  });
});

describe("localToGlobal and globalToLocal", () => {
  it("converts translate correctly", () => {
    const transforms = parseTransform("translate(100, 50)");
    const local = { x: 10, y: 20 };
    const global = localToGlobal(transforms, local);
    expect(global.x).toBeCloseTo(110);
    expect(global.y).toBeCloseTo(70);
  });

  it("converts combined translate and rotate correctly", () => {
    // This represents <g transform="translate(100,0)"><g transform="rotate(90)">
    // Accumulated as "translate(100,0) rotate(90)"
    // A point at (10, 0) in local coords should:
    // 1. Be rotated 90° → (0, 10)
    // 2. Be translated by (100, 0) → (100, 10)
    const transforms = parseTransform("translate(100, 0) rotate(90)");
    const local = { x: 10, y: 0 };
    const global = localToGlobal(transforms, local);
    expect(global.x).toBeCloseTo(100);
    expect(global.y).toBeCloseTo(10);
  });

  it("roundtrips correctly", () => {
    const transforms = parseTransform("translate(100, 0) rotate(90)");
    const local = { x: 10, y: 5 };
    const global = localToGlobal(transforms, local);
    const backToLocal = globalToLocal(transforms, global);
    expect(backToLocal.x).toBeCloseTo(local.x);
    expect(backToLocal.y).toBeCloseTo(local.y);
  });
});
