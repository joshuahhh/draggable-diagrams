import { describe, expect, it } from "vitest";
import { demoList } from "./list";

// Lazy glob — only discovers file paths, doesn't load any modules
const modules = import.meta.glob("../demos/**/*.tsx");

function pathToId(path: string): string {
  return path
    .replace("../demos/", "")
    .replace(".tsx", "")
    .replace(/\//g, "-");
}

const discoveredIds = new Set(Object.keys(modules).map(pathToId));

describe("demo registry", () => {
  it("every id in demoList corresponds to a real file", () => {
    const missing = demoList.filter((id: string) => !discoveredIds.has(id));
    expect(missing).toEqual([]);
  });
});
