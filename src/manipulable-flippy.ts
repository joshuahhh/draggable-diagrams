import _ from "lodash";
import { Manipulable } from "./manipulable";
import { circle, group, line, rectangle } from "./shape";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type PermState = {
  perm: string[];
};

export const manipulableFlippy: Manipulable<PermState> = {
  sourceFile: "manipulable-flippy.ts",

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
        // there's a bit of complexity to draw the edges in such a
        // way that they maintain identity (and consistent endpoints)
        // as the pattern is flipped
        const [p1, p2] = _.sortBy([
          p,
          state.perm[(idx + 1) % state.perm.length],
        ]);
        return line({
          from: positions[p1],
          to: positions[p2],
          strokeStyle: "black",
          lineWidth: 1,
        })
          .zIndex(-1)
          .absoluteKey(`edge-${p1}-${p2}`);
      }),
    );
  },

  accessibleFrom(state, _draggableKey) {
    // interesting bit: this doesn't depend on which key is being
    // dragged! other interesting bit: one of the reflections keeps
    // the dragged key in place; it will be ignored cuz the identity
    // is always included.
    const reversed = [...state.perm].reverse();
    return {
      manifolds: _.range(state.perm.length).map((idx) => [
        {
          perm: [...reversed.slice(idx), ...reversed.slice(0, idx)],
        },
      ]),
    };
  },
};

export const stateFlippy1: PermState = {
  perm: ["A", "B", "C", "D"],
};
