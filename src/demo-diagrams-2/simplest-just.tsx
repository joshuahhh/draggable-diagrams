import { closest, floating, just } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { translate } from "../svgx/helpers";

export namespace SimplestJust {
  export type State = {
    value: number;
  };

  export const state1: State = { value: 0 };

  export const manipulable: Manipulable<State> = ({ state, drag }) => (
    <rect
      id="switch"
      transform={translate(state.value * 100, 0)}
      x={0}
      y={0}
      width={100}
      height={100}
      data-on-drag={drag(() =>
        closest<State>([
          just({ value: 0 }),
          floating({ value: 1 }, { ghost: { opacity: 0.5 } }),
          just({ value: 2 }),
          floating({ value: 3 }, { ghost: { opacity: 0.5 } }),
        ])
      )}
    />
  );
}
