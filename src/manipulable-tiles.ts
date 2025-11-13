import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, keyed, transform } from "./shape";
import { filterMap } from "./utils";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type TilesState = {
  w: number;
  h: number;
  tiles: { [key: string]: { x: number; y: number } };
};

export const manipulableTiles: Manipulable<TilesState> = {
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
          keyed(`${key}`, true, {
            type: "rectangle" as const,
            xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
            fillStyle: "#eee",
            strokeStyle: "black",
            lineWidth: 2,
            label: key,
          }),
        ),
      ),
    ]);
  },

  accessibleFrom(state, draggableKey) {
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
          if (Object.values(state.tiles).some((t) => t.x === x && t.y === y))
            return;
          return [
            state,
            {
              ...state,
              tiles: { ...state.tiles, [draggableKey]: { x, y } },
            },
          ];
        },
      ),
    };
  },
};
