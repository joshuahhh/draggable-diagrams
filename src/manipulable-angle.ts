import { Manipulable } from "./manipulable";
import { circle, group, line } from "./shape";
import { Vec2 } from "./vec2";

type AngleState = {
  angle: number;
};

export const manipulableAngle: Manipulable<AngleState> = {
  sourceFile: "manipulable-angle.ts",

  render(state) {
    const center = Vec2(100, 100);
    const radius = 100;
    const knobPos = Vec2(radius, 0).rotate(state.angle).add(center);

    return group(
      circle({
        center: Vec2(0),
        radius: 20,
        fillStyle: "black",
      })
        .draggable("knob")
        .translate(knobPos),
      line({
        from: center,
        to: knobPos,
        strokeStyle: "black",
        lineWidth: 4,
      }),
    );
  },

  accessibleFrom(_state, _draggableKey) {
    return {
      paramPaths: [["angle"]],
    };
  },
};

export const stateAngle = {
  angle: 0,
};
