import { produce } from "immer";
import _ from "lodash";
import { amb, produceAmb } from "../amb";
import { andThen, floating } from "../DragSpec";
import { Manipulable } from "../manipulable";
import { translate } from "../svgx/helpers";

type Tile = { key: string; label: string };

export namespace InsertAndRemove {
  export type State = {
    items: Tile[];
    store: Tile[];
    deleted?: Tile;
  };

  export const state1: State = {
    store: [
      { key: "D", label: "🍎" },
      { key: "E", label: "🍌" },
      { key: "F", label: "🍇" },
    ],
    items: [
      { key: "A", label: "🍎" },
      { key: "B", label: "🍎" },
      { key: "C", label: "🍌" },
    ],
  };

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    const TILE_SIZE = 50;

    const drawTile = ({
      tile,
      transform,
      onDrag,
    }: {
      tile: Tile;
      transform: string;
      onDrag?: ReturnType<typeof drag>;
    }) => {
      const id = `tile-${tile.key}`;
      return (
        <g id={id} transform={transform} data-on-drag={onDrag}>
          <rect
            x={0}
            y={0}
            width={TILE_SIZE}
            height={TILE_SIZE}
            stroke="black"
            strokeWidth={2}
            fill="white"
          />
          <text
            x={TILE_SIZE / 2}
            y={TILE_SIZE / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={20}
            pointerEvents="none"
          >
            {tile.label}
          </text>
        </g>
      );
    };

    const toolbarWidth = state.store.length * TILE_SIZE + 20;
    const toolbarHeight = TILE_SIZE + 10;

    return (
      <g>
        {/* Toolbar background */}
        <rect
          x={-5}
          y={-5}
          width={toolbarWidth}
          height={toolbarHeight}
          fill="#f5f5f5"
          stroke="#ccc"
          strokeWidth={1}
          rx={4}
          id="toolbar-bg"
          data-z-index={-10}
        />

        {/* Store items */}
        {state.store.map((tile, idx) =>
          drawTile({
            tile,
            transform: translate(5 + idx * TILE_SIZE, 0),
            onDrag: drag(() => {
              const storeItemIdx = idx;
              const storeItem = tile;

              const stateWithout = produce(state, (draft) => {
                draft.store[storeItemIdx].key += "-1";
              });

              // Drag spec for store: insert anywhere
              const statesWith = produceAmb(stateWithout, (draft) => {
                const insertIdx = amb(_.range(state.items.length + 1));
                draft.items.splice(insertIdx, 0, storeItem);
              });

              return floating(statesWith, {
                backdrop: stateWithout,
              });
            }),
          })
        )}

        {/* Items */}
        {state.items.map((tile, idx) =>
          drawTile({
            tile,
            transform: translate(idx * TILE_SIZE, toolbarHeight + 10),
            onDrag: drag(() => {
              const itemIdx = idx;
              const draggedItem = tile;

              const stateWithout = produce(state, (draft) => {
                draft.items.splice(itemIdx, 1);
              });

              const rearrangeStates = produceAmb(stateWithout, (draft) => {
                const insertIdx = amb(_.range(draft.items.length + 1));
                draft.items.splice(insertIdx, 0, draggedItem);
              });

              const deleteState = produce(stateWithout, (draft) => {
                draft.items.splice(itemIdx, 1);
                draft.deleted = draggedItem;
              });
              const postDeleteState = produce(deleteState, (draft) => {
                draft.deleted = undefined;
              });

              return floating(
                [rearrangeStates, andThen(deleteState, postDeleteState)],
                { backdrop: stateWithout }
              );
            }),
          })
        )}

        {/* Deleted bin */}
        <g transform={translate(230, 0)}>
          <g>
            <rect
              x={0}
              y={0}
              width={TILE_SIZE}
              height={TILE_SIZE}
              fill="#fee"
              stroke="#999"
              strokeWidth={2}
              strokeDasharray="4,4"
              rx={4}
            />
            <text
              x={TILE_SIZE / 2}
              y={TILE_SIZE / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={30}
              pointerEvents="none"
            >
              🗑
            </text>
          </g>
          {state.deleted &&
            drawTile({
              tile: state.deleted,
              transform: translate(0, 0),
            })}
        </g>
      </g>
    );
  };
}
