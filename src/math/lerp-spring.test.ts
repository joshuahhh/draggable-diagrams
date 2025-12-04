import { describe, expect, it } from "vitest";
import { LerpSpring } from "./lerp-spring";

const numberLerp = (a: number, b: number, t: number): number => a + (b - a) * t;

describe("LerpSpring", () => {
  it("springs from 1 to 0 with typical parameters", () => {
    const spring = new LerpSpring({
      initial: 1,
      time: 0,
      params: {
        omega: 0.01, // spring frequency (rad/ms)
        gamma: 0.005, // damping rate (1/ms)
      },
      lerp: numberLerp,
    });

    const results: number[] = [];
    const target = 0;
    const dt = 16; // ~60fps, in milliseconds

    for (let i = 1; i <= 10; i++) {
      const value = spring.step(i * dt, target);
      results.push(value);
    }

    expect(results).toMatchInlineSnapshot(`
      [
        0.9744,
        0.9258235815325022,
        0.8572808119090053,
        0.7720614720580714,
        0.6736293327287096,
        0.5655201049861139,
        0.45124539497404376,
        0.3342046600719737,
        0.21760680519292544,
        0.10440268518752033,
      ]
    `);
  });
});
