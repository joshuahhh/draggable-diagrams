import _ from "lodash";
import { useMemo, useState } from "react";
import { amb, produceAmb } from "../amb";
import { ConfigCheckbox, ConfigPanel } from "../configurable";
import { DemoDrawer } from "../DemoDrawer";
import { closest, floating, span, withSnapRadius } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { Vec2 } from "../math/vec2";
import { path, rotateDeg, translate } from "../svgx/helpers";

type State = {
  missingSquare: Vec2;
  boardLevel: number;
};

const initialState: State = {
  missingSquare: Vec2(3, 5),
  boardLevel: 3,
};

type Config = {
  snappyMode: boolean;
  mazeMode: boolean;
};

const defaultConfig: Config = {
  snappyMode: false,
  mazeMode: false,
};

const CELL_SIZE = 40;
const TROMINO_PADDING = 6;

const COLORS = [
  "lightblue",
  "lightgreen",
  "lightpink",
  "lightyellow",
  "lightgray",
];

function manipulableFactory(config: Config): Manipulable<State> {
  return ({ state, drag }) => (
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
        data-on-drag={drag(() => {
          if (config.mazeMode) {
            const singleRotations = singleRotationStates(state);
            return withSnapRadius(
              config.snappyMode
                ? closest(
                    [...singleRotations, state].map((s) =>
                      floating(s, { ghost: { opacity: 0.2 } })
                    )
                  )
                : closest(singleRotations.map((s) => span([state, s]))),
              1,
              { chain: true }
            );
          } else {
            return config.snappyMode
              ? closest(
                  allStates(state).map((s) =>
                    floating(s, { ghost: { opacity: 0.2 } })
                  )
                )
              : span(allStates(state));
          }
        })}
      />
    </g>
  );
}

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
    const fullCount = 2 ** level;
    const halfCount = 2 ** (level - 1);
    const isCenterL = state.missingSquare.x % fullCount === halfCount - 1;
    const isCenterR = state.missingSquare.x % fullCount === halfCount;
    const isCenterT = state.missingSquare.y % fullCount === halfCount - 1;
    const isCenterB = state.missingSquare.y % fullCount === halfCount;
    if ((isCenterL || isCenterR) && (isCenterT || isCenterB)) {
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

function drawState(state: State) {
  if (state.boardLevel === 0) {
    return (
      <rect width={CELL_SIZE} height={CELL_SIZE} fill="white" stroke="black" />
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

// # Component

export const Tromino = () => {
  const [config, setConfig] = useState(defaultConfig);

  const manipulable = useMemo(() => manipulableFactory(config), [config]);

  return (
    <div className="flex flex-col md:flex-row gap-4 items-start">
      <div>
        <div className="mt-2 mb-4 text-sm text-gray-600">
          snappy+maze mode still isn't working?
        </div>
        <DemoDrawer
          manipulable={manipulable}
          initialState={initialState}
          width={370}
          height={370}
        />
      </div>
      <ConfigPanel>
        <div className="flex flex-col gap-1">
          <ConfigCheckbox
            value={config.snappyMode}
            onChange={(v) => setConfig((c) => ({ ...c, snappyMode: v }))}
          >
            Snappy mode
          </ConfigCheckbox>
          <ConfigCheckbox
            value={config.mazeMode}
            onChange={(v) => setConfig((c) => ({ ...c, mazeMode: v }))}
          >
            Maze mode
          </ConfigCheckbox>
        </div>
      </ConfigPanel>
    </div>
  );
};
