import { Manipulable } from "./manipulable";
import { keyed, transform } from "./shape";
import { XYWH } from "./xywh";

export const manipulableSimplest: Manipulable<boolean> = {
  render(state) {
    return transform(
      [state ? 100 : 0, 0],
      keyed("switch", true, {
        type: "rectangle" as const,
        xywh: XYWH(0, 0, 100, 100),
        fillStyle: "black",
      }),
    );
  },

  accessibleFrom(_state, _draggableKey) {
    return [false, true];
  },
};
