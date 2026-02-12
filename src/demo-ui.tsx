import { PrettyPrint } from "@joshuahhh/pretty-print";
import { createContext, ReactNode, useContext, useState } from "react";
import {
  DropZoneLegend,
  DropZonesSvg,
  useDropZoneData,
} from "./DragSpecDropZones";
import { DragSpecTreeView } from "./DragSpecTreeView";
import { DebugDragInfo, DraggableRenderer } from "./DraggableRenderer";
import { ErrorBoundary } from "./ErrorBoundary";
import { Draggable } from "./draggable";
import { assert } from "./utils";

export type DemoSettings = {
  showTreeView: boolean;
  showDropZones: boolean;
  showDebugOverlay: boolean;
  showStateViewer: boolean;
};

const defaultSettings: DemoSettings = {
  showTreeView: false,
  showDropZones: false,
  showDebugOverlay: false,
  showStateViewer: false,
};

const DemoContext = createContext<{
  settings: DemoSettings;
  setSettings: React.Dispatch<React.SetStateAction<DemoSettings>>;
}>({
  settings: defaultSettings,
  setSettings: () => {},
});

export const useDemoSettings = () => useContext(DemoContext).settings;

export function DemoSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DemoSettings>(defaultSettings);
  return (
    <DemoContext.Provider value={{ settings, setSettings }}>
      {children}
    </DemoContext.Provider>
  );
}

const settingsEntries = [
  { key: "showTreeView", label: "Tree view", mobileHidden: true },
  { key: "showDropZones", label: "Drop zones", mobileHidden: false },
  { key: "showDebugOverlay", label: "Debug overlay", mobileHidden: false },
  { key: "showStateViewer", label: "State viewer", mobileHidden: true },
] as const;

export function DemoSettingsBar() {
  const { settings, setSettings } = useContext(DemoContext);
  return (
    <div className="sticky bottom-0 bg-white/95 py-3 px-5 border-t border-gray-200 flex gap-5 items-center justify-center shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
      {settingsEntries.map(({ key, label, mobileHidden }) => (
        <label
          key={key}
          className={`${
            mobileHidden ? "hidden md:flex" : "flex"
          } items-center gap-1.5 cursor-pointer text-sm text-slate-600 select-none`}
        >
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(e) =>
              setSettings((s) => ({ ...s, [key]: e.target.checked }))
            }
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export function DemoDraggable<T extends object>({
  draggable,
  initialState,
  width,
  height,
}: {
  draggable: Draggable<T>;
  initialState: T;
  width: number;
  height: number;
}) {
  const { showTreeView, showDropZones, showDebugOverlay, showStateViewer } =
    useDemoSettings();
  const [debugInfo, setDebugInfo] = useState<DebugDragInfo<T>>({
    type: "idle",
    state: initialState,
  });

  const draggingDebugInfo = debugInfo.type === "dragging" ? debugInfo : null;

  const { data: overlayData, computing: overlayComputing } = useDropZoneData(
    showDropZones ? draggingDebugInfo : null,
    width,
    height,
  );

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-2">
        <div className="flex gap-4 items-start">
          <div className="relative">
            <DraggableRenderer
              draggable={draggable}
              initialState={initialState}
              width={width}
              height={height}
              onDebugDragInfo={setDebugInfo}
              showDebugOverlay={showDebugOverlay}
            />
            {showDropZones && overlayData && (
              <DropZonesSvg data={overlayData} width={width} height={height} />
            )}
            {showDropZones && overlayComputing && (
              <svg
                width={20}
                height={20}
                className="absolute top-1.5 left-1.5 pointer-events-none"
                viewBox="0 0 20 20"
              >
                <circle
                  cx={10}
                  cy={10}
                  r={7}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="11 33"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 10 10"
                    to="360 10 10"
                    dur="0.8s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            )}
          </div>
          {(showTreeView || showStateViewer) && (
            <div className="w-72 shrink-0 flex flex-col gap-2">
              {showTreeView && (
                <>
                  {draggingDebugInfo ? (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-slate-500 font-mono">
                        activePath: {draggingDebugInfo.activePath}
                      </div>
                      <DragSpecTreeView
                        spec={draggingDebugInfo.spec}
                        activePath={draggingDebugInfo.activePath}
                        colorMap={overlayData?.colorMap}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">
                      Drag an element to see its tree view
                    </div>
                  )}
                </>
              )}
              {showStateViewer && (
                <ErrorBoundary>
                  <PrettyPrint
                    value={
                      debugInfo.type === "dragging"
                        ? debugInfo.dropState
                        : debugInfo.state
                    }
                    precision={2}
                    style={{ fontSize: "11px" }}
                    niceId={false}
                    niceType={false}
                  />
                </ErrorBoundary>
              )}
            </div>
          )}
        </div>
        {showDropZones && !showTreeView && overlayData && (
          <DropZoneLegend data={overlayData} />
        )}
      </div>
    </ErrorBoundary>
  );
}

export function ConfigCheckbox({
  label,
  value,
  onChange,
  children,
}: {
  label?: string;
  value: boolean;
  onChange: (newValue: boolean) => void;
  children?: React.ReactNode;
}) {
  assert(!(label && children), "Provide either label or children, not both");
  return (
    <label className="flex items-start gap-2 text-xs">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label ?? children}</span>
    </label>
  );
}

export function DemoNotes({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-600 mb-4">{children}</p>;
}

export function ConfigPanel({
  title = "Options",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded p-3 shrink-0 md:ml-auto md:sticky md:top-4">
      <div className="text-xs font-medium text-gray-700 mb-2">{title}</div>
      {children}
    </div>
  );
}

export function ConfigSelect<T>({
  label,
  value,
  onChange,
  options,
  stringifyOption,
  children,
}: {
  label?: string;
  value: T;
  onChange: (newValue: T) => void;
  options: readonly T[];
  stringifyOption?: (option: T) => string;
  children?: React.ReactNode;
}) {
  assert(!(label && children), "Provide either label or children, not both");
  const stringify = stringifyOption ?? ((opt: T) => String(opt));
  return (
    <label className="flex items-start gap-2 text-xs">
      <span>{label ?? children}</span>
      <select
        value={stringify(value)}
        onChange={(e) => {
          const selected = options.find(
            (opt) => stringify(opt) === e.target.value,
          );
          assert(selected !== undefined, "Selected option not found");
          onChange(selected);
        }}
        className="text-xs border border-gray-300 rounded px-2 py-1"
      >
        {options.map((option) => {
          const stringValue = stringify(option);
          return (
            <option key={stringValue} value={stringValue}>
              {stringValue}
            </option>
          );
        })}
      </select>
    </label>
  );
}
