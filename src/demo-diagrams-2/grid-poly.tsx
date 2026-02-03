import _ from "lodash";
import { amb, produceAmb, require } from "../amb";
import { span } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { Vec2 } from "../math/vec2";
import { translate } from "../svgx/helpers";
import { uPairs } from "../utils";

export namespace GridPoly {
  export type State = {
    w: number;
    h: number;
    points: Vec2[];
  };

  export const state1: State = {
    w: 6,
    h: 6,
    points: [Vec2(1, 1), Vec2(4, 2), Vec2(3, 5), Vec2(1, 4)],
  };

  export const stateSmol: State = {
    w: 2,
    h: 2,
    points: [Vec2(0, 0), Vec2(1, 1)],
  };

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    const TILE_SIZE = 50;

    return (
      <g>
        {/* Grid points */}
        {_.range(state.w).map((x) =>
          _.range(state.h).map((y) => (
            <circle cx={x * TILE_SIZE} cy={y * TILE_SIZE} r={5} fill="gray" />
          ))
        )}

        {/* Polygon edges */}
        {state.points.map((pt, idx) => {
          const nextPt = state.points[(idx + 1) % state.points.length];
          return (
            <line
              {...pt.mul(TILE_SIZE).xy1()}
              {...nextPt.mul(TILE_SIZE).xy2()}
              stroke="black"
              strokeWidth={2}
            />
          );
        })}

        {/* Draggable polygon vertices */}
        {state.points.map((pt, idx) => (
          <circle
            id={`vertex-${idx}`}
            transform={translate(pt.x * TILE_SIZE, pt.y * TILE_SIZE)}
            r={10}
            fill="black"
            data-on-drag={drag(() =>
              span(
                produceAmb(state, (draft) => {
                  draft.points[idx] = Vec2(
                    amb(_.range(state.w)),
                    amb(_.range(state.h))
                  );
                  require(uPairs(draft.points).every(([p1, p2]) => !p1.eq(p2)));
                })
              )
            )}
          />
        ))}
      </g>
    );
  };
}
