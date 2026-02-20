import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type State = { items: string[] };

const initialState: State = {
  items: ["Apples", "Bananas", "Cherries", "Dates"],
};

const W = 160;
const H = 40;
const GAP = 8;

const draggable: Draggable<State> = ({ state }) => (
  <g transform={translate(20, 20)}>
    {state.items.map((item, i) => (
      <g transform={translate(0, i * (H + GAP))}>
        {/* Item background */}
        <rect
          width={W}
          height={H}
          rx={6}
          fill="white"
          stroke="#d1d5db"
          stroke-width={1.5}
        />

        {/* Item text */}
        <text
          x={W / 2}
          y={H / 2}
          text-anchor="middle"
          dominant-baseline="central"
          font-size={16}
          fill="#374151"
        >
          {item}
        </text>
      </g>
    ))}
  </g>
);

export default demo(() => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={220}
    height={230}
  />
));
