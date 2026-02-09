import { DemoDrawer } from "../DemoDrawer";
import { vary } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { scale, translate } from "../svgx/helpers";

type State = {
  scaleX: number;
  scaleY: number;
};

const initialState: State = { scaleX: 1, scaleY: 1 };

const manipulable: Manipulable<State> = ({ state, drag }) => (
  <g>
    <circle
      transform={translate(100, 100) + scale(state.scaleX, state.scaleY)}
      cx={0}
      cy={0}
      r={50}
      fill="lightblue"
      data-on-drag={drag(() => vary(state, ["scaleX"], ["scaleY"]))}
    />
    <ellipse
      cx={100}
      cy={100}
      rx={50 * Math.abs(state.scaleX)}
      ry={50 * Math.abs(state.scaleY)}
      fill="none"
      stroke="black"
      strokeWidth={4}
    />
  </g>
);

export const StretchyXY = () => (
  <DemoDrawer
    manipulable={manipulable}
    initialState={initialState}
    width={250}
    height={250}
  />
);
