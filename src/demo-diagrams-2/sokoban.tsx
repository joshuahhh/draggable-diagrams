import _ from "lodash";
import { useMemo, useState } from "react";
import { ConfigCheckbox } from "../configurable";
import { DemoDrawer } from "../DemoDrawer";
import { closest, span, withSnapRadius } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { Vec2 } from "../math/vec2";
import { inXYWH } from "../math/xywh";
import { translate } from "../svgx/helpers";
import { defined } from "../utils";

type GameObject = {
  type: "wall" | "box" | "goal";
  pos: Vec2;
};

type State = {
  w: number;
  h: number;
  player: Vec2;
  objects: Record<string, GameObject>;
};

function makeSokobanState(board: string): State {
  const lines = board.split("\n");
  const state: State = {
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

const initialState = makeSokobanState(`  #####
###   #
#gpb  #
### bg#
#g##b #
# # g ##
#b Bbbg#
#   g  #
########`);

type Config = {
  levelEditable: boolean;
};

const defaultConfig: Config = {
  levelEditable: false,
};

function manipulableFactory(config: Config): Manipulable<State> {
  return ({ state, drag }) => {
    const TILE_SIZE = 50;

    function isInBounds(pos: Vec2): boolean {
      return inXYWH(pos, [0, 0, state.w - 1, state.h - 1]);
    }

    function isFloor(pos: Vec2): boolean {
      return (
        isInBounds(pos) &&
        !Object.values(state.objects).some(
          (w) => w.type === "wall" && pos.eq(w.pos)
        )
      );
    }

    function idOfBoxAt(pos: Vec2): string | undefined {
      return _.findKey(
        state.objects,
        (o) => o.type === "box" && pos.eq(o.pos)
      );
    }

    return (
      <g>
        {/* Grid */}
        {_.range(state.w).map((x) =>
          _.range(state.h).map((y) => (
            <rect
              id={`grid-${x}-${y}`}
              x={x * TILE_SIZE}
              y={y * TILE_SIZE}
              width={TILE_SIZE}
              height={TILE_SIZE}
              stroke="gray"
              strokeWidth={1}
              fill="none"
              data-z-index={-5}
            />
          ))
        )}

        {/* Objects */}
        {Object.entries(state.objects).map(([id, object]) => (
          <g
            id={`object-${id}`}
            transform={translate(
              object.pos.x * TILE_SIZE,
              object.pos.y * TILE_SIZE
            )}
            data-z-index={object.type === "goal" ? 1 : 0}
            data-on-drag={
              config.levelEditable
                ? drag(() =>
                    withSnapRadius(
                      closest(
                        (
                          [
                            [-1, 0],
                            [1, 0],
                            [0, -1],
                            [0, 1],
                          ] as const
                        )
                          .map((d) => {
                            const newLoc = object.pos.add(d);
                            if (!isInBounds(newLoc)) return;
                            return span([
                              state,
                              {
                                ...state,
                                objects: {
                                  ...state.objects,
                                  [id]: { ...object, pos: newLoc },
                                },
                              },
                            ]);
                          })
                          .filter(defined)
                      ),
                      3,
                      { transition: true, chain: true }
                    )
                  )
                : undefined
            }
          >
            {object.type === "wall" ? (
              <rect
                x={0}
                y={0}
                width={TILE_SIZE}
                height={TILE_SIZE}
                fill="black"
              />
            ) : object.type === "box" ? (
              <rect
                x={0}
                y={0}
                width={TILE_SIZE}
                height={TILE_SIZE}
                fill="brown"
                stroke="black"
                strokeWidth={2}
              />
            ) : (
              <rect
                x={TILE_SIZE / 4}
                y={TILE_SIZE / 4}
                width={TILE_SIZE / 2}
                height={TILE_SIZE / 2}
                fill="orange"
              />
            )}
          </g>
        ))}

        {/* Player */}
        <g
          id="player"
          transform={translate(
            state.player.x * TILE_SIZE,
            state.player.y * TILE_SIZE
          )}
          data-z-index={2}
          data-on-drag={drag(() =>
            withSnapRadius(
              closest(
                (
                  [
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1],
                  ] as const
                )
                  .map((d) => {
                    const curLoc = Vec2(state.player);
                    const newLoc = curLoc.add(d);
                    if (!isFloor(newLoc)) return;

                    const boxId = idOfBoxAt(newLoc);
                    if (boxId === undefined) {
                      return span([state, { ...state, player: newLoc }]);
                    }

                    // Box present, try to push
                    const boxNewLoc = newLoc.add(d);
                    if (!isFloor(boxNewLoc)) return;
                    if (idOfBoxAt(boxNewLoc) !== undefined) return;

                    return span([
                      state,
                      {
                        ...state,
                        player: newLoc,
                        objects: {
                          ...state.objects,
                          [boxId]: {
                            ...state.objects[boxId],
                            pos: boxNewLoc,
                          },
                        },
                      },
                    ]);
                  })
                  .filter(defined)
              ),
              3,
              { transition: true, chain: true }
            )
          )}
        >
          <rect
            x={0}
            y={0}
            width={TILE_SIZE}
            height={TILE_SIZE}
            fill="transparent"
          />
          <text
            x={TILE_SIZE / 2}
            y={TILE_SIZE / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={40}
            pointerEvents="none"
          >
            🧍
          </text>
        </g>
      </g>
    );
  };
}

export const Sokoban = () => {
  const [config, setConfig] = useState(defaultConfig);

  const manipulable = useMemo(() => manipulableFactory(config), [config]);

  return (
    <div className="flex gap-4 items-start">
      <DemoDrawer
        manipulable={manipulable}
        initialState={initialState}
        width={500}
        height={500}
      />
      <div className="bg-gray-50 rounded p-3 shrink-0 sticky top-4">
        <div className="text-xs font-medium text-gray-700 mb-2">Options</div>
        <ConfigCheckbox
          value={config.levelEditable}
          onChange={(v) => setConfig((c) => ({ ...c, levelEditable: v }))}
        >
          Make level editable
        </ConfigCheckbox>
      </div>
    </div>
  );
};
