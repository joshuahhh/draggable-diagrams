import { createContext, ReactNode, useContext, useState } from "react";

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
          className={`${mobileHidden ? "hidden md:flex" : "flex"} items-center gap-1.5 cursor-pointer text-sm text-slate-600 select-none`}
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
