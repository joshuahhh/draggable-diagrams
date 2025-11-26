import { Manipulable, numAtPath } from "./manipulable";
import { circle, group, line } from "./shape";
import { Vec2 } from "./vec2";

type AngleState = {
  angle: number;
};

export const manipulableAngleViaTransform: Manipulable<AngleState> = {
  sourceFile: "manipulable-angle-via-transform.ts",

  render(state) {
    const radius = 100;

    return group(
      circle({
        center: Vec2(0),
        radius: 20,
        fillStyle: "black",
      })
        .draggable("knob")
        .translate(Vec2(radius, 0)),
      line({
        from: Vec2(0),
        to: Vec2(radius, 0),
        strokeStyle: "black",
        lineWidth: 4,
      }),
    )
      .rotate(Vec2(0), state.angle)
      .translate(Vec2(100, 100));
  },

  onDrag(_state, _draggableKey) {
    return numAtPath(["angle"]);
  },
};

export const stateAngle = {
  angle: 0,
};
