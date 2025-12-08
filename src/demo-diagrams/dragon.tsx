import { numsAtPaths } from "../DragSpec";
import { Manipulable } from "../manipulable";
import { Svgx } from "../svgx";

export namespace Dragon {
  export const state1 = {
    squareness: 0.8,
    fromX: 175,
    fromY: 96,
    toX: -220,
    toY: 39,
  };

  export type State = typeof state1;

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    var lineoptions = {
      "stroke-width": 4,
      "stroke-linecap": "round",
      affects: ["squareness"],
    };

    function dragon(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      dir: number,
      level: number
    ): Svgx {
      if (level == 0) {
        return <line x1={x1} y1={y1} x2={x2} y2={y2} {...lineoptions} />;
      } else {
        var midx = (x1 + x2 + state.squareness * dir * (y2 - y1)) / 2;
        var midy = (y1 + y2 - state.squareness * dir * (x2 - x1)) / 2;

        return (
          <>
            {dragon(x1, y1, midx, midy, -1, level - 1)}
            {dragon(midx, midy, x2, y2, 1, level - 1)}
          </>
        );
      }
    }

    return (
      <>
        {dragon(state.fromX, state.fromY, state.toX, state.toY, -1, 9)}
        <circle
          cx={state.fromX}
          cy={state.fromY}
          r={8}
          fill="red"
          data-on-drag={drag(numsAtPaths([["fromX"], ["fromY"]]))}
        />
        <circle
          cx={state.toX}
          cy={state.toY}
          r={8}
          fill="blue"
          data-on-drag={drag(numsAtPaths([["toX"], ["toY"]]))}
        />
      </>
    );
  };
}
