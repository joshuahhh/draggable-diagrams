import _ from "lodash";
import { demo } from "../demo";
import { DemoDraggable, DemoNotes } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type State = { value: number };

const DOT_GAP = 30;
const NUM_NOTCHES = 8;
const TRACK_W = DOT_GAP * NUM_NOTCHES;
const TRACK_H = 6;
const KNOB_R = 12;
const DOT_R = 7;

const NOTCH_VALUES = _.range(0, NUM_NOTCHES + 1).map((i) => i * DOT_GAP);
const DOT_POSITIONS = _.range(DOT_GAP, TRACK_W + 1, DOT_GAP);

const initialState: State = { value: DOT_GAP * 4 };

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
    {NOTCH_VALUES.map((x) => (
      <circle cx={x} cy={0} r={2} fill="#9ca3af" />
    ))}

    {/* Knob — snaps between notches via d.between */}
    <circle
      transform={translate(state.value, 0)}
      r={KNOB_R}
      fill="white"
      stroke="#d1d5db"
      strokeWidth={1.5}
      dragologyOnDrag={() => d.between(NOTCH_VALUES.map((v) => ({ value: v })))}
    />

    {/* Dots — only those with x ≤ value. Count varies across states! */}
    <g transform={translate(0, 50)}>
      {DOT_POSITIONS.filter((x) => x <= state.value).map((x) => (
        <circle cx={x} cy={DOT_R} r={DOT_R} fill="#374151" />
      ))}
    </g>
  </g>
);

export default demo(
  () => (
    <div>
      <DemoNotes>
        We used to not allow lerping between changing numbers of children
        (unless they were given ids, which hoist them out). Here's one little
        step towards flexibility: you can add/remove children from the end.
        Coming up soon: <code>dragologyKey</code>.
      </DemoNotes>
      <DemoDraggable
        draggable={draggable}
        initialState={initialState}
        width={320}
        height={140}
      />
    </div>
  ),
  {
    tags: ["d.between"],
  },
);
