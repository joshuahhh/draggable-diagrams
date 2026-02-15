import { ComponentType } from "react";
import { DemoMarked, isDemo } from ".";
import { demoList } from "./list";

export { demo } from ".";
export type { DemoInfo, DemoOptions } from ".";

export type Demo = {
  id: string;
  Component: ComponentType;
  tags?: string[];
  sourcePath: string;
};

const modules = import.meta.glob<{ default: unknown }>("../demos/**/*.tsx", {
  eager: true,
});

function pathToId(path: string): string {
  return path.replace("../demos/", "").replace(".tsx", "").replace(/\//g, "-");
}

function markedToDemo(
  id: string,
  sourcePath: string,
  marked: DemoMarked,
): Demo {
  return { id, Component: marked.Component, tags: marked.tags, sourcePath };
}

const demosById = new Map<string, Demo>();
for (const [path, mod] of Object.entries(modules)) {
  if (!isDemo(mod.default)) continue;
  const id = pathToId(path);
  const sourcePath = path.replace("../demos/", "");
  demosById.set(id, markedToDemo(id, sourcePath, mod.default));
}

const listSet = new Set(demoList);

export const listedDemos: Demo[] = demoList.map((id) => {
  const demo = demosById.get(id);
  if (!demo) throw new Error(`Demo "${id}" not found in demos/`);
  return demo;
});

export const unlistedDemos: Demo[] = [...demosById.values()].filter(
  (d) => !listSet.has(d.id),
);

export { demoList, demosById };
