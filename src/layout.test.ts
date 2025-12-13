import { describe, expect, test } from "vitest";
import { overlapIntervals } from "./layout";

describe("overlapIntervals", () => {
  function checkCase(
    aLength: number,
    aAnchor: number,
    bLength: number,
    bAnchor: number,
    aOffset: number,
    bOffset: number,
    length: number
  ) {
    expect(overlapIntervals({ aLength, aAnchor, bLength, bAnchor })).toEqual({
      aOffset,
      bOffset,
      length,
    });
    expect(
      overlapIntervals({
        aLength: bLength,
        aAnchor: bAnchor,
        bLength: aLength,
        bAnchor: aAnchor,
      })
    ).toEqual({ aOffset: bOffset, bOffset: aOffset, length });
  }

  test("same-size cases", () => {
    checkCase(10, 0, 10, 0, 0, 0, 10);
    checkCase(10, 2, 10, 5, 0, 0, 10);
    checkCase(10, 5, 10, 5, 0, 0, 10);
    checkCase(10, 2, 10, 8, 0, 0, 10);
  });

  test("centered cases", () => {
    checkCase(2, 1, 10, 5, 4, 0, 10);
  });

  test("edge-constrained cases", () => {
    checkCase(10, 2, 4, 3, 0, 0, 10);
    checkCase(10, 8, 4, 1, 0, 6, 10);
  });
});
