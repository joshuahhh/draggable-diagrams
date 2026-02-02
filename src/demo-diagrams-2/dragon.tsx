import { vary } from "../DragSpec2";
import { Vec2 } from "../math/vec2";
import { Manipulable } from "../manipulable2";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";

export namespace Dragon {
  export type State = {
    from: { x: number; y: number };
    to: { x: number; y: number };
    squareness: number;
    tilt: number;
  };

  export const state1: State = {
    from: { x: 300, y: 150 },
    to: { x: 0, y: 39 },
    squareness: 0.4,
    tilt: 0,
  };

  const LEVELS = 7;

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    function dragon(p1: Vec2, p2: Vec2, dir: number, level: number): Svgx[] {
      if (level == 0) {
        return [
          <line
            transform={translate(p1)}
            {...p2.sub(p1).xy2()}
            stroke="black"
            strokeWidth={4}
            strokeLinecap="round"
            data-on-drag={drag(() => vary(state, ["squareness"]))}
          />,
        ];
      } else {
        const mid = p1.mid(p2).add(
          p2
            .sub(p1)
            .mul(state.squareness * dir)
            .rotateDeg(90 + state.tilt)
        );
        return [
          ...dragon(p1, mid, -1, level - 1),
          ...dragon(mid, p2, 1, level - 1),
        ];
      }
    }

    return (
      <g>
        {dragon(Vec2(state.from), Vec2(state.to), -1, LEVELS)}
        <circle
          transform={translate(state.from)}
          r={8}
          fill="red"
          data-on-drag={drag(() =>
            vary(state, ["from", "x"], ["from", "y"])
          )}
        />
        <circle
          transform={translate(state.to)}
          r={8}
          fill="blue"
          data-on-drag={drag(() =>
            vary(state, ["to", "x"], ["to", "y"])
          )}
        />
      </g>
    );
  };
}
