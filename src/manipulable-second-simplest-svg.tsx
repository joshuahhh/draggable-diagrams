import { straightTo } from "./manipulable";
import { ManipulableSvg, translate } from "./manipulable-svg";

type State = {
  value: number;
};

export const stateSecondSimplestSvg: State = { value: 0 };

export const manipulableSecondSimplestSvg: ManipulableSvg<State> = ({
  state,
  draggable,
}) => {
  return (
    <g transform={translate(state.value * 100, 20 * (-1) ** state.value + 20)}>
      {draggable(<rect x={0} y={0} width={100} height={100} />, [
        state.value > 0 && straightTo({ value: state.value - 1 }),
        state.value < 3 && straightTo({ value: state.value + 1 }),
      ])}
    </g>
  );
};
