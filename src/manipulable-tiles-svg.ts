import _ from "lodash";
import { Manipulable, straightTo } from "./manipulable";
import { group, rectangle } from "./shape";
import { defined } from "./utils";
import { Vec2 } from "./vec2";
import { inXYWH, XYWH } from "./xywh";

type TilesState = {
  w: number;
  h: number;
  tiles: { [key: string]: { x: number; y: number } };
};

export const manipulableTilesSvg: Manipulable<TilesState> = {
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
          fillStyle: "#eee",
          strokeStyle: "black",
          lineWidth: 2,
          label: key,
        })
          .draggable(key)
          .translate(Vec2(tile.x * TILE_SIZE, tile.y * TILE_SIZE)),
      ),
    );
  },

  onDrag(state, draggableKey) {
    const dragLoc = Vec2(state.tiles[draggableKey]);
    return (
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
        if (Object.values(state.tiles).some((t) => adjLoc.eq(t))) return;
        return straightTo({
          ...state,
          tiles: { ...state.tiles, [draggableKey]: adjLoc.xy() },
        });
      })
      .filter(defined);
  },
};

export const stateTilesLonely: TilesState = {
  w: 5,
  h: 5,
  tiles: {
    A: { x: 2, y: 2 },
    B: { x: 4, y: 4 },
  },
};
