import _ from "lodash";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";

import { demo } from "../demo";
import { translate } from "../svgx/helpers";
import { assertNever } from "../utils";

type State = {
  posIndex: number;
};

const POSITIONS = [
  [10, 10],
  [100, 10],
  [55, 90],
] as const;
const SQUARE_SIZE = 40;

const initialState: State = { posIndex: 0 };

function draggableFactory(
  mode: "between" | "floating" | "just",
): Draggable<State> {
  return ({ state, d }) => (
    <g>
      {/* background positions */}
      {POSITIONS.map((pos, i) => (
        <rect
          key={i}
          transform={translate(pos)}
          width={SQUARE_SIZE}
          height={SQUARE_SIZE}
          rx={4}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      ))}
      {/* draggable square */}
      <rect
        id="switch"
        transform={translate(POSITIONS[state.posIndex])}
        width={SQUARE_SIZE}
        height={SQUARE_SIZE}
        rx={4}
        data-on-drag={() => {
          const states: State[] = _.range(POSITIONS.length).map((i) => ({
            posIndex: i,
          }));

          if (mode === "between") {
            return d.between(states);
          } else if (mode === "floating") {
            return d.closest(d.floating(states));
          } else if (mode === "just") {
            return d.closest(d.just(states));
          } else {
            assertNever(mode);
          }
        }}
      />
      <line
        x1={POSITIONS[0][0] + SQUARE_SIZE / 2}
        y1={POSITIONS[0][1] + SQUARE_SIZE / 2}
        x2={POSITIONS[state.posIndex][0] + SQUARE_SIZE / 2}
        y2={POSITIONS[state.posIndex][1] + SQUARE_SIZE / 2}
        stroke="#cbd5e1"
        strokeWidth={6}
        strokeLinecap="round"
      />
    </g>
  );
}

const betweenDraggable = draggableFactory("between");
const floatingDraggable = draggableFactory("floating");
const justDraggable = draggableFactory("just");

export default demo(() => (
  <div>
    <h3 className="text-md font-medium italic mt-6 mb-1">between</h3>
    <DemoDraggable
      draggable={betweenDraggable}
      initialState={initialState}
      width={200}
      height={150}
    />
    <h3 className="text-md font-medium italic mt-6 mb-1">floating</h3>
    <DemoDraggable
      draggable={floatingDraggable}
      initialState={initialState}
      width={200}
      height={150}
    />
    <h3 className="text-md font-medium italic mt-6 mb-1">just</h3>
    <DemoDraggable
      draggable={justDraggable}
      initialState={initialState}
      width={200}
      height={150}
    />
  </div>
));
