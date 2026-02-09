import { DemoDrawer } from "../DemoDrawer";
import { vary } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { rotateDeg, scale, translate } from "../svgx/helpers";

type State = {
  angle: number;
  scaleX: number;
};

const initialState: State = { angle: 0, scaleX: 1 };

const manipulable: Manipulable<State> = ({ state, drag }) => (
  <circle
    transform={
      translate(100, 100) +
      rotateDeg(state.angle) +
      scale(state.scaleX, 1 / state.scaleX)
    }
    cx={0}
    cy={0}
    r={50}
    fill="lightblue"
    data-on-drag={drag(() => vary(state, ["angle"], ["scaleX"]))}
  />
);

export const StretchyRot = () => (
  <DemoDrawer
    manipulable={manipulable}
    initialState={initialState}
    width={250}
    height={250}
  />
);
