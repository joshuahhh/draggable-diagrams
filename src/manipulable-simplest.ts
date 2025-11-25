import { Manipulable } from "./manipulable";
import { rectangle } from "./shape";
import { XYWH } from "./xywh";

export const manipulableSimplest: Manipulable<boolean> = {
  sourceFile: "manipulable-simplest.ts",
  render(state) {
    return rectangle({
      xywh: XYWH(0, 0, 100, 100),
      fillStyle: "black",
    })
      .keyed("switch", true)
      .translate([state ? 100 : 0, 0]);
  },

  accessibleFrom(_state, _draggableKey) {
    return [false, true];
  },
};

export const stateSimplest1 = true;
