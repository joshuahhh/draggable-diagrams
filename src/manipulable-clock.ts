import { Manipulable, numAtPath } from "./manipulable";
import { circle, Diagram, group, line } from "./shape";
import { Vec2 } from "./vec2";

type ClockState = {
  hours: number;
};

export const manipulableClock: Manipulable<ClockState> = {
  sourceFile: "manipulable-clock.ts",

  render(state) {
    const center = Vec2(100, 100);

    function hand(
      name: string,
      angle: number,
      length: number,
      lineWidth_: number,
    ): Diagram {
      const handEnd = Vec2(length, 0).rotate(angle).add(center);
      return group(
        circle({
          center: Vec2(0),
          radius: 10,
          fillStyle: "black",
        })
          .draggable(name)
          .translate(handEnd),
        line({
          from: center,
          to: handEnd,
          strokeStyle: "black",
          lineWidth: lineWidth_,
        }),
      );
    }

    return group(
      hand("hour", (state.hours * (2 * Math.PI)) / 12 - Math.PI / 2, 60, 6),
      hand("minute", (state.hours * (2 * Math.PI)) / 1 - Math.PI / 2, 80, 4),
      hand("second", 60 * (state.hours * (2 * Math.PI)) - Math.PI / 2, 90, 2),
    );
  },

  onDrag(_state, _draggableKey) {
    return numAtPath(["hours"]);
  },
};

export const stateClock = {
  hours: 4.333333,
};
