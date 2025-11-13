import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, keyed, transform, zIndex } from "./shape";
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
  render(state) {
    const TILE_SIZE = 50;
    const BORDER_WIDTH = 10;
    const redCarY = Object.values(state.cars).find((t) => t.color === "red")?.y;
    return group(`tiles`, [
      ..._.range(state.w).flatMap((x) =>
        _.range(state.h).map((y) => ({
          type: "rectangle" as const,
          xywh: XYWH(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE),
          strokeStyle: "gray",
          lineWidth: 1,
        })),
      ),
      ...Object.entries(state.cars).map(([key, tile]) =>
        transform(
          Vec2(tile.x * TILE_SIZE, tile.y * TILE_SIZE),
          keyed(`${key}`, true, {
            type: "rectangle" as const,
            xywh: XYWH(0, 0, tile.w * TILE_SIZE, tile.h * TILE_SIZE),
            fillStyle: tile.color,
            strokeStyle: "black",
            lineWidth: 2,
          }),
        ),
      ),
      zIndex(-10, {
        type: "rectangle" as const,
        xywh: XYWH(
          -BORDER_WIDTH / 2,
          -BORDER_WIDTH / 2,
          state.w * TILE_SIZE + BORDER_WIDTH,
          state.h * TILE_SIZE + BORDER_WIDTH,
        ),
        strokeStyle: "gray",
        lineWidth: BORDER_WIDTH,
      }),
      ...(redCarY !== undefined
        ? [
            {
              type: "line" as const,
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
            },
          ]
        : []),
    ]);
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
