import _ from "lodash";
import { amb, produceAmb } from "../amb";
import { ConfigCheckbox, ConfigPanelProps } from "../configurable";
import { configurableManipulable } from "../demos";
import { floating, span, straightTo } from "../DragSpec";
import { Vec2 } from "../math/vec2";
import { path, rotateDeg, translate } from "../svgx/helpers";
import { pipe } from "../utils";

export namespace Tromino {
  export type State = {
    missingSquare: Vec2;
    boardLevel: number; // board is actually 2**boardLevel x 2**boardLevel
  };

  export const state1: State = {
    missingSquare: Vec2(3, 5),
    boardLevel: 3,
  };

  export type Config = {
    snappyMode: boolean;
    mazeMode: boolean;
  };

  const defaultConfig: Config = {
    snappyMode: false,
    mazeMode: false,
  };

  export const manipulable = configurableManipulable<State, Config>(
    { defaultConfig, ConfigPanel },
    (config, { state, drag }) => (
      <g>
        {drawState(state)}
        <rect
          id="missing-square"
          data-z-index={1}
          transform={translate(
            state.missingSquare.mul(CELL_SIZE).add(TROMINO_PADDING)
          )}
          width={CELL_SIZE - 2 * TROMINO_PADDING}
          height={CELL_SIZE - 2 * TROMINO_PADDING}
          fill="black"
          data-on-drag={drag(() =>
            config.mazeMode
              ? pipe(singleRotationStates(state), (states) =>
                  config.snappyMode
                    ? // TODO: snappy + maze needs "chain drags" (when
                      // you snap into a new state, compute new drag
                      // possibilities)
                      floating([state, ...states], { ghost: { opacity: 0.1 } })
                    : states.map(straightTo)
                )
              : pipe(allStates(state), (states) =>
                  config.snappyMode
                    ? floating(states, { ghost: { opacity: 0.1 } })
                    : span(states)
                )
          )}
        />
      </g>
    )
  );

  function allStates(state: State): State[] {
    return produceAmb(state, (s) => {
      s.missingSquare = Vec2(
        amb(_.range(2 ** s.boardLevel)),
        amb(_.range(2 ** s.boardLevel))
      );
    });
  }

  function singleRotationStates(state: State): State[] {
    return _.range(1, state.boardLevel + 1).flatMap((level) => {
      // are we in the center square of 2**level x 2**level blocks?
      const fullCount = 2 ** level;
      const halfCount = 2 ** (level - 1);
      const isCenterL = state.missingSquare.x % fullCount === halfCount - 1;
      const isCenterR = state.missingSquare.x % fullCount === halfCount;
      const isCenterT = state.missingSquare.y % fullCount === halfCount - 1;
      const isCenterB = state.missingSquare.y % fullCount === halfCount;
      if ((isCenterL || isCenterR) && (isCenterT || isCenterB)) {
        // allow straightTo motion to the two adjacent
        // center squares
        return [
          {
            ...state,
            missingSquare: state.missingSquare.add([isCenterL ? 1 : -1, 0]),
          },
          {
            ...state,
            missingSquare: state.missingSquare.add([0, isCenterT ? 1 : -1]),
          },
        ];
      } else {
        return [];
      }
    });
  }

  function ConfigPanel({ config, setConfig }: ConfigPanelProps<Config>) {
    return (
      <>
        <ConfigCheckbox
          label="Snappy mode"
          value={config.snappyMode}
          onChange={(newValue) =>
            setConfig({ ...config, snappyMode: newValue })
          }
        />
        <ConfigCheckbox
          label="Maze mode"
          value={config.mazeMode}
          onChange={(newValue) => setConfig({ ...config, mazeMode: newValue })}
        />
        <div className="text-xs mt-2">
          NOTE: snappy+maze mode doesn't work yet, cuz we don't have "Chain
          drags automatically" for <span className="font-mono">free</span>{" "}
          drags.
        </div>
      </>
    );
  }

  const CELL_SIZE = 40;
  const TROMINO_PADDING = 6;

  const COLORS = [
    "lightblue",
    "lightgreen",
    "lightpink",
    "lightyellow",
    "lightgray",
  ];

  function drawState(state: State) {
    if (state.boardLevel === 0) {
      return (
        <rect
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill="white"
          stroke="black"
        />
      );
    }

    const halfCount = 2 ** (state.boardLevel - 1);
    const missingLeft = state.missingSquare.x < halfCount;
    const missingTop = state.missingSquare.y < halfCount;

    return (
      <g>
        <g transform={translate(0, 0)}>
          {drawState({
            ...state,
            boardLevel: state.boardLevel - 1,
            missingSquare:
              missingLeft && missingTop
                ? state.missingSquare
                : Vec2(halfCount - 1, halfCount - 1),
          })}
        </g>
        <g transform={translate(halfCount * CELL_SIZE, 0)}>
          {drawState({
            ...state,
            boardLevel: state.boardLevel - 1,
            missingSquare:
              !missingLeft && missingTop
                ? state.missingSquare.sub(Vec2(halfCount, 0))
                : Vec2(0, halfCount - 1),
          })}
        </g>
        <g transform={translate(0, halfCount * CELL_SIZE)}>
          {drawState({
            ...state,
            boardLevel: state.boardLevel - 1,
            missingSquare:
              missingLeft && !missingTop
                ? state.missingSquare.sub(Vec2(0, halfCount))
                : Vec2(halfCount - 1, 0),
          })}
        </g>
        <g transform={translate(halfCount * CELL_SIZE, halfCount * CELL_SIZE)}>
          {drawState({
            ...state,
            boardLevel: state.boardLevel - 1,
            missingSquare:
              !missingLeft && !missingTop
                ? state.missingSquare.sub(Vec2(halfCount, halfCount))
                : Vec2(0, 0),
          })}
          {/* the tromino! */}
          <path
            d={path(
              "M",
              [TROMINO_PADDING, TROMINO_PADDING],
              "L",
              [TROMINO_PADDING - CELL_SIZE, TROMINO_PADDING],
              "L",
              [TROMINO_PADDING - CELL_SIZE, CELL_SIZE - TROMINO_PADDING],
              "L",
              [CELL_SIZE - TROMINO_PADDING, CELL_SIZE - TROMINO_PADDING],
              "L",
              [CELL_SIZE - TROMINO_PADDING, TROMINO_PADDING - CELL_SIZE],
              "L",
              [TROMINO_PADDING, TROMINO_PADDING - CELL_SIZE],
              "Z"
            )}
            transform={rotateDeg(
              missingLeft ? (missingTop ? 0 : 270) : missingTop ? 90 : 180,
              [0, 0]
            )}
            fill={COLORS[state.boardLevel - 1]}
            stroke="black"
          />
        </g>
      </g>
    );
  }
}
