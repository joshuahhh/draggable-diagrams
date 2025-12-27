import _ from "lodash";
import { ConfigPanelProps, ConfigSelect } from "../configurable";
import { configurableManipulable } from "../demos";
import { numsAtPaths } from "../DragSpec";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";

type Point = [number, number];
// 3x2 matrix
// a b e
// c d f
type Transform = [number, number, number, number, number, number];

const ap = ([x, y]: Point, t: Transform) => ({
  x: x * t[0] + y * t[2] + t[4],
  y: x * t[1] + y * t[3] + t[5],
});
const comp = (t2: Transform, t1: Transform): Transform => {
  const m11 = t1[0] * t2[0] + t1[2] * t2[1];
  const m12 = t1[1] * t2[0] + t1[3] * t2[1];

  const m21 = t1[0] * t2[2] + t1[2] * t2[3];
  const m22 = t1[1] * t2[2] + t1[3] * t2[3];

  const dx = t1[0] * t2[4] + t1[2] * t2[5] + t1[4];
  const dy = t1[1] * t2[4] + t1[3] * t2[5] + t1[5];

  return [m11, m12, m21, m22, dx, dy];
};

export namespace RecursiveDrawing {
  export const state1 = {
    init: [15, 0, 0, 15, 150, 150] as Transform,
    transform: [1, 0, 0, 1, 2, 2] as Transform,
  };

  export type State = typeof state1;

  type Config = {
    levels: number;
  };
  const defaultConfig: Config = {
    levels: 7,
  };

  export const manipulable = configurableManipulable<State, Config>(
    {
      defaultConfig,
      ConfigPanel,
    },
    (config, { state, drag }) => {
      function dragon(t: Transform, level: number): Svgx[] {
        const a: Svgx[] =
          level === 0 ? [] : dragon(comp(state.transform, t), level - 1);
        const b: Svgx[] = [
          <circle
            transform={translate(ap([0, 0], t))}
            r={5}
            fill="green"
            data-on-drag={drag(
              numsAtPaths([
                ["transform", "4"],
                ["transform", "5"],
              ])
            )}
          />,
          <circle
            transform={translate(ap([1, 0], t))}
            r={5}
            fill="red"
            data-on-drag={drag(
              numsAtPaths([
                ["transform", "0"],
                ["transform", "1"],
              ])
            )}
          />,
          <circle
            transform={translate(ap([0, 1], t))}
            r={5}
            fill="blue"
            data-on-drag={drag(
              numsAtPaths([
                ["transform", "2"],
                ["transform", "3"],
              ])
            )}
          />,
        ];
        return [...a, ...b];
      }

      return <g>{dragon(state.init, config.levels)}</g>;
    }
  );

  function ConfigPanel({ config, setConfig }: ConfigPanelProps<Config>) {
    return (
      <>
        <ConfigSelect
          label="Levels"
          value={config.levels}
          onChange={(levels) => {
            setConfig({ ...config, levels });
          }}
          options={_.range(1, 11)}
        />
      </>
    );
  }
}
