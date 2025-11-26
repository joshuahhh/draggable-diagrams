import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, line, rectangle } from "./shape";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type RushHourState = {
  w: number;
  h: number;
  cars: {
    [key: string]: {
      x: number;
      y: number;
      w: number;
      h: number;
      dir: "h" | "v";
      color: string;
    };
  };
};

export const manipulableRushHour: Manipulable<RushHourState> = {
  sourceFile: "manipulable-rush-hour.ts",
  render(state) {
    const TILE_SIZE = 50;
    const BORDER_WIDTH = 10;
    const redCarY = Object.values(state.cars).find((t) => t.color === "red")?.y;
    return group(
      _.range(state.w).map((x) =>
        _.range(state.h).map((y) =>
          rectangle({
            xywh: XYWH(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE),
            strokeStyle: "gray",
            lineWidth: 1,
          }),
        ),
      ),
      Object.entries(state.cars).map(([key, tile]) =>
        rectangle({
          xywh: XYWH(0, 0, tile.w * TILE_SIZE, tile.h * TILE_SIZE),
          fillStyle: tile.color,
          strokeStyle: "black",
          lineWidth: 2,
        })
          .draggable(`${key}`)
          .translate(Vec2(tile.x * TILE_SIZE, tile.y * TILE_SIZE)),
      ),
      rectangle({
        xywh: XYWH(
          -BORDER_WIDTH / 2,
          -BORDER_WIDTH / 2,
          state.w * TILE_SIZE + BORDER_WIDTH,
          state.h * TILE_SIZE + BORDER_WIDTH,
        ),
        strokeStyle: "gray",
        lineWidth: BORDER_WIDTH,
      }).zIndex(-10),
      redCarY !== undefined &&
        line({
          from: Vec2(
            state.w * TILE_SIZE + BORDER_WIDTH / 2,
            redCarY * TILE_SIZE,
          ),
          to: Vec2(
            state.w * TILE_SIZE + BORDER_WIDTH / 2,
            (redCarY + 1) * TILE_SIZE,
          ),
          strokeStyle: "white",
          lineWidth: BORDER_WIDTH,
        }),
    );
  },

  accessibleFrom(state, draggableKey) {
    const curLoc = state.cars[draggableKey];
    const nextStates: RushHourState[] = [state];
    function tryMove(dx: number, dy: number) {
      let x = curLoc.x + dx;
      let y = curLoc.y + dy;
      while (true) {
        const rightBoundary = curLoc.color === "red" ? state.w + 2 : state.w;
        if (
          x < 0 ||
          x + curLoc.w > rightBoundary ||
          y < 0 ||
          y + curLoc.h > state.h
        )
          break;
        if (
          Object.entries(state.cars).some(([key, t]) => {
            if (key === draggableKey) return false;
            return !(
              x + curLoc.w <= t.x ||
              x >= t.x + t.w ||
              y + curLoc.h <= t.y ||
              y >= t.y + t.h
            );
          })
        ) {
          break;
        }
        nextStates.push({
          ...state,
          cars: {
            ...state.cars,
            [draggableKey]: { ...curLoc, x, y },
          },
        });
        x += dx;
        y += dy;
      }
    }
    if (curLoc.dir === "h") {
      tryMove(-1, 0);
      tryMove(1, 0);
    }
    if (curLoc.dir === "v") {
      tryMove(0, -1);
      tryMove(0, 1);
    }
    return nextStates;
  },
};

export const stateRushHour1: RushHourState = {
  w: 6,
  h: 6,
  cars: {
    A: { x: 0, y: 0, w: 2, h: 1, dir: "h", color: "lightgreen" },
    B: { x: 0, y: 1, w: 1, h: 3, dir: "v", color: "purple" },
    C: { x: 1, y: 2, w: 2, h: 1, dir: "h", color: "red" },
    D: { x: 0, y: 4, w: 1, h: 2, dir: "v", color: "orange" },
    E: { x: 3, y: 1, w: 1, h: 3, dir: "v", color: "blue" },
    F: { x: 5, y: 0, w: 1, h: 3, dir: "v", color: "yellow" },
    G: { x: 4, y: 4, w: 2, h: 1, dir: "h", color: "lightblue" },
    H: { x: 2, y: 5, w: 3, h: 1, dir: "h", color: "green" },
  },
};
