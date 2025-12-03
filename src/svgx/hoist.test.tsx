import { describe, expect, it } from "vitest";
import { accumulateTransforms, hoistSvg } from "./hoist";

describe("hoistSvg", () => {
  it("pulls nodes with IDs to the top level", () => {
    const tree = (
      <g>
        <rect id="r1" />
        <circle id="c1" />
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          id="r1"
        />,
        "c1" => <circle
          id="c1"
        />,
        "" => <g />,
      }
    `);
  });

  it("accumulates transforms from parent <g> nodes", () => {
    const tree = (
      <g transform="translate(10, 20)">
        <rect id="r1" />
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          data-accumulated-transform="translate(10, 20)"
          id="r1"
          transform="translate(10, 20)"
        />,
        "" => <g
          data-accumulated-transform="translate(10, 20)"
          transform="translate(10, 20)"
        />,
      }
    `);
  });

  it("combines multiple transforms", () => {
    const tree = (
      <g transform="translate(10, 20)">
        <g transform="rotate(45)">
          <rect id="r1" transform="scale(2)" />
        </g>
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          data-accumulated-transform="translate(10, 20) rotate(45) scale(2)"
          id="r1"
          transform="translate(10, 20) rotate(45) scale(2)"
        />,
        "" => <g
          data-accumulated-transform="translate(10, 20)"
          transform="translate(10, 20)"
        >
          <g
            data-accumulated-transform="translate(10, 20) rotate(45)"
            transform="rotate(45)"
          />
        </g>,
      }
    `);
  });

  it("handles deeply nested groups with multiple ID'd elements", () => {
    const tree = (
      <g transform="translate(100, 0)">
        <g transform="rotate(90)">
          <rect id="r1" />
          <circle id="c1" transform="scale(0.5)" />
        </g>
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          data-accumulated-transform="translate(100, 0) rotate(90)"
          id="r1"
          transform="translate(100, 0) rotate(90)"
        />,
        "c1" => <circle
          data-accumulated-transform="translate(100, 0) rotate(90) scale(0.5)"
          id="c1"
          transform="translate(100, 0) rotate(90) scale(0.5)"
        />,
        "" => <g
          data-accumulated-transform="translate(100, 0)"
          transform="translate(100, 0)"
        >
          <g
            data-accumulated-transform="translate(100, 0) rotate(90)"
            transform="rotate(90)"
          />
        </g>,
      }
    `);
  });

  it("preserves other props on ID'd elements", () => {
    const tree = (
      <g transform="translate(10, 20)">
        <rect id="r1" x={5} y={10} fill="red" />
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          data-accumulated-transform="translate(10, 20)"
          fill="red"
          id="r1"
          transform="translate(10, 20)"
          x={5}
          y={10}
        />,
        "" => <g
          data-accumulated-transform="translate(10, 20)"
          transform="translate(10, 20)"
        />,
      }
    `);
  });

  it("handles elements without IDs", () => {
    const tree = (
      <g>
        <rect />
        <circle id="c1" />
        <line />
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "c1" => <circle
          id="c1"
        />,
        "" => <g>
          <rect />
          <line />
        </g>,
      }
    `);
  });

  it("handles mixed nesting levels", () => {
    const tree = (
      <>
        <rect id="r1" transform="translate(0, 0)" />
        <g transform="translate(10, 10)">
          <circle id="c1" />
        </g>
      </>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          data-accumulated-transform="translate(0, 0)"
          id="r1"
          transform="translate(0, 0)"
        />,
        "c1" => <circle
          data-accumulated-transform="translate(10, 10)"
          id="c1"
          transform="translate(10, 10)"
        />,
        "" => <React.Fragment>
          <g
            data-accumulated-transform="translate(10, 10)"
            transform="translate(10, 10)"
          />
        </React.Fragment>,
      }
    `);
  });

  it("handles a <g> with an id", () => {
    const tree = (
      <g id="group1" transform="translate(50, 50)">
        <rect />
        <circle />
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "group1" => <g
          data-accumulated-transform="translate(50, 50)"
          id="group1"
          transform="translate(50, 50)"
        >
          <rect
            data-accumulated-transform="translate(50, 50)"
          />
          <circle
            data-accumulated-transform="translate(50, 50)"
          />
        </g>,
      }
    `);
  });

  it("handles nested <g> with IDs", () => {
    const tree = (
      <>
        <g transform="translate(10, 10)">
          <g id="inner" transform="rotate(45)">
            <rect />
          </g>
        </g>
      </>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "inner" => <g
          data-accumulated-transform="translate(10, 10) rotate(45)"
          id="inner"
          transform="translate(10, 10) rotate(45)"
        >
          <rect
            data-accumulated-transform="translate(10, 10) rotate(45)"
          />
        </g>,
        "" => <React.Fragment>
          <g
            data-accumulated-transform="translate(10, 10)"
            transform="translate(10, 10)"
          />
        </React.Fragment>,
      }
    `);
  });

  it("works with non-fragment root (like <g>)", () => {
    const tree = (
      <g className="wrapper">
        <g transform="translate(100, 100)">
          <rect id="r1" />
          <circle id="c1" />
        </g>
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          data-accumulated-transform="translate(100, 100)"
          id="r1"
          transform="translate(100, 100)"
        />,
        "c1" => <circle
          data-accumulated-transform="translate(100, 100)"
          id="c1"
          transform="translate(100, 100)"
        />,
        "" => <g
          className="wrapper"
        >
          <g
            data-accumulated-transform="translate(100, 100)"
            transform="translate(100, 100)"
          />
        </g>,
      }
    `);
  });

  it("extracts nested IDs (ID inside ID)", () => {
    const tree = (
      <g transform="translate(10, 10)">
        <g id="outer" transform="rotate(45)">
          <rect id="inner" x={5} />
          <circle />
        </g>
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "inner" => <rect
          data-accumulated-transform="translate(10, 10) rotate(45)"
          id="inner"
          transform="translate(10, 10) rotate(45)"
          x={5}
        />,
        "outer" => <g
          data-accumulated-transform="translate(10, 10) rotate(45)"
          id="outer"
          transform="translate(10, 10) rotate(45)"
        >
          <circle
            data-accumulated-transform="translate(10, 10) rotate(45)"
          />
        </g>,
        "" => <g
          data-accumulated-transform="translate(10, 10)"
          transform="translate(10, 10)"
        />,
      }
    `);
  });

  it("accumulateTransforms adds data-accumulated-transform to all elements", () => {
    const tree = (
      <g transform="translate(10, 20)">
        <g transform="rotate(30)">
          <rect id="r1" />
        </g>
      </g>
    );

    expect(accumulateTransforms(tree)).toMatchInlineSnapshot(`
      <g
        data-accumulated-transform="translate(10, 20)"
        transform="translate(10, 20)"
      >
        <g
          data-accumulated-transform="translate(10, 20) rotate(30)"
          transform="rotate(30)"
        >
          <rect
            data-accumulated-transform="translate(10, 20) rotate(30)"
            id="r1"
          />
        </g>
      </g>
    `);
  });

  it("accumulateTransforms preserves text nodes", () => {
    const tree = (
      <g transform="translate(50, 100)">
        <text x={10} y={20}>
          hello world
        </text>
        <rect />
      </g>
    );

    expect(accumulateTransforms(tree)).toMatchInlineSnapshot(`
      <g
        data-accumulated-transform="translate(50, 100)"
        transform="translate(50, 100)"
      >
        <text
          data-accumulated-transform="translate(50, 100)"
          x={10}
          y={20}
        >
          hello world
        </text>
        <rect
          data-accumulated-transform="translate(50, 100)"
        />
      </g>
    `);
  });

  it("handles <text> elements with IDs", () => {
    const tree = (
      <g transform="translate(50, 100)">
        <text id="label1" x={10} y={20}>
          hi
        </text>
        <rect id="r1" />
      </g>
    );

    expect(hoistSvg(accumulateTransforms(tree))).toMatchInlineSnapshot(`
      Map {
        "label1" => <text
          data-accumulated-transform="translate(50, 100)"
          id="label1"
          transform="translate(50, 100)"
          x={10}
          y={20}
        >
          hi
        </text>,
        "r1" => <rect
          data-accumulated-transform="translate(50, 100)"
          id="r1"
          transform="translate(50, 100)"
        />,
        "" => <g
          data-accumulated-transform="translate(50, 100)"
          transform="translate(50, 100)"
        />,
      }
    `);
  });

  it("throws error if data-z-index is set without id", () => {
    const tree = (
      <g>
        <rect data-z-index={5} x={10} y={10} />
      </g>
    );

    expect(() => hoistSvg(accumulateTransforms(tree))).toThrow(
      /data-z-index can only be set on elements with an id attribute/
    );
  });

  it("allows data-z-index on elements with id", () => {
    const tree = (
      <g>
        <rect id="r1" data-z-index={5} x={10} y={10} />
      </g>
    );

    expect(() => hoistSvg(accumulateTransforms(tree))).not.toThrow();
  });

  it("throws error if duplicate IDs are found at same level", () => {
    const tree = (
      <g>
        <rect id="duplicate" x={10} y={10} />
        <circle id="duplicate" cx={50} cy={50} r={20} />
      </g>
    );

    expect(() => hoistSvg(accumulateTransforms(tree))).toThrow(
      /Duplicate id "duplicate" found in SVG tree/
    );
  });

  it("throws error if duplicate IDs are found at different levels", () => {
    const tree = (
      <g>
        <rect id="duplicate" x={10} y={10} />
        <g transform="translate(100, 100)">
          <circle id="duplicate" cx={50} cy={50} r={20} />
        </g>
      </g>
    );

    expect(() => hoistSvg(accumulateTransforms(tree))).toThrow(
      /Duplicate id "duplicate" found in SVG tree/
    );
  });

  it("throws error if duplicate IDs are found in nested groups", () => {
    const tree = (
      <g>
        <g id="outer">
          <rect id="inner" x={10} y={10} />
        </g>
        <g transform="translate(100, 100)">
          <circle id="inner" cx={50} cy={50} r={20} />
        </g>
      </g>
    );

    expect(() => hoistSvg(accumulateTransforms(tree))).toThrow(
      /Duplicate id "inner" found in SVG tree/
    );
  });
});
