import _ from "lodash";
import { Manipulable } from "./manipulable";
import { circle, group, line } from "./shape";
import { setImm } from "./utils";
import { Vec2 } from "./vec2";

type GridPolyState = {
  w: number;
  h: number;
  points: {
    x: number;
    y: number;
  }[];
};

export const manipulableGridPoly: Manipulable<GridPolyState> = {
  sourceFile: "manipulable-grid-poly.ts",

  render(state) {
    // draw grid as rectangles
    const TILE_SIZE = 50;
    return group(`grid-poly`, [
      _.range(state.w).map((x) =>
        _.range(state.h).map((y) =>
          circle({
            center: Vec2(x * TILE_SIZE, y * TILE_SIZE),
            radius: 5,
            fillStyle: "gray",
          }),
        ),
      ),
      state.points.map((pt, idx) =>
        circle({
          center: Vec2(0),
          radius: 10,
          fillStyle: "black",
        })
          .keyed(`${idx}`, true)
          .translate(Vec2(pt.x * TILE_SIZE, pt.y * TILE_SIZE)),
      ),
      state.points.map((pt, idx) => {
        const nextPt = state.points[(idx + 1) % state.points.length];
        return line({
          from: Vec2(pt.x * TILE_SIZE, pt.y * TILE_SIZE),
          to: Vec2(nextPt.x * TILE_SIZE, nextPt.y * TILE_SIZE),
          strokeStyle: "black",
          lineWidth: 2,
        }).keyed(`line-${idx}`, false);
      }),
    ]);
  },

  accessibleFrom(state, draggableKey) {
    const idx = parseInt(draggableKey, 10);
    if (!isNaN(idx)) {
      const availablePositions = _.range(state.w)
        .flatMap((x) => _.range(state.h).map((y) => ({ x, y })))
        .filter(
          (pos) => !state.points.some((pt) => pt.x === pos.x && pt.y === pos.y),
        );
      return availablePositions.map((newPos) => ({
        ...state,
        points: setImm(state.points, idx, { x: newPos.x, y: newPos.y }),
      }));
    } else {
      return [];
    }
  },
};

export const stateGridPoly1: GridPolyState = {
  w: 6,
  h: 6,
  points: [
    { x: 1, y: 1 },
    { x: 4, y: 2 },
    { x: 3, y: 5 },
    { x: 1, y: 4 },
  ],
};
