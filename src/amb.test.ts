import _ from "lodash";
import { describe, expect, it } from "vitest";
import { amb, fail, generateAmb, produceAmb, require, runAmb } from "./amb";

describe("amb", () => {
  it("returns all options from a single amb", () => {
    const results = runAmb(() => {
      return amb([1, 2, 3]);
    });

    expect(results).toEqual([1, 2, 3]);
  });

  it("computes cartesian product with two ambs", () => {
    const results = runAmb(() => {
      const a = amb(["a", "b"]);
      const b = amb([1, 2]);
      return [a, b];
    });

    expect(results).toEqual([
      ["a", 1],
      ["a", 2],
      ["b", 1],
      ["b", 2],
    ]);
  });

  it("computes cartesian product with three ambs", () => {
    const results = runAmb(() => {
      const a = amb([1, 2]);
      const b = amb([10, 20]);
      const c = amb([100, 200]);
      return a + b + c;
    });

    expect(results).toEqual([
      111, // 1 + 10 + 100
      211, // 1 + 10 + 200
      121, // 1 + 20 + 100
      221, // 1 + 20 + 200
      112, // 2 + 10 + 100
      212, // 2 + 10 + 200
      122, // 2 + 20 + 100
      222, // 2 + 20 + 200
    ]);
  });

  it("uses amb values in computations", () => {
    const results = runAmb(() => {
      const x = amb([1, 2, 3]);
      const y = amb([10, 20]);
      return x * y;
    });

    expect(results).toEqual([10, 20, 20, 40, 30, 60]);
  });

  it("works with single option", () => {
    const results = runAmb(() => {
      return amb([42]);
    });

    expect(results).toEqual([42]);
  });

  it("works with no options", () => {
    const results = runAmb(() => {
      return amb([]);
    });

    expect(results).toEqual([]);
  });

  it("works with nested function calls", () => {
    const helper = () => amb([1, 2]);

    const results = runAmb(() => {
      const a = helper();
      const b = helper();
      return a + b;
    });

    expect(results).toEqual([2, 3, 3, 4]);
  });

  it("handles fail() to prune branches", () => {
    const results = runAmb(() => {
      const x = amb([1, 2, 3, 4, 5]);
      if (x % 2 === 0) {
        fail(); // Skip even numbers
      }
      return x;
    });

    expect(results).toEqual([1, 3, 5]);
  });

  it("handles require() to filter results", () => {
    const results = runAmb(() => {
      const x = amb([1, 2, 3, 4, 5]);
      const y = amb([1, 2, 3, 4, 5]);
      require(x + y === 7);
      return [x, y];
    });

    expect(results).toEqual([
      [2, 5],
      [3, 4],
      [4, 3],
      [5, 2],
    ]);
  });

  it("solves the Pythagorean triples problem", () => {
    const results = runAmb(() => {
      const a = amb([1, 2, 3, 4, 5]);
      const b = amb([1, 2, 3, 4, 5]);
      const c = amb([1, 2, 3, 4, 5]);
      require(a * a + b * b === c * c);
      require(a < b); // Avoid duplicates
      return [a, b, c];
    });

    expect(results).toEqual([[3, 4, 5]]);
  });

  it("finds all ways to make change", () => {
    const results = runAmb(() => {
      const quarters = amb([0, 1, 2]);
      const dimes = amb([0, 1, 2]);
      const nickels = amb([0, 1, 2]);
      const pennies = amb([0, 1, 2, 3, 4]);

      const total = quarters * 25 + dimes * 10 + nickels * 5 + pennies * 1;
      require(total === 37);

      return { quarters, dimes, nickels, pennies };
    });

    // 37 cents can be made as:
    // 1 quarter (25) + 2 nickels (10) + 2 pennies (2) = 37
    // 1 quarter (25) + 1 dime (10) + 0 nickels (0) + 2 pennies (2) = 37
    expect(results).toEqual([
      { quarters: 1, dimes: 0, nickels: 2, pennies: 2 },
      { quarters: 1, dimes: 1, nickels: 0, pennies: 2 },
    ]);
  });

  it("propagates non-amb errors", () => {
    expect(() => {
      runAmb(() => {
        const x = amb([1, 2]);
        if (x === 2) {
          throw new Error("Custom error");
        }
        return x;
      });
    }).toThrow("Custom error");
  });

  it("works with object values", () => {
    const results = runAmb(() => {
      const obj = amb([{ x: 1 }, { x: 2 }]);
      return obj.x;
    });

    expect(results).toEqual([1, 2]);
  });
});

describe("runAmbGenerator", () => {
  it("yields results one at a time", () => {
    const gen = generateAmb(() => {
      const a = amb([1, 2]);
      const b = amb([10, 20]);
      return a + b;
    });

    const results = [...gen];
    expect(results).toEqual([11, 21, 12, 22]);
  });

  it("can be used to get first result only", () => {
    const gen = generateAmb(() => {
      const x = amb([1, 2, 3, 4, 5]);
      const y = amb([1, 2, 3, 4, 5]);
      require(x + y === 7);
      return [x, y];
    });

    const first = gen.next().value;
    expect(first).toEqual([2, 5]);
  });

  it("handles fail() correctly", () => {
    const gen = generateAmb(() => {
      const x = amb([1, 2, 3, 4, 5]);
      if (x % 2 === 0) fail();
      return x;
    });

    const results = [...gen];
    expect(results).toEqual([1, 3, 5]);
  });
});

describe("produceAmb", () => {
  it("basically works", () => {
    const state = [1, 2];
    const results = produceAmb(state, (draft) => {
      draft.splice(amb(_.range(state.length + 1)), 0, 100);
      draft.splice(amb(_.range(state.length + 2)), 0, 200);
    });

    expect(results).toEqual([
      [200, 100, 1, 2],
      [100, 200, 1, 2],
      [100, 1, 200, 2],
      [100, 1, 2, 200],
      [200, 1, 100, 2],
      [1, 200, 100, 2],
      [1, 100, 200, 2],
      [1, 100, 2, 200],
      [200, 1, 2, 100],
      [1, 200, 2, 100],
      [1, 2, 200, 100],
      [1, 2, 100, 200],
    ]);
  });
});
