import { produce } from "immer";
import _ from "lodash";
import { andThen, floating } from "../DragSpec";
import { Manipulable } from "../manipulable";
import { translate } from "../svgx/helpers";

export namespace ListOfLists {
  export type State = {
    rows: {
      id: string;
      items: { id: string; label: string }[];
      color: string;
    }[];
  };

  export const state1: State = {
    rows: [
      {
        id: "row1",
        items: [
          { id: "A1", label: "A1" },
          { id: "B1", label: "B1" },
          { id: "C1", label: "C1" },
        ],
        color: "#f0f4ff",
      },
      {
        id: "row2",
        items: [
          { id: "A2", label: "A2" },
          { id: "B2", label: "B2" },
          { id: "C2", label: "C2" },
        ],
        color: "#fff4f0",
      },
      {
        id: "row3",
        items: [
          { id: "A3", label: "A3" },
          { id: "B3", label: "B3" },
          { id: "C3", label: "C3" },
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
    const TILE_SIZE = 50;
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

    return (
      <g>
        {state.rows.map((row, rowIdx) => {
          const isDraggedRow = draggedId === `row-${row.id}`;
          return (
            <g
              id={`row-${row.id}`}
              transform={translate(
                0,
                rowIdx * (TILE_SIZE + ROW_PADDING * 2 + ROW_GAP)
              )}
              data-z-index={isDraggedRow ? 2 : 0}
              data-on-drag={drag(() => {
                const stateWithout = produce(state, (draft) => {
                  draft.rows.splice(rowIdx, 1);
                });
                const statesWith = _.range(state.rows.length).map((newIdx) =>
                  produce(stateWithout, (draft) => {
                    draft.rows.splice(newIdx, 0, row);
                  })
                );
                return floating(statesWith, { backdrop: stateWithout });
              })}
            >
              <rect
                width={
                  GRIP_WIDTH +
                  GRIP_PADDING +
                  row.items.length * (TILE_SIZE + TILE_GAP) -
                  TILE_GAP +
                  ROW_PADDING * 2
                }
                height={TILE_SIZE + ROW_PADDING * 2}
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
                      cy={(TILE_SIZE + ROW_PADDING * 2) / 2 + (i - 1) * 8}
                      r={1.5}
                      fill="#333"
                    />
                  ))
                )}
              </g>
              {row.items.map((p, idx) => (
                <g
                  id={p.id}
                  data-z-index={isDraggedRow ? 3 : 1}
                  transform={translate(
                    GRIP_WIDTH +
                      GRIP_PADDING +
                      idx * (TILE_SIZE + TILE_GAP) +
                      ROW_PADDING,
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

                    const stateWithout = produce(state, (draft) => {
                      draft.rows[draggedRowIdx].items.splice(draggedColIdx, 1);
                    });
                    const statesWith: State[] = [];
                    stateWithout.rows.forEach((row, rowIdx) => {
                      for (const colIdx of _.range(row.items.length + 1)) {
                        statesWith.push(
                          produce(stateWithout, (draft) => {
                            draft.rows[rowIdx].items.splice(colIdx, 0, p);
                          })
                        );
                      }
                    });

                    return floating(statesWith, {
                      backdrop: andThen(stateWithout, state),
                    });
                  })}
                >
                  <rect
                    x={0}
                    y={0}
                    width={TILE_SIZE}
                    height={TILE_SIZE}
                    stroke="#aaa"
                    strokeWidth={1.5}
                    fill="white"
                    rx={4}
                  />
                  <text
                    x={TILE_SIZE / 2}
                    y={TILE_SIZE / 2}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fontSize={18}
                    fontWeight="500"
                    fill="#555"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </g>
    );
  };
}
