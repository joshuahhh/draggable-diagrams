import { PrettyPrint } from "@joshuahhh/pretty-print";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  DropZoneLegend,
  DropZonesSvg,
  useDropZoneData,
} from "../DragSpecDropZones";
import { DragSpecTreeView } from "../DragSpecTreeView";
import { DebugDragInfo, DraggableRenderer } from "../DraggableRenderer";
import { ErrorBoundary } from "../ErrorBoundary";
import { OpenInEditor } from "../OpenInEditor";
import { Draggable } from "../draggable";
import { assert } from "../utils";
import type { Demo } from "./registry";

export type DemoSettings = {
  showTreeView: boolean;
  showDropZones: boolean;
  showDebugOverlay: boolean;
  showStateViewer: boolean;
  showTimingMeter: boolean;
};

const defaultSettings: DemoSettings = {
  showTreeView: false,
  showDropZones: false,
  showDebugOverlay: false,
  showStateViewer: false,
  showTimingMeter: false,
};

const DemoContext = createContext<{
  settings: DemoSettings;
  setSettings: React.Dispatch<React.SetStateAction<DemoSettings>>;
}>({
  settings: defaultSettings,
  setSettings: () => {},
});

export const useDemoSettings = () => useContext(DemoContext).settings;

const SETTINGS_KEY = "demo-settings";

function loadSettings(): DemoSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {}
  return defaultSettings;
}

export function DemoSettingsProvider({
  children,
  persist = true,
}: {
  children: ReactNode;
  persist?: boolean;
}) {
  const [settings, setSettings] = useState<DemoSettings>(
    persist ? loadSettings : () => defaultSettings,
  );
  useEffect(() => {
    if (!persist) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, persist]);
  return (
    <DemoContext.Provider value={{ settings, setSettings }}>
      {children}
    </DemoContext.Provider>
  );
}

const settingsEntries = [
  { key: "showStateViewer", label: "State viewer", mobileHidden: true },
  { key: "showDebugOverlay", label: "Debug overlay", mobileHidden: false },
  { key: "showTreeView", label: "Spec tree", mobileHidden: true },
  { key: "showDropZones", label: "Drop zones", mobileHidden: false },
  { key: "showTimingMeter", label: "Timing", mobileHidden: true },
] as const;

const settingsIcons: Record<keyof DemoSettings, ReactNode> = {
  showStateViewer: (
    <svg width={14} height={14} viewBox="0 0 14 14" className="shrink-0">
      <text
        x={7}
        y={10.5}
        textAnchor="middle"
        fontSize={11}
        fontFamily="ui-monospace, monospace"
        fill="#64748b"
        fontWeight={700}
      >
        {"{}"}
      </text>
    </svg>
  ),
  showDebugOverlay: (
    <svg width={14} height={14} viewBox="0 0 14 14" className="shrink-0">
      <circle cx={7} cy={7} r={5} fill="magenta" />
    </svg>
  ),
  showTreeView: (
    <svg width={14} height={14} viewBox="0 0 14 14" className="shrink-0">
      <rect
        x={2}
        y={2}
        width={10}
        height={10}
        rx={3}
        ry={3}
        fill="rgba(250, 204, 21, 0.25)"
        stroke="rgb(250, 204, 21)"
        strokeWidth={1.5}
      />
    </svg>
  ),
  showDropZones: (
    <svg width={14} height={14} viewBox="0 0 14 14" className="shrink-0">
      <defs>
        <clipPath id="dz-clip">
          <rect x={1} y={1} width={12} height={12} rx={2} />
        </clipPath>
      </defs>
      <g clipPath="url(#dz-clip)">
        <g opacity={0.35}>
          <path
            d="M7,7 L17,7 A10,10,0,0,1,2,15.66 Z"
            fill="rgb(65, 105, 225)"
          />
          <path
            d="M7,7 L2,15.66 A10,10,0,0,1,2,-1.66 Z"
            fill="rgb(220, 20, 60)"
          />
          <path d="M7,7 L2,-1.66 A10,10,0,0,1,17,7 Z" fill="rgb(34, 139, 34)" />
        </g>
        <line x1={7} y1={7} x2={17} y2={7} stroke="white" strokeWidth={1} />
        <line x1={7} y1={7} x2={2} y2={15.66} stroke="white" strokeWidth={1} />
        <line x1={7} y1={7} x2={2} y2={-1.66} stroke="white" strokeWidth={1} />
      </g>
    </svg>
  ),
  showTimingMeter: (
    <svg width={14} height={14} viewBox="0 0 14 14" className="shrink-0">
      <circle
        cx={7}
        cy={7}
        r={5.5}
        fill="none"
        stroke="#64748b"
        strokeWidth={1.2}
      />
      <line
        x1={7}
        y1={7}
        x2={7}
        y2={3.5}
        stroke="#64748b"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <line
        x1={7}
        y1={7}
        x2={9.5}
        y2={7}
        stroke="#64748b"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </svg>
  ),
};

function TimingMeter() {
  const [msPerFrame, setMsPerFrame] = useState(0);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  const tick = useCallback(() => {
    framesRef.current++;
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;
    if (elapsed >= 1000) {
      setMsPerFrame(+(elapsed / framesRef.current).toFixed(1));
      framesRef.current = 0;
      lastTimeRef.current = now;
    }
  }, []);

  useEffect(() => {
    let id: number;
    const loop = () => {
      tick();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [tick]);

  return (
    <div className="text-xs font-mono text-slate-500">{msPerFrame} ms/f</div>
  );
}

export function DemoSettingsBar({
  only,
}: { only?: (keyof DemoSettings)[] } = {}) {
  const { settings, setSettings } = useContext(DemoContext);
  const entries = only
    ? settingsEntries.filter(({ key }) => only.includes(key))
    : settingsEntries;
  return (
    <div className="sticky bottom-0 bg-white/95 py-3 px-5 border-t border-gray-200 flex gap-5 items-center justify-center shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
      {entries.map(({ key, label, mobileHidden }) => (
        <label
          key={key}
          className={`${
            mobileHidden ? "hidden md:flex" : "flex"
          } items-center gap-1 cursor-pointer text-sm text-slate-600 select-none`}
        >
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(e) =>
              setSettings((s) => ({ ...s, [key]: e.target.checked }))
            }
          />
          <span className="ml-0.5">{settingsIcons[key]}</span>
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
  const {
    showTreeView,
    showDropZones,
    showDebugOverlay,
    showStateViewer,
    showTimingMeter: showTimingMeter,
  } = useDemoSettings();
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
          {(showTreeView || showStateViewer || showTimingMeter) && (
            <div className="w-72 shrink-0 flex flex-col gap-2">
              {showTimingMeter && <TimingMeter />}
              {showTreeView && (
                <>
                  {draggingDebugInfo ? (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                        activePath: {draggingDebugInfo.activePath}
                      </div>
                      <DragSpecTreeView
                        spec={draggingDebugInfo.spec}
                        activePath={draggingDebugInfo.activePath}
                        colorMap={overlayData?.colorMap}
                        annotatedSpec={draggingDebugInfo.annotatedSpec}
                        svgWidth={width}
                        svgHeight={height}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">
                      Drag an element to see its spec tree
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

export function DemoNotes({ children }: { children?: React.ReactNode }) {
  return <p className="text-sm text-gray-600 mb-4">{children}</p>;
}

export function DemoTags({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5 mb-4">{children}</div>;
}

export function DemoTag({
  children,
  onClick,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  const clickable = onClick ? "cursor-pointer hover:brightness-95" : "";
  return (
    <span
      className={`inline-block text-xs border rounded px-1.5 py-0.5 text-slate-500 bg-slate-50 border-slate-200 ${clickable}`}
      onClick={onClick}
    >
      {children}
    </span>
  );
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

export function DemoCard({
  demo,
  linkTitle,
  onTagClick,
}: {
  demo: Demo;
  linkTitle?: boolean;
  onTagClick?: (label: string) => void;
}) {
  const sourceUrl = `https://github.com/joshuahhh/draggable-diagrams/blob/main/src/demos/${demo.sourcePath}`;
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 m-0">
          {linkTitle ? (
            <Link
              to={`/demos/${demo.id}`}
              className="no-underline text-gray-900 hover:text-gray-700 hover:underline"
            >
              {demo.id}
            </Link>
          ) : (
            demo.id
          )}
        </h2>
        <div className="flex gap-3">
          <OpenInEditor
            relativePath={`src/demos/${demo.sourcePath}`}
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
          >
            open in editor
          </OpenInEditor>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700 no-underline hover:underline"
          >
            github
          </a>
        </div>
      </div>
      {demo.tags && demo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {demo.tags.map((tag) => (
            <DemoTag key={tag} onClick={onTagClick && (() => onTagClick(tag))}>
              {tag}
            </DemoTag>
          ))}
        </div>
      )}
      <demo.Component />
    </div>
  );
}
