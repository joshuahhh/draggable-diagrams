import { assert } from "./utils";

export type Configurable<T, Config> = {
  type: "configurable";
  withConfig: (config: Config) => T;
} & ConfigurableProps<Config>;

export type ConfigurableProps<Config> = {
  defaultConfig: Config;
  ConfigPanel: React.ComponentType<ConfigPanelProps<Config>>;
};

export interface ConfigPanelProps<Config> {
  config: Config;
  setConfig: (newConfig: Config) => void;
}

export function configurable<T, Config>(
  props: ConfigurableProps<Config>,
  withConfig: (config: Config) => T
): Configurable<T, Config> {
  return {
    type: "configurable",
    withConfig,
    defaultConfig: props.defaultConfig,
    ConfigPanel: props.ConfigPanel,
  };
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
            (opt) => stringify(opt) === e.target.value
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
