import _ from "lodash";
import { amb, produceAmb } from "../amb";
import { span } from "../DragSpec";
import { Manipulable } from "../manipulable";
import { Vec2 } from "../math/vec2";
import { path, rotateDeg, translate } from "../svgx/helpers";

export namespace Tromino {
  export type State = {
    missingSquare: Vec2;
    boardLevel: number; // board is actually 2**boardLevel x 2**boardLevel
  };

  export const state1: State = {
    missingSquare: Vec2(3, 5),
    boardLevel: 3,
  };

  export const manipulable: Manipulable<State> = ({ state, drag }) => (
    <g>
      {drawState(state)}
      <rect
        transform={translate(
          state.missingSquare.mul(CELL_SIZE).add(TROMINO_PADDING)
        )}
        width={CELL_SIZE - 2 * TROMINO_PADDING}
        height={CELL_SIZE - 2 * TROMINO_PADDING}
        fill="black"
        data-on-drag={drag(() =>
          span(
            produceAmb(state, (s) => {
              s.missingSquare = Vec2(
                amb(_.range(2 ** s.boardLevel)),
                amb(_.range(2 ** s.boardLevel))
              );
            })
          )
        )}
      />
    </g>
  );

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
