import { produce } from "immer";
import _ from "lodash";
import { detachReattach, TargetStateLike } from "../DragSpec";
import { Manipulable, translate } from "../manipulable";
import { assertDefined } from "../utils";

export namespace ListOfListsSizes {
  export type State = {
    rows: {
      id: string;
      items: { id: string; label: string; w: number; h: number }[];
      color: string;
    }[];
  };

  export const state1: State = {
    rows: [
      {
        id: "row1",
        items: [
          { id: "A1", label: "A1", w: 108, h: 100 },
          { id: "B1", label: "B1", w: 50, h: 50 },
          { id: "C1", label: "C1", w: 50, h: 50 },
        ],
        color: "#f0f4ff",
      },
      {
        id: "row2",
        items: [
          { id: "A2", label: "A2", w: 50, h: 50 },
          { id: "B2", label: "B2", w: 108, h: 50 },
          { id: "C2", label: "C2", w: 50, h: 50 },
        ],
        color: "#fff4f0",
      },
      {
        id: "row3",
        items: [
          { id: "A3", label: "A3", w: 50, h: 50 },
          { id: "B3", label: "B3", w: 50, h: 50 },
          { id: "C3", label: "C3", w: 50, h: 108 },
        ],
        color: "#f0fff4",
      },
    ],
  };

  export const manipulable: Manipulable<State> = ({
    state,
    drag,
    draggedId,
  }) => {
    const TILE_GAP = 8;
    const ROW_PADDING = 8;
    const ROW_GAP = 10;
    const GRIP_WIDTH = 16;
    const GRIP_PADDING = 2;

    // the z-index plan...
    // - when dragging a row:
    //   - 0: non-dragged rows
    //   - 1: non-dragged items
    //   - 2: dragged row
    //   - 3: items in dragged row
    // - when dragging an item:
    //   - 0: rows
    //   - 1: non-dragged items
    //   - 3: dragged item
    // would be nice to not think about this so much

    let y = 0;

    return (
      <g>
        {state.rows.map((row, rowIdx) => {
          const isDraggedRow = draggedId === `row-${row.id}`;
          const origY = y;
          const maxItemHeight = assertDefined(
            _.max(row.items.map((item) => item.h))
          );
          y += maxItemHeight + ROW_PADDING * 2 + ROW_GAP;
          let x = 0;
          return (
            <g
              id={`row-${row.id}`}
              transform={translate(0, origY)}
              data-z-index={isDraggedRow ? 2 : 0}
              data-on-drag={drag(() => {
                const detachedState = produce(state, (draft) => {
                  draft.rows.splice(rowIdx, 1);
                });
                const reattachedStates = _.range(state.rows.length).map(
                  (newIdx) =>
                    produce(detachedState, (draft) => {
                      draft.rows.splice(newIdx, 0, row);
                    })
                );
                return detachReattach(detachedState, reattachedStates);
              })}
            >
              <rect
                width={
                  GRIP_WIDTH +
                  GRIP_PADDING +
                  _.sumBy(row.items, (item) => item.w) +
                  (row.items.length - 1) * TILE_GAP +
                  ROW_PADDING * 2
                }
                height={maxItemHeight + ROW_PADDING * 2}
                fill={row.color}
                stroke="#aaa"
                strokeWidth={1.5}
                rx={6}
              />
              {/* Grip dots */}
              <g opacity={0.35}>
                {[0, 1, 2].map((i) =>
                  [0, 1].map((j) => (
                    <circle
                      cx={GRIP_WIDTH / 2 + 8 * j}
                      cy={(maxItemHeight + ROW_PADDING * 2) / 2 + (i - 1) * 8}
                      r={1.5}
                      fill="#333"
                    />
                  ))
                )}
              </g>
              {row.items.map((p) => {
                const origX = x;
                x += p.w + TILE_GAP;
                return (
                  <g
                    id={p.id}
                    data-z-index={isDraggedRow ? 3 : 1}
                    transform={translate(
                      GRIP_WIDTH + GRIP_PADDING + origX + ROW_PADDING,
                      ROW_PADDING
                    )}
                    data-on-drag={drag(() => {
                      const draggedRowIdx = state.rows.findIndex((r) =>
                        r.items.find((item) => item.id === p.id)
                      );
                      const draggedRow = state.rows[draggedRowIdx];
                      const draggedColIdx = draggedRow.items.findIndex(
                        (item) => item.id === p.id
                      );

                      const detachedState = produce(state, (draft) => {
                        draft.rows[draggedRowIdx].items.splice(
                          draggedColIdx,
                          1
                        );
                      });
                      const reattachedStates: TargetStateLike<State>[] = [];
                      detachedState.rows.forEach((row, rowIdx) => {
                        for (const colIdx of _.range(row.items.length + 1)) {
                          // const dropTargetState = produce(
                          //   detachedState,
                          //   (draft) => {
                          //     draft.rows[rowIdx].items.splice(colIdx, 0, p);
                          //   }
                          // );
                          // const finalState = produce(
                          //   dropTargetState,
                          //   (draft) => {
                          //     draft.rows[rowIdx].items.sort((a, b) =>
                          //       a.label.localeCompare(b.label)
                          //     );
                          //   }
                          // );
                          reattachedStates.push(
                            produce(detachedState, (draft) => {
                              draft.rows[rowIdx].items.splice(colIdx, 0, p);
                            })
                          );
                        }
                      });

                      return detachReattach(detachedState, reattachedStates);
                    })}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={p.w}
                      height={p.h}
                      stroke="#aaa"
                      strokeWidth={1.5}
                      fill="white"
                      rx={4}
                    />
                    <text
                      x={p.w / 2}
                      y={p.h / 2}
                      dominantBaseline="middle"
                      textAnchor="middle"
                      fontSize={18}
                      fontWeight="500"
                      fill="#555"
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>
    );
  };
}
