import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, keyed, transform } from "./shape";
import { insert, remove } from "./utils";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type PermState = {
  perm: string[];
};

export const manipulablePerm: Manipulable<PermState> = {
  render(state) {
    // draw grid as rectangles
    const TILE_SIZE = 50;
    return group(
      `grid-poly`,
      state.perm.map((p, idx) =>
        transform(
          Vec2(idx * TILE_SIZE, 0),
          keyed(`${p}`, true, {
            type: "rectangle" as const,
            xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
            strokeStyle: "black",
            lineWidth: 2,
            fillStyle: "white",
            label: `${p}`,
          }),
        ),
      ),
    );
  },

  accessibleFrom(state, draggableKey) {
    const draggedIdx = state.perm.indexOf(draggableKey);
    const permWithoutDragged = remove(state.perm, draggedIdx);

    return _.range(permWithoutDragged.length + 1).map((idx) => ({
      perm: insert(permWithoutDragged, idx, draggableKey),
    }));
  },
};
