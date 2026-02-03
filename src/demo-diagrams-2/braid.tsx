import { produce } from "immer";
import _ from "lodash";
import { closest, just, span } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { translate } from "../svgx/helpers";

export namespace Braid {
  export type State = {
    n: number;
    seq: [number, number][];
  };

  export const state1: State = {
    n: 4,
    seq: [],
  };

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    const TILE_SIZE = 50;

    let perm = _.range(state.n);

    return (
      <g>
        <g>
          {_.range(state.n).map((i) => (
            <line
              x1={i * TILE_SIZE}
              y1={0}
              x2={i * TILE_SIZE}
              y2={TILE_SIZE}
              stroke="black"
              strokeWidth={2}
            />
          ))}
        </g>
        {state.seq.map(([i, j], idx) => {
          perm = perm.slice();
          [perm[i], perm[j]] = [perm[j], perm[i]];
          return (
            <g
              id={`swap-${idx}`}
              transform={translate(0, (idx + 1) * TILE_SIZE)}
            >
              {/* swap lines */}
              <line
                id={`line-${perm[i]}-${idx}`}
                x1={j * TILE_SIZE}
                y1={0}
                x2={i * TILE_SIZE}
                y2={TILE_SIZE}
                stroke="black"
                strokeWidth={2}
                data-z-index={-1}
              />
              <circle
                id={`line-bkgrnd-${perm[i]}-${idx}`}
                cx={((i + j) * TILE_SIZE) / 2}
                cy={TILE_SIZE / 2}
                r={TILE_SIZE / 7}
                fill="white"
                data-z-index={0}
              />
              <line
                id={`line-${perm[j]}-${idx}`}
                x1={i * TILE_SIZE}
                y1={0}
                x2={j * TILE_SIZE}
                y2={TILE_SIZE}
                stroke="black"
                strokeWidth={2}
                data-z-index={1}
              />
              {/* the rest */}
              {_.range(state.n).map((k) =>
                k !== i && k !== j ? (
                  <line
                    id={`line-${perm[k]}-${idx}`}
                    x1={k * TILE_SIZE}
                    y1={0}
                    x2={k * TILE_SIZE}
                    y2={TILE_SIZE}
                    stroke="black"
                    strokeWidth={2}
                  />
                ) : null
              )}
            </g>
          );
        })}
        <g transform={translate(0, (state.seq.length + 1) * TILE_SIZE)}>
          {perm.map((p, i) => (
            <line
              id={`line-${p}-${state.seq.length}`}
              x1={i * TILE_SIZE}
              y1={0}
              x2={i * TILE_SIZE}
              y2={0}
              stroke="black"
              strokeWidth={2}
            />
          ))}
        </g>
        {perm.map((p, i) => (
          <g
            id={`strand-end-${p}`}
            transform={translate(
              i * TILE_SIZE,
              (state.seq.length + 1) * TILE_SIZE
            )}
            data-z-index={1}
            data-on-drag={drag(() => {
              const spanStates: State[] = [state];
              if (i > 0) {
                spanStates.push(
                  produce(state, (s) => {
                    s.seq.push([i, i - 1]);
                  })
                );
              }
              if (i < state.n - 1) {
                spanStates.push(
                  produce(state, (s) => {
                    s.seq.push([i, i + 1]);
                  })
                );
              }
              const specs = [span(spanStates)];
              if (state.seq.length > 0) {
                specs.push(
                  just(
                    produce(state, (s) => {
                      s.seq.pop();
                    })
                  )
                );
              }
              return closest(specs);
            })}
          >
            <circle r={20} fill="transparent" />
            <circle r={4} fill="gray" />
          </g>
        ))}
      </g>
    );
  };
}
