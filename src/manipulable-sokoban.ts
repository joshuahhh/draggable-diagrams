import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, keyed, transform, zIndex } from "./shape";
import { filterMap } from "./utils";
import { Vec2 } from "./vec2";
import { inXYWH, XYWH } from "./xywh";

type SokobanState = {
  w: number;
  h: number;
  walls: [number, number][];
  goals: [number, number][];
  player: [number, number];
  boxes: [number, number, string][];
};

export function makeSokobanState(board: string): SokobanState {
  const lines = board.split("\n");
  const h = lines.length;
  const w = Math.max(...lines.map((l) => l.length));
  const walls: [number, number][] = [];
  const goals: [number, number][] = [];
  let player: [number, number] = [0, 0];
  const boxes: [number, number, string][] = [];
  lines.forEach((line, y) => {
    line.split("").forEach((ch, x) => {
      if (ch === "#") {
        walls.push([x, y]);
      } else if (ch === "g") {
        goals.push([x, y]);
      } else if (ch === "p") {
        player = [x, y];
      } else if (ch === "b") {
        boxes.push([x, y, `box-${x}-${y}`]);
      } else if (ch === "B") {
        boxes.push([x, y, `box-${x}-${y}`]);
        goals.push([x, y]);
      }
    });
  });
  return { w, h, walls, goals, player, boxes };
}

export const manipulableSokoban: Manipulable<SokobanState> = {
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
      ...state.walls.map(([x, y]) => ({
        type: "rectangle" as const,
        xywh: XYWH(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE),
        fillStyle: "black",
      })),
      ...state.boxes.map(([x, y, id]) =>
        transform(
          Vec2(x * TILE_SIZE, y * TILE_SIZE),
          keyed(id, false, {
            type: "rectangle" as const,
            xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
            fillStyle: "brown",
            strokeStyle: "black",
            lineWidth: 2,
          }),
        ),
      ),
      ...state.goals.map(([x, y]) =>
        zIndex(1, {
          type: "rectangle" as const,
          xywh: XYWH(
            x * TILE_SIZE + TILE_SIZE / 4,
            y * TILE_SIZE + TILE_SIZE / 4,
            TILE_SIZE / 2,
            TILE_SIZE / 2,
          ),
          fillStyle: "orange",
        }),
      ),

      transform(
        Vec2(state.player[0] * TILE_SIZE, state.player[1] * TILE_SIZE),
        keyed(
          `player`,
          true,
          zIndex(2, {
            type: "rectangle" as const,
            xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
            label: "🧍",
          }),
        ),
      ),
    ]);
  },

  accessibleFrom(state, _draggableKey) {
    function isFloor(pos: Vec2): boolean {
      return (
        inXYWH(...pos.arr(), [0, 0, state.w - 1, state.h - 1]) &&
        !state.walls.some((w) => pos.eq(w))
      );
    }
    function boxIdxAt(pos: Vec2): number {
      return state.boxes.findIndex((b) => pos.eq([b[0], b[1]]));
    }

    const curLoc = Vec2(state.player);
    return {
      manifolds: [
        [state],
        ...filterMap(
          [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ] as const,
          (d) => {
            const newLoc = curLoc.add(d);
            console.log("trying move to", newLoc);
            if (!isFloor(newLoc)) return;
            console.log("is floor");
            // check for box
            const boxIdx = boxIdxAt(newLoc);
            if (boxIdx === -1) {
              // no box, just move player
              return [
                state,
                {
                  ...state,
                  player: newLoc.arr() as [number, number],
                },
              ];
            }
            // box present, try to push
            const boxNewLoc = newLoc.add(d);
            if (!isFloor(boxNewLoc)) return;
            if (boxIdxAt(boxNewLoc) !== -1) return;
            // can push box
            const newBoxes = state.boxes.slice();
            newBoxes[boxIdx] = [boxNewLoc.x, boxNewLoc.y, newBoxes[boxIdx][2]];
            return [
              state,
              {
                ...state,
                player: newLoc.arr() as [number, number],
                boxes: newBoxes,
              },
            ];
          },
        ),
      ],
    };
  },
};
