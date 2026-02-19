import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type State = { value: number };

const initialState: State = { value: 100 };

const W = 240,
  H = 6,
  R = 12;

const draggable: Draggable<State> = ({ state }) => (
  <g transform={translate(30, 60)}>
    {/* Track */}
    <rect width={W} height={H} rx={H / 2} fill="#e5e7eb" y={-H / 2} />
    {/* Filled portion */}
    <rect width={state.value} height={H} rx={H / 2} fill="#3b82f6" y={-H / 2} />
    {/* Thumb */}
    <circle
      id="thumb"
      transform={translate(state.value, 0)}
      r={R}
      fill="white"
      stroke="#d1d5db"
      stroke-width={1.5}
      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.15))" }}
    />
  </g>
);

export default demo(() => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={320}
    height={130}
  />
));
