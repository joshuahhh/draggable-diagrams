import _ from "lodash";
import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { rotateDeg, translate } from "../svgx/helpers";

type State = { angle: number };

const initialState: State = { angle: 0 };

const CX = 200,
  CY = 120,
  R = 60;
const TICKS = 12;

const draggable: Draggable<State> = ({ state }) => (
  <g>
    {/* Dial */}
    <g id="dial" transform={translate(CX, CY) + rotateDeg(state.angle)}>
      <circle
        r={R}
        fill="#f9fafb"
        stroke="#d1d5db"
        stroke-width={2}
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
      />
      <line
        x1={0}
        y1={0}
        x2={R - 14}
        y2={0}
        stroke="#374151"
        stroke-width={3}
        stroke-linecap="round"
      />
    </g>

    {/* Tick marks */}
    {_.range(TICKS).map((i) => (
      <line
        transform={translate(CX, CY) + rotateDeg((i * 360) / TICKS)}
        x1={R + 6}
        y1={0}
        x2={R + 16}
        y2={0}
        stroke="#9ca3af"
        stroke-width={2}
        stroke-linecap="round"
      />
    ))}
  </g>
);

export default demo(() => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={400}
    height={250}
  />
));
