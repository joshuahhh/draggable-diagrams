import { demo } from "../demo";
import { DemoDraggable, DemoNotes } from "../demo/ui";
import { Draggable } from "../draggable";
import { Vec2 } from "../math/vec2";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";

type State = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  squareness: number;
  tilt: number;
};

const initialState: State = {
  from: { x: 300, y: 150 },
  to: { x: 40, y: 60 },
  squareness: 0.4,
  tilt: 0,
};

const LEVELS = 7;

const draggable: Draggable<State> = ({ state, d }) => {
  function dragon(p1: Vec2, p2: Vec2, dir: number, level: number): Svgx[] {
    if (level == 0) {
      return [
        <line
          transform={translate(p1)}
          {...p2.sub(p1).xy2()}
          stroke="black"
          strokeWidth={4}
          strokeLinecap="round"
          data-on-drag={() => d.vary(state, [["squareness"]])}
        />,
      ];
    } else {
      const mid = p1.mid(p2).add(
        p2
          .sub(p1)
          .mul(state.squareness * dir)
          .rotateDeg(90 + state.tilt),
      );
      return [
        ...dragon(p1, mid, -1, level - 1),
        ...dragon(mid, p2, 1, level - 1),
      ];
    }
  }

  return (
    <g>
      {dragon(Vec2(state.from), Vec2(state.to), -1, LEVELS)}
      <circle
        transform={translate(state.from)}
        r={8}
        fill="red"
        data-on-drag={() =>
          d.vary(state, [
            ["from", "x"],
            ["from", "y"],
          ])
        }
      />
      <circle
        transform={translate(state.to)}
        r={8}
        fill="blue"
        data-on-drag={() =>
          d.vary(state, [
            ["to", "x"],
            ["to", "y"],
          ])
        }
      />
    </g>
  );
};

export default demo(
  () => (
    <div>
      <DemoNotes>
        Adapted from{" "}
        <a
          href="https://omrelli.ug/g9/"
          className="hover:text-gray-700 hover:underline"
        >
          g9's famous example
        </a>
        . Nice performance stress test (which we are failing; try larger
        "Levels").
      </DemoNotes>
      <DemoDraggable
        draggable={draggable}
        initialState={initialState}
        width={400}
        height={280}
      />
    </div>
  ),
  { tags: ["math"] },
);
