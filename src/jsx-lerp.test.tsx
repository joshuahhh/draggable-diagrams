import { describe, expect, it } from "vitest";
import { lerpSvgNode } from "./jsx-lerp";

describe("lerpSvgNode", () => {
  it("lerps numeric props", () => {
    const a = <rect x={0} y={0} width={100} height={100} />;
    const b = <rect x={100} y={50} width={200} height={150} />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        height={125}
        width={150}
        x={50}
        y={25}
      />
    `);
  });

  it("lerps at t=0 returns first element", () => {
    const a = <rect x={0} width={100} />;
    const b = <rect x={100} width={200} />;

    const result = lerpSvgNode(a, b, 0);

    expect(result).toMatchInlineSnapshot(`
      <rect
        width={100}
        x={0}
      />
    `);
  });

  it("lerps at t=1 returns second element", () => {
    const a = <rect x={0} width={100} />;
    const b = <rect x={100} width={200} />;

    const result = lerpSvgNode(a, b, 1);

    expect(result).toMatchInlineSnapshot(`
      <rect
        width={200}
        x={100}
      />
    `);
  });

  it("preserves non-numeric props", () => {
    const a = <rect x={0} fill="red" id="r1" />;
    const b = <rect x={100} fill="red" id="r1" />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        fill="red"
        id="r1"
        x={50}
      />
    `);
  });

  it("handles transform strings", () => {
    const a = <rect transform="translate(0, 0)" />;
    const b = <rect transform="translate(100, 100)" />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        transform="translate(50, 50)"
      />
    `);
  });

  it("recursively lerps children", () => {
    const a = (
      <g>
        <rect x={0} />
        <circle cx={0} />
      </g>
    );
    const b = (
      <g>
        <rect x={100} />
        <circle cx={100} />
      </g>
    );

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <g>
        <rect
          x={50}
        />
        <circle
          cx={50}
        />
      </g>
    `);
  });

  it("handles nested groups", () => {
    const a = (
      <g>
        <g>
          <rect x={0} />
        </g>
      </g>
    );
    const b = (
      <g>
        <g>
          <rect x={100} />
        </g>
      </g>
    );

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <g>
        <g>
          <rect
            x={50}
          />
        </g>
      </g>
    `);
  });

  it("throws on mismatched element types", () => {
    const a = <rect />;
    const b = <circle />;

    expect(() => lerpSvgNode(a, b, 0.5)).toThrow(
      "Cannot lerp between different element types"
    );
  });

  it("handles props only in one element", () => {
    const a = <rect x={0} />;
    const b = <rect x={100} y={50} />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        x={50}
        y={50}
      />
    `);
  });
});
