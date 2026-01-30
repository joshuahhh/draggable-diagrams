import _ from "lodash";
import {
  ConfigCheckbox,
  ConfigPanelProps,
  ConfigSelect,
} from "../configurable";
import { configurableManipulable } from "../demos";
import { vary } from "../DragSpec";
import { Vec2 } from "../math/vec2";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";

export namespace Dragon {
  export const state1 = {
    from: { x: 300, y: 150 },
    to: { x: 0, y: 39 },
    squareness: 0.4,
    tilt: 0,
  };

  export type State = typeof state1;

  type Config = {
    levels: number;
    enableTilt: boolean;
  };
  const defaultConfig: Config = {
    levels: 7,
    enableTilt: false,
  };

  export const manipulable = configurableManipulable<State, Config>(
    {
      defaultConfig,
      ConfigPanel,
    },
    (config, { state, drag }) => {
      function dragon(p1: Vec2, p2: Vec2, dir: number, level: number): Svgx[] {
        if (level == 0) {
          return [
            <line
              transform={translate(p1)}
              {...p2.sub(p1).xy2()}
              stroke="black"
              strokeWidth={4}
              strokeLinecap="round"
              data-on-drag={drag(
                config.enableTilt
                  ? vary(["squareness"], ["tilt"])
                  : vary(["squareness"])
              )}
            />,
          ];
        } else {
          const mid = p1.mid(p2).add(
            p2
              .sub(p1)
              .mul(state.squareness * dir)
              .rotateDeg(90 + state.tilt)
          );
          return [
            ...dragon(p1, mid, -1, level - 1),
            ...dragon(mid, p2, 1, level - 1),
          ];
        }
      }

      return (
        <g>
          {dragon(Vec2(state.from), Vec2(state.to), -1, config.levels)}
          <circle
            transform={translate(state.from)}
            r={8}
            fill="red"
            data-on-drag={drag(vary(["from", "x"], ["from", "y"]))}
          />
          <circle
            transform={translate(state.to)}
            r={8}
            fill="blue"
            data-on-drag={drag(vary(["to", "x"], ["to", "y"]))}
          />
        </g>
      );
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
        <ConfigCheckbox
          label="Enable Tilt"
          value={config.enableTilt}
          onChange={(checked) => {
            setConfig({ ...config, enableTilt: checked });
          }}
        />
      </>
    );
  }
}
