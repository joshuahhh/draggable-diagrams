import { createContext, ReactNode, useContext } from "react";

interface DemoContextValue {
  debugView: boolean;
}

const DemoContext = createContext<DemoContextValue | undefined>(undefined);

export function DemoProvider({
  debugView,
  children,
}: {
  debugView: boolean;
  children: ReactNode;
}) {
  return (
    <DemoContext.Provider value={{ debugView }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemoContext must be used within a DemoProvider");
  }
  return context;
}
