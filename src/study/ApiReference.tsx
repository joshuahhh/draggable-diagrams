import { ReactNode } from "react";

function Entry({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="py-1.5 text-sm text-gray-600">
      <code className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded whitespace-nowrap">
        {name}
      </code>{" "}
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

const ref020 = (
  <>
    <Entry name="data-on-drag">
      SVG attribute. Takes <Code>{"() => DragSpec<State>"}</Code>.
    </Entry>
    <Entry name="d">
      DragSpecBuilder. Available via <Code>{"({ state, d }) => ..."}</Code>.
    </Entry>
    <Entry name="d.between(state1, state2, ...)">
      Interpolate between any number of discrete states.{" "}
      <Code>{'d.between({ status: "off" }, { status: "on" })'}</Code>
    </Entry>
  </>
);

const ref030 = (
  <>
    <Entry name="data-on-drag">
      SVG attribute. Takes <Code>{"() => DragSpec<State>"}</Code>.
    </Entry>
    <Entry name="d.between(...states)">
      Interpolate between discrete states.{" "}
      <Code>{'d.between({ status: "off" }, { status: "on" })'}</Code> or{" "}
      <Code>{"d.between(arrayOfStates)"}</Code>
    </Entry>
    <Entry name="draggedId">
      The <Code>id</Code> of the currently dragged element; useful for visual
      feedback.
    </Entry>
  </>
);

const ref040 = (
  <>
    <Entry name="data-on-drag">
      SVG attribute. Takes <Code>{"() => DragSpec<State>"}</Code>.
    </Entry>
    <Entry name="d.between(...states)">
      Interpolate between discrete states.{" "}
      <Code>{'d.between({ status: "off" }, { status: "on" })'}</Code>
    </Entry>
    <Entry name="draggedId">
      The <Code>id</Code> of the currently dragged element.
    </Entry>
    <Entry name='d.vary(state, [["value"]])'>
      Continuously vary numeric values in state. Each path is an array of keys
      pointing to a number. The framework adjusts these values to place the
      dragged element.
    </Entry>
  </>
);

const ref050 = (
  <>
    <Entry name="data-on-drag">
      SVG attribute. Takes <Code>{"() => DragSpec<State>"}</Code>.
    </Entry>
    <Entry name="d.between(...states)">
      Interpolate between discrete states.
    </Entry>
    <Entry name="draggedId">
      The <Code>id</Code> of the currently dragged element.
    </Entry>
    <Entry name="d.vary(state, [path, ...])">
      Continuously vary numeric values. Works for any numeric parameter that
      affects the element's rendered position.{" "}
      <Code>{'d.vary(state, [["value"]])'}</Code>
    </Entry>
  </>
);

const ref060 = (
  <>
    <Entry name="data-on-drag">
      SVG attribute. Takes <Code>{"() => DragSpec<State>"}</Code>.
    </Entry>
    <Entry name="d.between(...states)">
      Interpolate between discrete states.
    </Entry>
    <Entry name="draggedId">
      The <Code>id</Code> of the currently dragged element.
    </Entry>
    <Entry name="d.vary(state, [path1, path2, ...])">
      Vary multiple numeric values simultaneously. Paths can reach into nested
      objects and arrays.{" "}
      <Code>{'d.vary(state, [["nodes", key, "x"], ["nodes", key, "y"]])'}</Code>
    </Entry>
  </>
);

const referenceByStudyNumber: Record<number, ReactNode> = {
  20: ref020,
  30: ref030,
  40: ref040,
  50: ref050,
  60: ref060,
};

export function ApiReference({ studyNumber }: { studyNumber: number }) {
  const content = referenceByStudyNumber[studyNumber];
  if (!content) return null;

  return (
    <details
      open
      className="bg-white rounded-lg shadow-sm border border-gray-200"
    >
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-gray-500 select-none hover:text-gray-700">
        API Reference
      </summary>
      <div className="px-4 pb-3 border-t border-gray-100 pt-2">{content}</div>
    </details>
  );
}
