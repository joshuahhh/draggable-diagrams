import { produce } from "immer";
import _ from "lodash";
import { Manipulable, span } from "./manipulable";
import { group, rectangle } from "./shape";
import { assert } from "./utils";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type PermDoubleState = {
  rows: string[][];
};

export const manipulablePermDouble: Manipulable<PermDoubleState> = {
  sourceFile: "manipulable-perm-double.ts",
  render(state, draggableKey) {
    // draw grid as rectangles
    const TILE_SIZE = 50;
    const ROW_PADDING = 5;
    return group(
      state.rows.map((row, rowIdx) =>
        group(
          row.map((p, idx) =>
            rectangle({
              xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
              strokeStyle: "black",
              lineWidth: 2,
              fillStyle: "white",
              label: p,
            })
              .draggable(p)
              .zIndex(
                p === draggableKey
                  ? 2
                  : draggableKey && row.includes(draggableKey)
                    ? 1
                    : 0,
              )
              .translate(Vec2(idx * TILE_SIZE + ROW_PADDING, ROW_PADDING))
              .absoluteKey(`node-${p}`),
          ),
        ).translate(Vec2(0, rowIdx * (TILE_SIZE + ROW_PADDING * 2))),
      ),
    );
  },

  onDrag(state, draggableKey) {
    const draggedRowIdx = state.rows.findIndex((row) =>
      row.includes(draggableKey),
    );
    assert(draggedRowIdx !== -1);
    const draggedRow = state.rows[draggedRowIdx];

    const draggedColIdx = draggedRow.indexOf(draggableKey);
    assert(draggedColIdx !== -1);

    const states = [];
    for (const colIdx of _.range(draggedRow.length + 1)) {
      for (const rowIdx of _.range(state.rows.length + 1)) {
        states.push(
          produce(state, (draft) => {
            const row = draft.rows[draggedRowIdx];
            row.splice(draggedColIdx, 1);
            row.splice(colIdx, 0, draggableKey);
            draft.rows.splice(draggedRowIdx, 1);
            draft.rows.splice(rowIdx, 0, row);
          }),
        );
      }
    }
    return span(states);
  },
};

export const statePermDouble1: PermDoubleState = {
  rows: [
    ["A1", "B1", "C1"],
    ["A2", "B2", "C2"],
    ["A3", "B3", "C3"],
  ],
};
