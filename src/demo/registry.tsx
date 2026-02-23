import { DemoInfo, isDemo } from ".";
import { demoList } from "./list";
import { pathToId } from "./pathToId";

export { demo } from ".";
export type { DemoInfo, DemoOptions } from ".";

export type Demo = DemoInfo & {
  id: string;
  sourcePath: string;
};

const modules = import.meta.glob<{ default: unknown }>("../demos/**/*.tsx", {
  eager: true,
});

const demosById = new Map<string, Demo>();
for (const [path, mod] of Object.entries(modules)) {
  if (!isDemo(mod.default)) continue;
  const id = pathToId(path);
  const sourcePath = path.replace("../demos/", "");
  demosById.set(id, { ...mod.default, id, sourcePath });
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
