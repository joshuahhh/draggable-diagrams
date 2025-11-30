import { describe, expect, it } from "vitest";
import { flattenSvg } from "./jsx-flatten";

describe("flattenSvg", () => {
  it("pulls nodes with IDs to the top level", () => {
    const tree = (
      <g>
        <rect id="r1" />
        <circle id="c1" />
      </g>
    );

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          id="r1"
          transform="translate(10, 20)"
        />,
        "" => <g
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          id="r1"
          transform="translate(10, 20) rotate(45) scale(2)"
        />,
        "" => <g
          transform="translate(10, 20)"
        >
          <g
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          id="r1"
          transform="translate(100, 0) rotate(90)"
        />,
        "c1" => <circle
          id="c1"
          transform="translate(100, 0) rotate(90) scale(0.5)"
        />,
        "" => <g
          transform="translate(100, 0)"
        >
          <g
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          fill="red"
          id="r1"
          transform="translate(10, 20)"
          x={5}
          y={10}
        />,
        "" => <g
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          id="r1"
          transform="translate(0, 0)"
        />,
        "c1" => <circle
          id="c1"
          transform="translate(10, 10)"
        />,
        "" => <React.Fragment>
          <g
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
      Map {
        "group1" => <g
          id="group1"
          transform="translate(50, 50)"
        >
          <rect />
          <circle />
        </g>,
        "" => <g
          id="group1"
          transform="translate(50, 50)"
        >
          <rect />
          <circle />
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
      Map {
        "inner" => <g
          id="inner"
          transform="translate(10, 10) rotate(45)"
        >
          <rect />
        </g>,
        "" => <React.Fragment>
          <g
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          id="r1"
          transform="translate(100, 100)"
        />,
        "c1" => <circle
          id="c1"
          transform="translate(100, 100)"
        />,
        "" => <g
          className="wrapper"
        >
          <g
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

    expect(flattenSvg(tree)).toMatchInlineSnapshot(`
      Map {
        "inner" => <rect
          id="inner"
          transform="translate(10, 10) rotate(45)"
          x={5}
        />,
        "outer" => <g
          id="outer"
          transform="translate(10, 10) rotate(45)"
        >
          <circle />
        </g>,
        "" => <g
          transform="translate(10, 10)"
        />,
      }
    `);
  });

  it("can add accumulated transforms as a prop", () => {
    const tree = (
      <g transform="translate(10, 20)">
        <g transform="rotate(30)">
          <rect id="r1" />
        </g>
      </g>
    );

    expect(flattenSvg(tree, true)).toMatchInlineSnapshot(`
      Map {
        "r1" => <rect
          data-accumulated-transform="translate(10, 20) rotate(30)"
          id="r1"
          transform="translate(10, 20) rotate(30)"
        />,
        "" => <g
          data-accumulated-transform="translate(10, 20)"
          transform="translate(10, 20)"
        >
          <g
            data-accumulated-transform="translate(10, 20) rotate(30)"
            transform="rotate(30)"
          />
        </g>,
      }
    `);
  });
});
