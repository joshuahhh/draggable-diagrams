import { span } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { translate } from "../svgx/helpers";

export namespace Simplest {
  export type State = {
    value: boolean;
  };

  export const state1: State = { value: false };

  export const manipulable: Manipulable<State> = ({ state, drag }) => (
    <rect
      id="switch"
      transform={translate(state.value ? 100 : 0, 0)}
      x={0}
      y={0}
      width={100}
      height={100}
      data-on-drag={drag(() => span([{ value: true }, { value: false }]))}
    />
  );
}
