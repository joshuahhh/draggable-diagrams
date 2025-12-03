import { describe, expect, it } from "vitest";
import { lerpSvgNode } from "./lerp";

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

  it("lerps color props", () => {
    const a = <rect fill="red" stroke="blue" />;
    const b = <rect fill="green" stroke="yellow" />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        fill="rgb(145, 116, 0)"
        stroke="rgb(255, 0, 94)"
      />
    `);
  });

  it("lerps style objects with colors", () => {
    const a = <rect style={{ fill: "red", backgroundColor: "blue" }} />;
    const b = <rect style={{ fill: "green", backgroundColor: "yellow" }} />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        style={
          {
            "backgroundColor": "rgb(255, 0, 94)",
            "fill": "rgb(145, 116, 0)",
          }
        }
      />
    `);
  });

  it("lerps style objects with numeric values", () => {
    const a = <rect style={{ opacity: 0, fontSize: 10 }} />;
    const b = <rect style={{ opacity: 1, fontSize: 20 }} />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        style={
          {
            "fontSize": 15,
            "opacity": 0.5,
          }
        }
      />
    `);
  });

  it("lerps style objects with mixed types", () => {
    const a = <rect style={{ opacity: 0, fill: "red" }} />;
    const b = <rect style={{ opacity: 1, fill: "blue" }} />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        style={
          {
            "fill": "rgb(245, 0, 134)",
            "opacity": 0.5,
          }
        }
      />
    `);
  });

  it("handles style objects with different keys", () => {
    const a = <rect style={{ opacity: 0 }} />;
    const b = <rect style={{ opacity: 1, fill: "blue" }} />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        style={
          {
            "fill": "blue",
            "opacity": 0.5,
          }
        }
      />
    `);
  });

  it("lerps between fill none and fill none", () => {
    const a = <rect fill="none" x={0} />;
    const b = <rect fill="none" x={100} />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        fill="none"
        x={50}
      />
    `);
  });

  it("lerps between fill none and fill red", () => {
    const a = <rect fill="none" x={0} />;
    const b = <rect fill="red" x={100} />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        fill="rgba(255, 0, 0, 0.5)"
        x={50}
      />
    `);
  });

  it("lerps between fill red and fill none", () => {
    const a = <rect fill="red" x={0} />;
    const b = <rect fill="none" x={100} />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <rect
        fill="rgba(255, 0, 0, 0.5)"
        x={50}
      />
    `);
  });

  it("lerps polygon points", () => {
    const a = <polygon points="0,0 10,0 10,10" />;
    const b = <polygon points="20,20 30,20 30,30" />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result).toMatchInlineSnapshot(`
      <polygon
        points="10,10 20,10 20,20"
      />
    `);
  });

  it("lerps polygon points at t=0", () => {
    const a = <polygon points="0,0 10,0 10,10" />;
    const b = <polygon points="20,20 30,20 30,30" />;

    const result = lerpSvgNode(a, b, 0);

    expect(result).toMatchInlineSnapshot(`
      <polygon
        points="0,0 10,0 10,10"
      />
    `);
  });

  it("lerps polygon points at t=1", () => {
    const a = <polygon points="0,0 10,0 10,10" />;
    const b = <polygon points="20,20 30,20 30,30" />;

    const result = lerpSvgNode(a, b, 1);

    expect(result).toMatchInlineSnapshot(`
      <polygon
        points="20,20 30,20 30,30"
      />
    `);
  });

  it("throws on mismatched point counts", () => {
    const a = <polygon points="0,0 10,0 10,10" />;
    const b = <polygon points="20,20 30,20" />;

    expect(() => lerpSvgNode(a, b, 0.5)).toThrow(
      "Cannot lerp points: different point counts"
    );
  });

  it("lerps path d attribute", () => {
    const a = <path d="M 0 0 L 10 10" />;
    const b = <path d="M 20 20 L 30 30" />;

    const result = lerpSvgNode(a, b, 0.5);

    expect(result.props.d).toBe("M10,10L20,20");
  });

  it("lerps path d attribute at t=0", () => {
    const a = <path d="M 0 0 L 10 10" />;
    const b = <path d="M 20 20 L 30 30" />;

    const result = lerpSvgNode(a, b, 0);

    expect(result.props.d).toBe("M0,0L10,10");
  });

  it("lerps path d attribute at t=1", () => {
    const a = <path d="M 0 0 L 10 10" />;
    const b = <path d="M 20 20 L 30 30" />;

    const result = lerpSvgNode(a, b, 1);

    // At t=1, d3-interpolate-path returns the original format of b
    expect(result.props.d).toBe("M 20 20 L 30 30");
  });

  it("lerps curved paths", () => {
    const a = <path d="M 0 0 Q 5 10 10 0" />;
    const b = <path d="M 20 20 Q 25 30 30 20" />;

    const result = lerpSvgNode(a, b, 0.5);

    // d3-interpolate-path handles curved paths
    expect(result.props.d).toBeTruthy();
    expect(typeof result.props.d).toBe("string");
  });

  it("lerps paths with different command types", () => {
    // d3-interpolate-path can handle paths with different commands
    const a = <path d="M 0 0 L 10 10" />;
    const b = <path d="M 20 20 C 25 25 25 25 30 30" />;

    const result = lerpSvgNode(a, b, 0.5);

    // Should produce a valid path
    expect(result.props.d).toBeTruthy();
    expect(typeof result.props.d).toBe("string");
  });
});
