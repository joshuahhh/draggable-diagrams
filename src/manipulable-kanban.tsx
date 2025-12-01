import { produce } from "immer";
import _ from "lodash";
import { span } from "./DragSpec";
import { Manipulable, translate } from "./manipulable";

export namespace Kanban {
  export type State = {
    lanes: string[][];
  };

  export const manipulable: Manipulable<State> = ({
    state,
    drag,
    draggedId,
  }) => {
    const TILE_SIZE = 50;

    return (
      <g>
        {state.lanes.map((lane, laneIdx) => {
          return (
            <g
              id={`lane-${laneIdx}`}
              transform={translate(laneIdx * TILE_SIZE, 0)}
              //  data-z-index={isDragged ? 1 : 0}
              // data-on-drag={drag(() => {
              //   const draggedIdx = state.perm.indexOf(p);
              //   return span(
              //     _.range(state.perm.length).map((idx) =>
              //       produce(state, (draft) => {
              //         draft.perm.splice(draggedIdx, 1);
              //         draft.perm.splice(idx, 0, p);
              //       })
              //     )
              //   );
              // })}
            >
              <rect
                x={0}
                y={-10}
                width={TILE_SIZE}
                height={10}
                stroke="black"
                strokeWidth={2}
                fill="white"
              />

              {laneIdx === state.lanes.length - 1 && (
                <rect
                  id="resizer"
                  x={TILE_SIZE + 5}
                  y={-10}
                  width={10}
                  height={10}
                  stroke="black"
                  strokeWidth={2}
                  fill="white"
                  data-on-drag={drag(() =>
                    span([
                      produce(state, (draft) => {
                        draft.lanes.push([]);
                      }),
                      produce(state, (draft) => {
                        const cards = draft.lanes[draft.lanes.length - 1];

                        const prev = draft.lanes[draft.lanes.length - 2];
                        if (prev) {
                          prev.push(...cards);
                        }

                        draft.lanes.pop();
                      }),
                    ])
                  )}
                />
              )}

              {lane.map((item, cardIdx) => (
                <g
                  id={item}
                  transform={translate(0, cardIdx * TILE_SIZE)}
                  data-on-drag={drag(() => {
                    return span(
                      _.range(state.lanes.length).flatMap((newLaneIdx) => {
                        const cardsOfLane = state.lanes[laneIdx];

                        return cardsOfLane.map((card, index) =>
                          produce(state, (draft) => {
                            draft.lanes[laneIdx] = draft.lanes[laneIdx].filter(
                              (card) => card !== item
                            );
                            draft.lanes[newLaneIdx].splice(index, 0, item);
                          })
                        );
                      })
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
                    {item}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </g>
    );
  };

  export const state1: State = {
    lanes: [["A"], ["B", "D"], ["C"]],
  };
}
