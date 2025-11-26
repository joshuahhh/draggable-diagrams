import _ from "lodash";
import { ConfigCheckbox } from "./config-controls";
import { Manipulable, straightTo } from "./manipulable";
import { group, rectangle } from "./shape";
import { defined } from "./utils";
import { Vec2 } from "./vec2";
import { inXYWH, XYWH } from "./xywh";

type SokobanState = {
  w: number;
  h: number;
  player: Vec2;
  objects: Record<string, { type: "wall" | "box" | "goal"; pos: Vec2 }>;
};

type SokobanConfig = {
  levelEditable: boolean;
};

export const manipulableSokoban: Manipulable<SokobanState, SokobanConfig> = {
  sourceFile: "manipulable-sokoban.ts",
  render(state, _draggableKey, config) {
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
      Object.entries(state.objects).map(([id, object]) =>
        rectangle(
          object.type === "wall"
            ? {
                xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
                fillStyle: "black",
              }
            : object.type === "box"
              ? {
                  xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
                  fillStyle: "brown",
                  strokeStyle: "black",
                  lineWidth: 2,
                }
              : {
                  xywh: XYWH(
                    TILE_SIZE / 4,
                    TILE_SIZE / 4,
                    TILE_SIZE / 2,
                    TILE_SIZE / 2,
                  ),
                  fillStyle: "orange",
                },
        )
          .draggable(id, config.levelEditable)
          .zIndex(object.type === "goal" ? 1 : 0)
          .translate(object.pos.mul(TILE_SIZE)),
      ),

      rectangle({
        xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
        label: "🧍",
      })
        .draggable(`player`)
        .zIndex(2)
        .translate(Vec2(state.player).mul(TILE_SIZE)),
    );
  },

  onDrag(state, draggableKey) {
    function isInBounds(pos: Vec2): boolean {
      return inXYWH(pos, [0, 0, state.w - 1, state.h - 1]);
    }
    function isFloor(pos: Vec2): boolean {
      return (
        isInBounds(pos) &&
        !Object.values(state.objects).some(
          (w) => w.type === "wall" && pos.eq(w.pos),
        )
      );
    }
    function idOfBoxAt(pos: Vec2): string | undefined {
      return _.findKey(state.objects, (o) => o.type === "box" && pos.eq(o.pos));
    }

    if (draggableKey === "player") {
      const curLoc = Vec2(state.player);
      return (
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const
      )
        .map((d) => {
          const newLoc = curLoc.add(d);
          console.log("trying move to", newLoc);
          if (!isFloor(newLoc)) return;
          console.log("is floor");
          // check for box
          const boxId = idOfBoxAt(newLoc);
          if (boxId === undefined) {
            // no box, just move player
            return straightTo({ ...state, player: newLoc });
          }
          // box present, try to push
          const boxNewLoc = newLoc.add(d);
          if (!isFloor(boxNewLoc)) return;
          if (idOfBoxAt(boxNewLoc) !== undefined) return;
          // can push box
          return straightTo({
            ...state,
            player: newLoc,
            objects: {
              ...state.objects,
              [boxId]: { ...state.objects[boxId], pos: boxNewLoc },
            },
          });
        })
        .filter(defined);
    } else {
      const curLoc = state.objects[draggableKey].pos;
      return (
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const
      )
        .map((d) => {
          const newLoc = curLoc.add(d);
          if (isInBounds(newLoc)) {
            return straightTo({
              ...state,
              objects: {
                ...state.objects,
                [draggableKey]: {
                  ...state.objects[draggableKey],
                  pos: newLoc,
                },
              },
            });
          }
        })
        .filter(defined);
    }
  },

  defaultConfig: {
    levelEditable: false,
  },

  renderConfig: (config, setConfig) => (
    <ConfigCheckbox
      label="Make level editable"
      value={config.levelEditable}
      onChange={(newValue) => setConfig({ levelEditable: newValue })}
    />
  ),
};

export function makeSokobanState(board: string) {
  const lines = board.split("\n");
  const state: SokobanState = {
    w: Math.max(...lines.map((l) => l.length)),
    h: lines.length,
    player: Vec2(0, 0),
    objects: {},
  };
  lines.forEach((line, y) => {
    line.split("").forEach((ch, x) => {
      const pos = Vec2(x, y);
      if (ch === "#") {
        state.objects[`wall-${x}-${y}`] = { type: "wall", pos };
      } else if (ch === "g") {
        state.objects[`goal-${x}-${y}`] = { type: "goal", pos };
      } else if (ch === "p") {
        state.player = pos;
      } else if (ch === "b") {
        state.objects[`box-${x}-${y}`] = { type: "box", pos };
      } else if (ch === "B") {
        state.objects[`box-${x}-${y}`] = { type: "box", pos };
        state.objects[`goal-${x}-${y}`] = { type: "goal", pos };
      }
    });
  });
  return state;
}

export const stateSokoban1 = makeSokobanState(`  #####
###   #
#gpb  #
### bg#
#g##b #
# # g ##
#b Bbbg#
#   g  #
########`);
