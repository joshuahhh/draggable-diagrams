import { Manipulable } from "./manipulable";
import { keyed, transform } from "./shape";
import { XYWH } from "./xywh";

export const manipulableSimplest: Manipulable<number> = {
  sourceFile: "manipulable-simplest.ts",
  render(state) {
    return transform(
      [state, 0],
      keyed("switch", true, {
        type: "rectangle" as const,
        xywh: XYWH(0, 0, 100, 100),
        fillStyle: "black",
      }),
    );
  },
  accessibleFrom(s, _draggableKey) {
    if (s === 0) return [100];
    if (s === 100) return [0, 200];
    if (s === 200) return [100];
    return [0];
  },
};

export const stateSimplest1 = 0;
