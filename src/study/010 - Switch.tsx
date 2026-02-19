import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type State = { status: "on" | "off" };

const initialState: State = { status: "off" };

const draggable: Draggable<State> = ({ state, d }) => (
  <g transform={translate(70, 70)}>
    <rect
      width={120}
      height={60}
      rx={30}
      fill={state.status === "on" ? "#22c55e" : "#d1d5db"}
    />
    <circle
      transform={translate(state.status === "on" ? 90 : 30, 30)}
      r={26}
      fill="white"
      stroke="#e5e7eb"
      stroke-width={1}
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }}
      data-on-drag={() => d.between({ status: "off" }, { status: "on" })}
    />
  </g>
);

export default demo(() => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={300}
    height={150}
  />
));
