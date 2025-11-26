import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, rectangle } from "./shape";
import { defined } from "./utils";
import { Vec2 } from "./vec2";
import { inXYWH, XYWH } from "./xywh";

type FifteenState = {
  w: number;
  h: number;
  tiles: { [key: string]: { x: number; y: number } };
};

export const manipulableFifteen: Manipulable<FifteenState> = {
  sourceFile: "manipulable-tiles.ts",

  render(state) {
    const TILE_SIZE = 50;
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
      Object.entries(state.tiles).map(([key, tile]) =>
        rectangle({
          xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
          fillStyle: key === " " ? "#0000" : "#eee",
          strokeStyle: key === " " ? "#0000" : "black",
          lineWidth: 2,
          label: key,
        })
          .draggable(key)
          .translate(Vec2(tile.x * TILE_SIZE, tile.y * TILE_SIZE)),
      ),
    );
  },

  accessibleFrom(state, draggableKey) {
    // if we're not blank, we can only swap with blank
    // if we are blank, we can swap with any neighbor
    const dragLoc = Vec2(state.tiles[draggableKey]);
    return {
      manifolds: (
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const
      )
        .map((d) => {
          const adjLoc = dragLoc.add(d);
          if (!inXYWH(adjLoc, XYWH(0, 0, state.w - 1, state.h - 1))) return;
          const adjTileKey = _.findKey(state.tiles, (t) => adjLoc.eq(t));
          if (!adjTileKey) return;
          if (!(draggableKey === " " || adjTileKey === " ")) return;
          return [
            {
              ...state,
              tiles: {
                ...state.tiles,
                [draggableKey]: adjLoc.xy(),
                [adjTileKey]: dragLoc.xy(),
              },
            },
          ];
        })
        .filter(defined),
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
