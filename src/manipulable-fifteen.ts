import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, keyed, transform } from "./shape";
import { filterMap } from "./utils";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type FifteenState = {
  w: number;
  h: number;
  tiles: { [key: string]: { x: number; y: number } };
};

export const manipulableFifteen: Manipulable<FifteenState> = {
  sourceFile: "manipulable-tiles.ts",
  render(state) {
    const TILE_SIZE = 50;
    return group(`tiles`, [
      ..._.range(state.w).flatMap((x) =>
        _.range(state.h).map((y) => ({
          type: "rectangle" as const,
          xywh: XYWH(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE),
          strokeStyle: "gray",
          lineWidth: 1,
        })),
      ),
      ...Object.entries(state.tiles).map(([key, tile]) =>
        transform(
          Vec2(tile.x * TILE_SIZE, tile.y * TILE_SIZE),
          keyed(key, true, {
            type: "rectangle" as const,
            xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
            fillStyle: key === " " ? "#0000" : "#eee",
            strokeStyle: key === " " ? "#0000" : "black",
            lineWidth: 2,
            label: key,
          }),
        ),
      ),
    ]);
  },

  accessibleFrom(state, draggableKey) {
    // if we're not blank, we can only swap with blank
    // if we are blank, we can swap with any neighbor
    const curLoc = state.tiles[draggableKey];
    return {
      manifolds: filterMap(
        [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ],
        ({ dx, dy }) => {
          const x = curLoc.x + dx;
          const y = curLoc.y + dy;
          if (x < 0 || x >= state.w || y < 0 || y >= state.h) return;
          const adjTile = Object.entries(state.tiles).find(
            ([, t]) => t.x === x && t.y === y,
          );
          if (!adjTile) return;
          const canSwap = draggableKey === " " || adjTile[0] === " ";
          if (!canSwap) return;
          return [
            state,
            {
              ...state,
              tiles: {
                ...state.tiles,
                [draggableKey]: { x, y },
                [adjTile[0]]: { x: curLoc.x, y: curLoc.y },
              },
            },
          ];
        },
      ),
    };
  },
};

export const stateFifteen: FifteenState = {
  w: 4,
  h: 4,
  tiles: {
    "12": { x: 0, y: 0 },
    "1": { x: 1, y: 0 },
    "2": { x: 2, y: 0 },
    "15": { x: 3, y: 0 },
    "11": { x: 0, y: 1 },
    "6": { x: 1, y: 1 },
    "5": { x: 2, y: 1 },
    "8": { x: 3, y: 1 },
    "7": { x: 0, y: 2 },
    "10": { x: 1, y: 2 },
    "9": { x: 2, y: 2 },
    "4": { x: 3, y: 2 },
    "13": { x: 1, y: 3 },
    "14": { x: 2, y: 3 },
    "3": { x: 3, y: 3 },
    " ": { x: 0, y: 3 },
  },
};
