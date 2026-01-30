import { vary } from "../DragSpec";
import { Manipulable } from "../manipulable";
import { Vec2 } from "../math/vec2";
import { translate } from "../svgx/helpers";

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
          r={20}
          fill="black"
          data-on-drag={drag(vary(["angle"]))}
        />
        <line
          {...center.xy1()}
          {...knobPos.xy2()}
          stroke="black"
          strokeWidth={4}
        />
      </g>
    );
  };
}
