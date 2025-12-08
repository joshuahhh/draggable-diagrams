import { numAtPath } from "../DragSpec";
import { Manipulable, translate } from "../manipulable";
import { Vec2 } from "../math/vec2";

export namespace Angle {
  export type State = {
    angle: number;
  };

  export const state1: State = {
    angle: 0,
  };

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    const center = Vec2(100, 100);
    const radius = 100;
    const knobPos = Vec2(radius, 0).rotateDeg(state.angle).add(center);

    return (
      <g>
        <circle
          transform={translate(knobPos)}
          cx={0}
          cy={0}
          r={20}
          fill="black"
          data-on-drag={drag(numAtPath(["angle"]))}
        />
        <line
          x1={center.x}
          y1={center.y}
          x2={knobPos.x}
          y2={knobPos.y}
          stroke="black"
          strokeWidth={4}
        />
      </g>
    );
  };
}
