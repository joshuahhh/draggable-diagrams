import { produce } from "immer";
import { useState } from "react";
import { defaultDemoContext, DemoContext, DemoDraggable } from "../demo/ui";
import {
  CANVAS_H,
  CANVAS_W,
  draggable,
  initialState,
} from "../demos/interval-graph";
import { StudioHackContext } from "./StudioHackContext";
import { Lens, Section } from "./StudioPage";

export function IntervalGraphSection() {
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  return (
    <Section title="Interval Graph">
      <DemoContext.Provider
        value={produce(defaultDemoContext, (draft) => {
          draft.settings.showDebugOverlay = showDebugOverlay;
        })}
      >
        <div className="mb-6 text-sm text-gray-500 space-y-2">
          <p>Record with cursor off.</p>
          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDebugOverlay}
              onChange={(e) => setShowDebugOverlay(e.target.checked)}
              className="accent-fuchsia-500"
            />
            <span className="text-fuchsia-600 font-medium">debug overlay</span>
          </label>
        </div>
        <Lens zoom={2}>
          <StudioHackContext.Provider
            value={{
              overlayFullOpacity: true,
              overlayHideDistances: true,
            }}
          >
            <div style={{ padding: 15 }}>
              <DemoDraggable
                draggable={draggable}
                initialState={initialState}
                width={CANVAS_W}
                height={CANVAS_H}
              />
            </div>
          </StudioHackContext.Provider>
        </Lens>
      </DemoContext.Provider>
    </Section>
  );
}
