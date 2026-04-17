import _ from "lodash";
import { demo } from "../demo";
import { DemoDraggable, DemoNotes } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type State = { value: number };

const DOT_GAP = 30;
const NUM_NOTCHES = 8;
const TRACK_W = DOT_GAP * (NUM_NOTCHES - 1);
const TRACK_H = 6;
const KNOB_R = 12;
const DOT_R = 7;

const DOT_POSITIONS = _.range(0, NUM_NOTCHES).map((i) => i * DOT_GAP);

// Distinct color per dot so positional vs keyed matching looks different.
const DOT_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];
const colorForX = (x: number) => DOT_COLORS[DOT_POSITIONS.indexOf(x)];

const initialState: State = { value: DOT_GAP * 3 };

const draggable: Draggable<State> = ({ state, d }) => (
  <g transform={translate(30, 40)}>
    {/* Track */}
    <rect
      width={TRACK_W}
      height={TRACK_H}
      rx={TRACK_H / 2}
      fill="#e5e7eb"
      y={-TRACK_H / 2}
    />

    {/* Notches */}
    {DOT_POSITIONS.map((x) => (
      <circle cx={x} cy={0} r={2} fill="#9ca3af" />
    ))}

    {/* Knob */}
    <circle
      transform={translate(state.value, 0)}
      r={KNOB_R}
      fill="white"
      stroke="#d1d5db"
      strokeWidth={1.5}
      dragologyOnDrag={() =>
        d.between(DOT_POSITIONS.map((x) => ({ value: x })))
      }
    />

    {/* Row 1: positional matching (no dragologyKey) — dots shift + lerp colors
        as the set of visible dots changes. */}
    <text x={-DOT_R} y={44} fontSize={11} fill="#6b7280">
      no dragologyKey
    </text>
    <g transform={translate(0, 60)}>
      {DOT_POSITIONS.filter((x) => x >= state.value).map((x) => (
        <circle cx={x} cy={DOT_R} r={DOT_R} fill={colorForX(x)} />
      ))}
    </g>

    {/* Row 2: keyed by position — each dot is independently matched, so it
        fades in/out in place without disturbing its neighbors. */}
    <text x={-DOT_R} y={94} fontSize={11} fill="#6b7280">
      with dragologyKey
    </text>
    <g transform={translate(0, 110)}>
      {DOT_POSITIONS.filter((x) => x >= state.value).map((x) => (
        <circle
          dragologyKey={`dot-${x}`}
          cx={x}
          cy={DOT_R}
          r={DOT_R}
          fill={colorForX(x)}
        />
      ))}
    </g>
  </g>
);

export default demo(
  () => (
    <div>
      <DemoNotes>
        Drag the knob; it transitions between notches via <code>d.between</code>
        . Both rows below show dots to the right of the knob. Without{" "}
        <code>dragologyKey</code>, children are keyed by position — so as one
        dot disappears, the rest shift and lerp through each other&apos;s
        colors. With <code>dragologyKey</code>, each dot is matched by its key
        and fades in/out in place.
      </DemoNotes>
      <DemoDraggable
        draggable={draggable}
        initialState={initialState}
        width={320}
        height={200}
      />
    </div>
  ),
  {
    tags: ["d.between", "dragologyKey"],
  },
);
