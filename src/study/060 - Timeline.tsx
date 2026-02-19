import { produce } from "immer";
import _ from "lodash";
import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type Block = { id: string; pos: number; track: number; color: string };
type State = { blocks: Block[] };

const initialState: State = {
  blocks: [
    { id: "Cats", pos: 10, track: 0, color: "#3b82f6" },
    { id: "Dogs", pos: 100, track: 1, color: "#ef4444" },
    { id: "Clouds", pos: 50, track: 2, color: "#22c55e" },
  ],
};

const TH = 36,
  GAP = 6,
  BW = 80,
  TW = 340;

const draggable: Draggable<State> = ({ state, d }) => (
  <g transform={translate(10, 10)}>
    {/* Track backgrounds */}
    {_.range(3).map((t) => (
      <rect
        y={t * (TH + GAP)}
        width={TW}
        height={TH}
        rx={4}
        fill="#f3f4f6"
        stroke="#e5e7eb"
        stroke-width={1}
      />
    ))}

    {/* Blocks */}
    {state.blocks.map((block, i) => (
      <g
        id={block.id}
        transform={translate(block.pos, block.track * (TH + GAP))}
        data-on-drag={() =>
          d.closest(
            _.range(3).map((t) =>
              d.vary(
                produce(state, (draft) => {
                  draft.blocks[i].track = t;
                }),
                ["blocks", i, "pos"],
              ),
            ),
          )
        }
      >
        <rect
          width={BW}
          height={TH}
          rx={6}
          fill={block.color}
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }}
        />
        <text
          x={BW / 2}
          y={TH / 2}
          text-anchor="middle"
          dominant-baseline="central"
          font-size={13}
          font-weight="600"
          fill="white"
        >
          {block.id}
        </text>
      </g>
    ))}
  </g>
);

export default demo(() => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={370}
    height={140}
  />
));
