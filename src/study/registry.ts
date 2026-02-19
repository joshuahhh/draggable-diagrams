import { isDemo, DemoMarked } from "../demo";

export type Study = {
  id: string;
  number: number;
  name: string;
  Component: React.ComponentType;
};

const modules = import.meta.glob<{ default: unknown }>("./*.tsx", {
  eager: true,
});

const studies: Study[] = [];
const studiesById = new Map<string, Study>();

const numberedPattern = /^\.\/(\d+) - (.+)\.tsx$/;

for (const [path, mod] of Object.entries(modules)) {
  const match = path.match(numberedPattern);
  if (!match) continue;
  if (!isDemo(mod.default)) continue;
  const marked = mod.default as DemoMarked;
  const number = parseInt(match[1], 10);
  const name = match[2];
  const id = String(number);
  studies.push({ id, number, name, Component: marked.Component });
}

studies.sort((a, b) => a.number - b.number);
for (const study of studies) {
  studiesById.set(study.id, study);
}

export { studies, studiesById };
