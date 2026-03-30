import { demo } from "../demo";
import { DemoDraggable, DemoNotes } from "../demo/ui";
import { Draggable } from "../draggable";
import { param } from "../DragSpec";
import { translate } from "../svgx/helpers";

type State = { type: "on-island" } | { type: "floating"; x: number; y: number };

const island = { x: 100, y: 100 };
const R_SMALL = 10;
const R_BIG = 20;

const initialState: State = { type: "on-island" };

const draggable: Draggable<State> = ({ state, d }) => (
  <g>
    <g transform={translate(island.x, island.y)}>
      <circle
        r={state.type === "on-island" ? R_BIG : R_SMALL}
        fill="none"
        stroke="#ccc"
        strokeWidth={2}
      />
    </g>
    <circle
      id="dot"
      r={10}
      fill="#4488ff"
      transform={translate(state.type === "on-island" ? island : state)}
      dragologyOnDrag={() =>
        d
          .fixed({ type: "on-island" as const })
          .whenFar(
            d.vary({ type: "floating", x: 0, y: 0 }, [param("x"), param("y")]),
            { gapIn: 40, gapOut: 80 },
          )
      }
    />
  </g>
);

export default demo(
  () => (
    <>
      <DemoNotes>
        Like snap-to-islands, but with no floating and asymmetric gapIn/gapOut
        (gapIn=40, gapOut=80).
      </DemoNotes>
      <DemoDraggable
        draggable={draggable}
        initialState={initialState}
        width={200}
        height={200}
      />
    </>
  ),
  {
    tags: ["d.vary", "spec.whenFar [gapIn/gapOut]"],
  },
);
