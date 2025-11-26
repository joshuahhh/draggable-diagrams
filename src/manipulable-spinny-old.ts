import _ from "lodash";
import { Manipulable, straightTo } from "./manipulable";
import { circle, group, line, rectangle } from "./shape";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type PermState = {
  perm: string[];
};

export const manipulableSpinnyOld: Manipulable<PermState> = {
  sourceFile: "manipulable-spinny-old.ts",

  render(state, draggableKey) {
    const TILE_SIZE = 50;
    const RADIUS = 100;
    const positions = _.fromPairs(
      state.perm.map((p, idx) => [
        p,
        Vec2(-RADIUS, 0)
          .rotate((idx / state.perm.length) * 2 * Math.PI)
          .add([RADIUS, RADIUS]),
      ]),
    );
    return group(
      state.perm.map((p) =>
        group(
          circle({
            center: Vec2(0),
            radius: TILE_SIZE / 2,
            fillStyle: "white",
            strokeStyle: "black",
            lineWidth: 2,
          }).draggable(p),
          rectangle({
            xywh: XYWH(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE),
            lineWidth: 2,
            label: p,
          }),
        )
          .zIndex(p === draggableKey ? 1 : 0)
          .translate(positions[p])
          .absoluteKey(`node-${p}`),
      ),
      state.perm.map((p, idx) => {
        return line({
          from: positions[p],
          to: positions[state.perm[(idx + 1) % state.perm.length]],
          strokeStyle: "black",
          lineWidth: 1,
        })
          .zIndex(-1)
          .absoluteKey(`edge-${p}`);
      }),
    );
  },

  onDrag(state, _draggableKey) {
    // interesting bit: this doesn't depend on which key is being
    // dragged!
    return [1, state.perm.length - 1].map((idx) =>
      straightTo({
        perm: [...state.perm.slice(idx), ...state.perm.slice(0, idx)],
      }),
    );
  },
};

export const stateSpinny1: PermState = {
  perm: ["A", "B", "C", "D"],
};
