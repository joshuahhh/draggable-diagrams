import { createContext, useContext } from "react";

interface DemoContextValue {
  debugMode: boolean;
  onDragStateChange?: (dragState: any) => void;
}

export const DemoContext = createContext<DemoContextValue | undefined>(undefined);

export function useDemoContext() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemoContext must be used within a DemoProvider");
  }
  return context;
}
