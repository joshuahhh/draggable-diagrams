import { ReactElement, ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { ConfigCheckbox } from "./config-controls";
import { useDemoContext } from "./DemoContext";
import { ErrorBoundary } from "./ErrorBoundary";
import { Manipulable, ManipulableDrawer } from "./manipulable";
import { hasKey } from "./utils";

type DemoPropsBase<T extends object, Config> = {
  id: string;
  title: string;
  notes?: ReactNode;
  manipulable: Manipulable<T, Config>;
  initialState: T;
  height: number;
  padding?: number;
  initialSnapRadius?: number;
  initialChainDrags?: boolean;
  initialRelativePointerMotion?: boolean;
  sourceFile?: string;
};

type DemoPropsWithConfig<T extends object, Config> = DemoPropsBase<
  T,
  Config
> & {
  defaultConfig: Config;
  ConfigPanel: React.ComponentType<ConfigPanelProps<Config>>;
};

type DemoProps<T extends object, Config> =
  | DemoPropsBase<T, Config>
  | DemoPropsWithConfig<T, Config>;

export function hasConfig<T extends object, Config>(
  props: DemoProps<T, Config>
): props is DemoPropsWithConfig<T, Config> {
  return hasKey(props, "defaultConfig");
}

export interface ConfigPanelProps<Config> {
  config: Config;
  setConfig: (newConfig: Config) => void;
}

export function Demo<T extends object>(
  props: DemoPropsBase<T, undefined>
): ReactElement;
export function Demo<T extends object, Config>(
  props: DemoPropsWithConfig<T, Config>
): ReactElement;
export function Demo<T extends object, Config>(props: DemoProps<T, Config>) {
  const {
    id,
    title,
    notes,
    manipulable,
    initialState,
    height,
    padding = 0,
    initialSnapRadius = 10,
    initialChainDrags = true,
    initialRelativePointerMotion = false,
    sourceFile,
  } = props;

  const { baseUrl, docEmbedMode } = useDemoContext();

  const [snapRadius, setSnapRadius] = useState(initialSnapRadius);
  const [chainDrags, setChainDrags] = useState(initialChainDrags);
  const [relativePointerMotion, setRelativePointerMotion] = useState(
    initialRelativePointerMotion
  );

  const [diagramConfig, setDiagramConfig] = useState<Config>(
    hasConfig(props) ? props.defaultConfig : (undefined as Config)
  );

  return (
    <div
      className={`bg-white rounded-lg p-5  ${
        docEmbedMode ? "shadow-md border border-gray-200" : "shadow-sm"
      }`}
      id={id}
    >
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 m-0">
          {baseUrl ? (
            <Link
              to={`${baseUrl}/${id}`}
              className="no-underline text-gray-900 hover:text-gray-700 hover:underline"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        {sourceFile && (
          <a
            href={`https://github.com/joshuahhh/draggable-diagrams/blob/main/src/demo-diagrams/${sourceFile}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-gray-700 no-underline hover:underline"
          >
            source
          </a>
        )}
      </div>
      {notes && <div className="mt-2 mb-4 text-sm text-gray-600">{notes}</div>}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 min-w-0" style={{ padding }}>
          <ErrorBoundary>
            <ManipulableDrawer
              manipulable={manipulable}
              initialState={initialState}
              drawerConfig={{
                snapRadius,
                chainDrags,
                relativePointerMotion,
                animationDuration: 300,
              }}
              height={height}
              diagramConfig={diagramConfig}
            />
          </ErrorBoundary>
        </div>
        <div
          className={`${
            hasConfig(props) ? "w-64 md:w-52" : "w-48 md:w-32"
          } bg-gray-50 rounded p-3 flex flex-col gap-2`}
        >
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-gray-700">Snap radius</span>
            <input
              type="range"
              min="0"
              max="50"
              value={snapRadius}
              onChange={(e) => setSnapRadius(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-gray-500 text-center">
              {snapRadius} pixels
            </span>
          </label>
          <ConfigCheckbox
            label="Chain drags automatically"
            value={chainDrags}
            onChange={setChainDrags}
          />
          {/* TODO: make this do something */}
          {/* <ConfigCheckbox
            label="Relative pointer motion"
            value={relativePointerMotion}
            onChange={setRelativePointerMotion}
          /> */}
          {hasConfig(props) && (
            <>
              <div className="border-t border-gray-300 my-1" />
              <props.ConfigPanel
                config={diagramConfig}
                setConfig={setDiagramConfig}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
