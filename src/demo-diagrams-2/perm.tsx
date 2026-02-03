import { produce } from "immer";
import _ from "lodash";
import { span } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { translate } from "../svgx/helpers";

export namespace Perm {
  export type State = {
    perm: string[];
  };

  export const state1: State = {
    perm: ["A", "B", "C", "D", "E"],
  };

  export const manipulable: Manipulable<State> = ({
    state,
    drag,
    draggedId,
  }) => {
    const TILE_SIZE = 50;

    return (
      <g>
        {state.perm.map((p, idx) => {
          const isDragged = p === draggedId;
          return (
            <g
              id={p}
              transform={translate(idx * TILE_SIZE, isDragged ? -10 : 0)}
              data-z-index={isDragged ? 1 : 0}
              data-on-drag={drag(() => {
                const draggedIdx = state.perm.indexOf(p);
                return span(
                  _.range(state.perm.length).map((idx) =>
                    produce(state, (draft) => {
                      draft.perm.splice(draggedIdx, 1);
                      draft.perm.splice(idx, 0, p);
                    })
                  )
                );
              })}
            >
              <rect
                x={0}
                y={0}
                width={TILE_SIZE}
                height={TILE_SIZE}
                stroke="black"
                strokeWidth={2}
                fill="white"
              />
              <text
                x={TILE_SIZE / 2}
                y={TILE_SIZE / 2}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize={20}
                fill="black"
              >
                {p}
              </text>
            </g>
          );
        })}
      </g>
    );
  };
}
