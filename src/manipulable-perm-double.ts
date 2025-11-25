import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, rectangle } from "./shape";
import { assert, insertImm, removeImm } from "./utils";
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
      `grid-poly`,
      state.rows.map((row, rowIdx) =>
        group(`row-${rowIdx}`, [
          row.map((p, idx) =>
            rectangle({
              xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
              strokeStyle: "black",
              lineWidth: 2,
              fillStyle: "white",
              label: p,
            })
              .zIndex(
                p === draggableKey
                  ? 2
                  : draggableKey && row.includes(draggableKey)
                    ? 1
                    : 0,
              )
              .keyed(p, true)
              .translate(Vec2(idx * TILE_SIZE + ROW_PADDING, ROW_PADDING)),
          ),
        ]).translate(Vec2(0, rowIdx * (TILE_SIZE + ROW_PADDING * 2))),
      ),
    );
  },

  accessibleFrom(state, draggableKey) {
    const draggedRowIdx = state.rows.findIndex((row) =>
      row.includes(draggableKey),
    );
    assert(draggedRowIdx !== -1);
    const draggedRow = state.rows[draggedRowIdx];

    const draggedColIdx = draggedRow.indexOf(draggableKey);
    assert(draggedColIdx !== -1);

    const rowsWithoutDraggedRow = removeImm(state.rows, draggedRowIdx);
    const rowWithoutDraggedItem = removeImm(draggedRow, draggedColIdx);

    return _.range(rowWithoutDraggedItem.length + 1).flatMap((colIdx) => {
      const newRow = insertImm(rowWithoutDraggedItem, colIdx, draggableKey);
      return _.range(rowsWithoutDraggedRow.length + 1).map((rowIdx) => ({
        rows: insertImm(rowsWithoutDraggedRow, rowIdx, newRow),
      }));
    });
  },
};

export const statePermDouble1: PermDoubleState = {
  rows: [
    ["A1", "B1", "C1"],
    ["A2", "B2", "C2"],
    ["A3", "B3", "C3"],
  ],
};
