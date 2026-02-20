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

/**
 * Produce all arrays resulting from taking the item in `arr` at
 * `fromIdx`, removing it from its original position, and reinserting
 * it at every possible position. */
// @ts-ignore unused
function getAllReinsertions<T>(arr: T[], fromIdx: number): T[][] {
  const result: T[][] = [];
  for (let toIdx = 0; toIdx < arr.length; toIdx++) {
    const newArr = [...arr];
    const item = newArr.splice(fromIdx, 1)[0];
    newArr.splice(toIdx, 0, item);
    result.push(newArr);
  }
  return result;
}

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
          strokeWidth={1.5}
        />

        {/* Item text */}
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={16}
          fill="#374151"
        >
          {item}
        </text>
      </g>
    ))}
  </g>
);

// Link up the Draggable to the page that displays it
export default demo(() => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={220}
    height={230}
  />
));
