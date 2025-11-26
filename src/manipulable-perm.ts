import { produce } from "immer";
import _ from "lodash";
import { Manipulable, span } from "./manipulable";
import { group, rectangle } from "./shape";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type PermState = {
  perm: string[];
};

export const manipulablePerm: Manipulable<PermState> = {
  sourceFile: "manipulable-perm.ts",

  render(state, draggableKey) {
    // draw grid as rectangles
    const TILE_SIZE = 50;
    return group(
      state.perm.map((p, idx) =>
        rectangle({
          xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
          strokeStyle: "black",
          lineWidth: 2,
          fillStyle: "white",
          label: p,
        })
          .draggable(p)
          .zIndex(p === draggableKey ? 1 : 0)
          .translate(Vec2(idx * TILE_SIZE, p === draggableKey ? -10 : 0))
          .absoluteKey(p),
      ),
    );
  },

  onDrag(state, draggableKey) {
    const draggedIdx = state.perm.indexOf(draggableKey);

    return span(
      _.range(state.perm.length).map((idx) =>
        produce(state, (draft) => {
          draft.perm.splice(draggedIdx, 1);
          draft.perm.splice(idx, 0, draggableKey);
        }),
      ),
    );
  },
};

export const statePerm1: PermState = {
  perm: ["A", "B", "C", "D", "E"],
};
