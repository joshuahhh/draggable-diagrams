import { useMemo, useState } from "react";
import { demo } from "../demo";
import { ConfigCheckbox, ConfigPanel, DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { translate } from "../svgx/helpers";

type State = { right: boolean };

const initialState: State = { right: false };

type Config = { snap: boolean };
const defaultConfig: Config = { snap: false };

function draggableFactory(config: Config): Draggable<State> {
  return ({ state, d }) => {
    let spec = d.between({ right: false }, { right: true });
    if (config.snap) spec = spec.withSnapRadius(20);

    return (
      <g>
        {/* The main dot */}
        <g
          id="dot"
          transform={translate(state.right ? 200 : 100, 20)}
          data-on-drag={() => spec}
        >
          <circle r={14} fill="#7cb3f0" stroke="#4a90d9" strokeWidth={2} />
        </g>

        {/* The emerging dot — only present in state 2 */}
        {state.right && (
          <g id="dot2" transform={translate(200, 100)} data-emerge-from="dot">
            <circle r={14} fill="#f0a07c" stroke="#d9824a" strokeWidth={2} />
          </g>
        )}
      </g>
    );
  };
}

export default demo(() => {
  const [config, setConfig] = useState(defaultConfig);
  const draggable = useMemo(() => draggableFactory(config), [config]);

  return (
    <div className="flex flex-col md:flex-row gap-4 items-start">
      <DemoDraggable
        draggable={draggable}
        initialState={initialState}
        width={300}
        height={200}
      />
      <ConfigPanel>
        <ConfigCheckbox
          value={config.snap}
          onChange={(v) => setConfig((c) => ({ ...c, snap: v }))}
        >
          Snap (20px)
        </ConfigCheckbox>
      </ConfigPanel>
    </div>
  );
});
