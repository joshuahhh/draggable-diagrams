import { describe, expect, it } from "vitest";
import React from "react";
import { prettyPrintToString } from "./pretty-print";

describe("prettyPrintToString", () => {
  it("should format with and without ANSI codes", () => {
    const longArray = Array.from({ length: 20 }, (_, i) => i);

    const withoutAnsi = prettyPrintToString(longArray, 200, false);
    const withAnsi = prettyPrintToString(longArray, 200, true);

    // Count ANSI escape sequences
    const ansiMatches = withAnsi.match(/\x1b\[\d+m/g);
    expect(ansiMatches).toBeTruthy();
    expect(withAnsi.length).toBeGreaterThan(withoutAnsi.length);
  });

  it("should format long arrays inline with wide printWidth", () => {
    const longArray = Array.from({ length: 20 }, (_, i) => i);
    const result = prettyPrintToString(longArray, 200, false);

    // With width 200, this should be all on one line
    expect(result).not.toContain("\n");
  });

  it("should format long arrays with line breaks when narrow", () => {
    const longArray = Array.from({ length: 20 }, (_, i) => i);
    const result = prettyPrintToString(longArray, 40, false);

    // With width 40, this should break across multiple lines
    expect(result).toContain("\n");
  });

  it("should format objects with wide printWidth", () => {
    const obj = {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
      f: 6,
      g: 7,
      h: 8,
    };
    const result = prettyPrintToString(obj, 200, false);

    // Should be relatively compact
    expect(result.split("\n").length).toBeLessThan(10);
  });

  it("should format nested structures", () => {
    const nested = {
      users: [
        { id: 1, name: "Alice", age: 30 },
        { id: 2, name: "Bob", age: 25 },
        { id: 3, name: "Charlie", age: 35 },
      ],
    };

    const wide = prettyPrintToString(nested, 200, false);
    const narrow = prettyPrintToString(nested, 40, false);

    // Wide version should have fewer line breaks
    expect(wide.split("\n").length).toBeLessThan(narrow.split("\n").length);
  });

  it("should handle very long arrays", () => {
    const veryLongArray = Array.from({ length: 50 }, (_, i) => i + 1);

    const wide = prettyPrintToString(veryLongArray, 300, false);
    const narrow = prettyPrintToString(veryLongArray, 60, false);

    // Both should contain all elements
    expect(wide).toContain("49");
    expect(narrow).toContain("49");

    // Narrow should have more line breaks
    expect(narrow.split("\n").length).toBeGreaterThan(wide.split("\n").length);
  });

  it("should detect circular references in objects", () => {
    const obj: any = { a: 1, b: 2 };
    obj.self = obj;

    const result = prettyPrintToString(obj, 80, false);

    expect(result).toBe("{a: 1, b: 2, self: [Circular]}");
  });

  it("should detect circular references in arrays", () => {
    const arr: any[] = [1, 2, 3];
    arr.push(arr);

    const result = prettyPrintToString(arr, 80, false);

    expect(result).toBe("[1, 2, 3, [Circular]]");
  });

  it("should detect circular references in nested structures", () => {
    const parent: any = { name: "parent", children: [] };
    const child: any = { name: "child", parent: parent };
    parent.children.push(child);

    const result = prettyPrintToString(parent, 80, false);

    expect(result).toBe(
      '{name: "parent", children: [{name: "child", parent: [Circular]}]}',
    );
  });

  it("should print repeated references distinctly", () => {
    const shared = { value: 42 };
    const obj = { first: shared, second: shared };

    const result = prettyPrintToString(obj, 80, false);

    expect(result).toBe("{first: {value: 42}, second: {value: 42}}");
  });

  it("should print JSX elements", () => {
    const element = React.createElement("div", { className: "foo" }, "hello");
    const result = prettyPrintToString(element, 80, false);

    expect(result).toBe('<div className="foo">hello</div>');
  });

  it("should print JSX elements with no children", () => {
    const element = React.createElement("br", {});
    const result = prettyPrintToString(element, 80, false);

    expect(result).toBe("<br />");
  });

  it("should print JSX elements with props and no children", () => {
    const element = React.createElement("img", { src: "test.png", alt: "test" });
    const result = prettyPrintToString(element, 80, false);

    expect(result).toBe('<img src="test.png" alt="test" />');
  });

  it("should print nested JSX elements", () => {
    const element = React.createElement(
      "div",
      {},
      React.createElement("span", {}, "hello"),
      React.createElement("span", {}, "world")
    );
    const result = prettyPrintToString(element, 80, false);

    expect(result).toBe("<div><span>hello</span><span>world</span></div>");
  });

  it("should break props onto new lines when narrow", () => {
    const element = React.createElement("img", {
      src: "test.png",
      alt: "description",
      width: 100,
      height: 200,
    });
    const result = prettyPrintToString(element, 30, false);

    expect(result).toContain("\n");
  });
});
