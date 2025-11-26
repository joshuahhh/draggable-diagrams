import _ from "lodash";
import { Manipulable, straightTo } from "./manipulable";
import { circle, group, rectangle } from "./shape";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type PermState = {
  perm: string[];
};

export const manipulableSpinny: Manipulable<PermState> = {
  sourceFile: "manipulable-spinny.ts",

  render(state, draggableKey) {
    const TILE_SIZE = 50;
    const RADIUS = 100;
    const positions = _.fromPairs(
      state.perm.map((p, idx) => [
        p,
        Vec2(-RADIUS, 0).rotate((idx / state.perm.length) * 2 * Math.PI),
      ]),
    );
    return group(
      state.perm.map((p) => {
        const angle =
          (state.perm.indexOf(p) / state.perm.length) * 2 * Math.PI + Math.PI;
        return group(
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
            .absoluteKey(`node-${p}`)
            .rotate(Vec2(0, 0), -angle)
            .translate([RADIUS, 0]),
          // TODO: lines
        )
          .rotate(Vec2(0, 0), angle)
          .zIndex(p === draggableKey ? 1 : 0);
      }),
    ).translate([100, 100]);
  },

  // TODO: weird that lines are straight, so we get crossing-diagonal discontinuities
  // oh shit we're actually still linearly lerping! weirrrrrrd

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
