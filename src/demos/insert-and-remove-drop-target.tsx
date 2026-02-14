import { produce } from "immer";
import _ from "lodash";
import { amb, produceAmb } from "../amb";
import { demo } from "../demo";
import { DemoDraggable, DemoNotes } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type Tile = { id: string; label: string };

type State = {
  items: Tile[];
  store: Tile[];
};

const initialState: State = {
  items: [
    { id: "A", label: "\u{1F34E}" },
    { id: "B", label: "\u{1F34E}" },
    { id: "C", label: "\u{1F34C}" },
  ],
  store: [
    { id: "store-0", label: "\u{1F34E}" },
    { id: "store-1", label: "\u{1F34C}" },
    { id: "store-2", label: "\u{1F347}" },
  ],
};

const draggable: Draggable<State> = ({ state, d }) => {
  const TILE_SIZE = 50;

  const drawTile = ({
    tile,
    transform,
    onDrag,
  }: {
    tile: Tile;
    transform: string;
    onDrag?: () => ReturnType<typeof d.closest>;
  }) => {
    const id = `tile-${tile.id}`;
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
          onDrag: () => {
            const storeItem = tile;

            const stateWithout = produce(state, (draft) => {
              draft.store[idx].id += "-1";
            });

            const statesWith = produceAmb(stateWithout, (draft) => {
              const insertIdx = amb(_.range(state.items.length + 1));
              draft.items.splice(insertIdx, 0, storeItem);
            });

            return d
              .closest(d.floating(statesWith))
              .withBackground(d.floating(stateWithout));
          },
        }),
      )}

      {/* Items */}
      {state.items.map((tile, idx) =>
        drawTile({
          tile,
          transform: translate(idx * TILE_SIZE, toolbarHeight + 10),
          onDrag: () => {
            const draggedItem = tile;

            const stateWithout = produce(state, (draft) => {
              draft.items.splice(idx, 1);
            });

            const rearrangeStates = produceAmb(stateWithout, (draft) => {
              const insertIdx = amb(_.range(draft.items.length + 1));
              draft.items.splice(insertIdx, 0, draggedItem);
            });

            return d
              .closest([
                ...d.floating(rearrangeStates),
                d.dropTarget(stateWithout, "delete-bin"),
              ])
              .withBackground(d.floating(state));
          },
        }),
      )}

      {/* Deleted bin */}
      <g id="delete-bin" transform={translate(230, 0)}>
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
          {"\u{1F5D1}"}
        </text>
      </g>
    </g>
  );
};

export default demo(() => (
  <div>
    <DemoNotes>This one uses a new approach to trash cans.</DemoNotes>
    <DemoDraggable
      draggable={draggable}
      initialState={initialState}
      width={400}
      height={200}
    />
  </div>
));
