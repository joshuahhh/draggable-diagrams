import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, keyed, transform } from "./shape";
import { assert, insert, remove } from "./utils";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type PermDoubleState = {
  rows: string[][];
};

export const manipulablePermDouble: Manipulable<PermDoubleState> = {
  render(state) {
    // draw grid as rectangles
    const TILE_SIZE = 50;
    const ROW_PADDING = 5;
    return group(
      `grid-poly`,
      state.rows.map((row, rowIdx) =>
        transform(
          Vec2(0, rowIdx * (TILE_SIZE + ROW_PADDING * 2)),
          group(`row-${rowIdx}`, [
            ...row.map((p, idx) =>
              transform(
                Vec2(idx * TILE_SIZE + ROW_PADDING, ROW_PADDING),
                keyed(p, true, {
                  type: "rectangle" as const,
                  xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
                  strokeStyle: "black",
                  lineWidth: 2,
                  fillStyle: "white",
                  label: p,
                }),
              ),
            ),
          ]),
        ),
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

    const rowsWithoutDraggedRow = remove(state.rows, draggedRowIdx);
    const rowWithoutDraggedItem = remove(draggedRow, draggedColIdx);

    return _.range(rowWithoutDraggedItem.length + 1).flatMap((colIdx) => {
      const newRow = insert(rowWithoutDraggedItem, colIdx, draggableKey);
      return _.range(rowsWithoutDraggedRow.length + 1).map((rowIdx) => ({
        rows: insert(rowsWithoutDraggedRow, rowIdx, newRow),
      }));
    });
  },
};
