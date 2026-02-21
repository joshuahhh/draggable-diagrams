import { describe, expect, it } from "vitest";
import { findElement } from ".";

describe("findElement", () => {
  it("accumulates transforms through nested groups", () => {
    const tree = (
      <g transform="translate(10, 20)">
        <g transform="rotate(45)">
          <rect id="target" />
        </g>
      </g>
    );

    const found = findElement(tree, (el) => el.props.id === "target");
    expect.assert(found);
    expect(found.element.type).toBe("rect");
    expect(found.accumulatedTransform).toBe("translate(10, 20) rotate(45)");
  });

  it("includes the matched element's own transform", () => {
    const tree = (
      <g transform="translate(10, 20)">
        <rect id="target" transform="scale(2)" />
      </g>
    );

    const found = findElement(tree, (el) => el.props.id === "target");
    expect.assert(found);
    expect(found.accumulatedTransform).toBe("translate(10, 20) scale(2)");
  });

  it("returns empty string when no transforms exist", () => {
    const tree = (
      <g>
        <rect id="target" />
      </g>
    );

    const found = findElement(tree, (el) => el.props.id === "target");
    expect.assert(found);
    expect(found.accumulatedTransform).toBe("");
  });

  it("returns null when no element matches", () => {
    const tree = (
      <g>
        <rect id="other" />
      </g>
    );

    const found = findElement(tree, (el) => el.props.id === "nope");
    expect(found).toBe(null);
  });

  it("accumulates transform when matching the root element", () => {
    const tree = <g transform="translate(5, 5)" />;

    const found = findElement(tree, (el) => el.type === "g");
    expect.assert(found);
    expect(found.accumulatedTransform).toBe("translate(5, 5)");
  });
});
