import { describe, expect, it } from "vitest";
import { assignPaths, findByPath, getPath } from "./path";

describe("assignPaths", () => {
  it("assigns numerical paths to nested elements", () => {
    const tree = (
      <g>
        <rect />
        <circle />
      </g>
    );

    expect(assignPaths(tree)).toMatchInlineSnapshot(`
      <g
        data-path="/"
      >
        <rect
          data-path="/0/"
        />
        <circle
          data-path="/1/"
        />
      </g>
    `);
  });

  it("handles deeply nested elements", () => {
    const tree = (
      <g>
        <g>
          <rect />
          <circle />
        </g>
      </g>
    );

    expect(assignPaths(tree)).toMatchInlineSnapshot(`
      <g
        data-path="/"
      >
        <g
          data-path="/0/"
        >
          <rect
            data-path="/0/0/"
          />
          <circle
            data-path="/0/1/"
          />
        </g>
      </g>
    `);
  });

  it("uses id when present", () => {
    const tree = (
      <g>
        <rect id="my-rect" />
        <circle />
      </g>
    );

    expect(assignPaths(tree)).toMatchInlineSnapshot(`
      <g
        data-path="/"
      >
        <rect
          data-path="my-rect/"
          id="my-rect"
        />
        <circle
          data-path="/1/"
        />
      </g>
    `);
  });

  it("id replaces the path and children append to it", () => {
    const tree = (
      <g>
        <g id="container">
          <rect />
          <circle />
        </g>
      </g>
    );

    expect(assignPaths(tree)).toMatchInlineSnapshot(`
      <g
        data-path="/"
      >
        <g
          data-path="container/"
          id="container"
        >
          <rect
            data-path="container/0/"
          />
          <circle
            data-path="container/1/"
          />
        </g>
      </g>
    `);
  });

  it("handles mixed id and relative paths", () => {
    const tree = (
      <g>
        <g>
          <rect id="special" />
          <circle />
        </g>
        <line />
      </g>
    );

    expect(assignPaths(tree)).toMatchInlineSnapshot(`
      <g
        data-path="/"
      >
        <g
          data-path="/0/"
        >
          <rect
            data-path="special/"
            id="special"
          />
          <circle
            data-path="/0/1/"
          />
        </g>
        <line
          data-path="/1/"
        />
      </g>
    `);
  });

  it("preserves existing props", () => {
    const tree = (
      <g className="my-class">
        <rect x={10} y={20} fill="red" />
      </g>
    );

    expect(assignPaths(tree)).toMatchInlineSnapshot(`
      <g
        className="my-class"
        data-path="/"
      >
        <rect
          data-path="/0/"
          fill="red"
          x={10}
          y={20}
        />
      </g>
    `);
  });

  it("throws error when id contains a slash", () => {
    const tree = (
      <g>
        <rect id="root/child" />
      </g>
    );

    expect(() => assignPaths(tree)).toThrow(
      'Element id "root/child" contains a slash, which is not allowed',
    );
  });

  it("throws error when id contains multiple slashes", () => {
    const tree = (
      <g>
        <rect id="a/b/c" />
      </g>
    );

    expect(() => assignPaths(tree)).toThrow(
      'Element id "a/b/c" contains a slash, which is not allowed',
    );
  });
});

describe("findByPath", () => {
  it("finds root element by path", () => {
    const tree = assignPaths(
      <g>
        <rect />
        <circle />
      </g>,
    );

    const found = findByPath("/", tree);
    expect.assert(found);
    expect(found.type).toBe("g");
    expect(getPath(found)).toBe("/");
  });

  it("finds child element by numerical path", () => {
    const tree = assignPaths(
      <g>
        <rect />
        <circle />
      </g>,
    );

    const found = findByPath("/1/", tree);
    expect.assert(found);
    expect(found.type).toBe("circle");
  });

  it("finds deeply nested element", () => {
    const tree = assignPaths(
      <g>
        <g>
          <rect />
          <circle />
        </g>
      </g>,
    );

    const found = findByPath("/0/1/", tree);
    expect.assert(found);
    expect(found.type).toBe("circle");
  });

  it("finds element by id-based path", () => {
    const tree = assignPaths(
      <g>
        <rect id="my-rect" />
        <circle />
      </g>,
    );

    const found = findByPath("my-rect/", tree);
    expect.assert(found);
    expect(found.type).toBe("rect");
    expect((found.props as any).id).toBe("my-rect");
  });

  it("finds nested child under id-based path", () => {
    const tree = assignPaths(
      <g>
        <g id="container">
          <rect />
          <circle />
        </g>
      </g>,
    );

    const found = findByPath("container/1/", tree);
    expect.assert(found);
    expect(found.type).toBe("circle");
  });

  it("returns null when path does not exist", () => {
    const tree = assignPaths(
      <g>
        <rect />
      </g>,
    );

    const found = findByPath("/99/", tree);
    expect(found).toBe(null);
  });

  it("returns null for non-existent id path", () => {
    const tree = assignPaths(
      <g>
        <rect id="real" />
      </g>,
    );

    const found = findByPath("fake/", tree);
    expect(found).toBe(null);
  });
});
