import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type State = { name: "r" | "g" | "b" };

const initialState: State = { name: "r" };

const POS = {
  r: { x: 50, y: 20 },
  g: { x: 16, y: 78 },
  b: { x: 84, y: 78 },
};

const COLOR = {
  r: "#ef4444",
  g: "#22c55e",
  b: "#3b82f6",
};

const draggable: Draggable<State> = ({ state }) => (
  <g transform={translate(60, 30)}>
    {/* Target dots */}
    {(["r", "g", "b"] as const).map((name) => (
      <circle
        transform={translate(POS[name].x, POS[name].y)}
        r={16}
        fill={COLOR[name]}
        opacity={0.25}
      />
    ))}

    {/* Draggable knob */}
    <circle
      transform={translate(POS[state.name].x, POS[state.name].y)}
      r={16}
      fill={COLOR[state.name]}
      stroke="white"
      strokeWidth={3}
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
    />
  </g>
);

// Link up the Draggable to the page that displays it
export default demo(() => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={200}
    height={200}
  />
));
