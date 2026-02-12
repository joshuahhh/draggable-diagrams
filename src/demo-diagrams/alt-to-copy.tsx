import { DemoDraggable, DemoNotes } from "../demo-ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";
import { makeId } from "../utils";

type Dot = { x: number; y: number; color: string };
type State = { dots: Record<string, Dot> };

const DOT_RADIUS = 20;
const colors = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#ec4899",
];

const id0 = makeId();
const initialState: State = {
  dots: { [id0]: { x: 150, y: 100, color: colors[0] } },
};

const draggable: Draggable<State> = ({ state, d, setState }) => (
  <g>
    {Object.entries(state.dots).map(([id, dot]) => (
      <circle
        id={`dot-${id}`}
        transform={translate(dot.x, dot.y)}
        r={DOT_RADIUS}
        fill={dot.color}
        onDoubleClick={() => {
          const { [id]: _, ...rest } = state.dots;
          setState({ dots: rest });
        }}
        data-on-drag={(dp) => {
          const moveDot = (s: State, dotId: string) =>
            d.vary(s, ["dots", dotId, "x"], ["dots", dotId, "y"]);

          if (dp.altKey) {
            // Copy: add a new dot at the same position, follow the copy
            const copyId = makeId();
            const newDot = {
              ...dot,
              color: colors[Object.keys(state.dots).length % colors.length],
            };
            const newState: State = {
              dots: { ...state.dots, [copyId]: newDot },
            };
            return d.switchToStateAndFollow(
              newState,
              `dot-${copyId}`,
              moveDot(newState, copyId),
            );
          } else {
            // Move: vary this dot's position
            return moveDot(state, id);
          }
        }}
      />
    ))}
  </g>
);

export const AltToCopy = () => (
  <>
    <DemoNotes>
      Hold <b>Alt/Option</b> while dragging to duplicate a dot. You can toggle
      Alt mid-drag.
    </DemoNotes>
    <DemoDraggable
      draggable={draggable}
      initialState={initialState}
      width={400}
      height={300}
    />
  </>
);
