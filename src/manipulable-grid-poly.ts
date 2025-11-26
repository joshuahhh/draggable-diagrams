import { produce } from "immer";
import _ from "lodash";
import { Manipulable, span } from "./manipulable";
import { circle, group, line } from "./shape";
import { assert } from "./utils";
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
    return group(
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
          .draggable(`${idx}`)
          .translate(Vec2(pt.x * TILE_SIZE, pt.y * TILE_SIZE)),
      ),
      state.points.map((pt, idx) => {
        const nextPt = state.points[(idx + 1) % state.points.length];
        return line({
          from: Vec2(pt.x * TILE_SIZE, pt.y * TILE_SIZE),
          to: Vec2(nextPt.x * TILE_SIZE, nextPt.y * TILE_SIZE),
          strokeStyle: "black",
          lineWidth: 2,
        });
      }),
    );
  },

  onDrag(state, draggableKey) {
    const idx = parseInt(draggableKey, 10);
    assert(!isNaN(idx));
    const states = [];
    for (const x of _.range(state.w)) {
      for (const y of _.range(state.h)) {
        if (!state.points.some((pt) => pt.x === x && pt.y === y)) {
          states.push(
            produce(state, (draft) => {
              draft.points[idx] = { x, y };
            }),
          );
        }
      }
    }
    return span(states);
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
