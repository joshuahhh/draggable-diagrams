import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type State = { name: "r" | "g" | "b" };

const initialState: State = { name: "r" };

const name_to_pos = {
  r: { x: 50, y: 20 },
  g: { x: 16, y: 78 },
  b: { x: 84, y: 78 },
};

const name_to_color = {
  r: "#ef4444",
  g: "#22c55e",
  b: "#3b82f6",
};

const draggable: Draggable<State> = ({ state }) => (
  <g transform={translate(60, 30)}>
    {/* Target dots */}
    {(["r", "g", "b"] as const).map((name) => (
      <circle
        transform={translate(name_to_pos[name].x, name_to_pos[name].y)}
        r={16}
        fill={name_to_color[name]}
        opacity={0.25}
      />
    ))}

    {/* Draggable knob */}
    <circle
      transform={translate(
        name_to_pos[state.name].x,
        name_to_pos[state.name].y,
      )}
      r={16}
      fill={name_to_color[state.name]}
      stroke="white"
      stroke-width={3}
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
    />
  </g>
);

export default demo(() => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={200}
    height={150}
  />
));
