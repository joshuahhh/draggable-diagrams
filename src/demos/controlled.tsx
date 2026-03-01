import { useCallback, useState } from "react";
import { demo } from "../demo";
import { DemoNotes } from "../demo/ui";
import { Draggable } from "../draggable";
import { DraggableRenderer } from "../DraggableRenderer";
import { translate } from "../svgx/helpers";

type State = {
  value: boolean;
};

const SQUARE_SIZE = 40;
const TRACK_LENGTH = 60;

const draggable: Draggable<State> = ({ state, d }) => (
  <g>
    <line
      x1={SQUARE_SIZE / 2}
      y1={SQUARE_SIZE / 2}
      x2={TRACK_LENGTH + SQUARE_SIZE / 2}
      y2={SQUARE_SIZE / 2}
      stroke="#cbd5e1"
      strokeWidth={6}
      strokeLinecap="round"
    />
    <rect
      id="switch"
      transform={translate(state.value ? TRACK_LENGTH : 0, 0)}
      width={SQUARE_SIZE}
      height={SQUARE_SIZE}
      rx={4}
      dragology={() =>
        d
          .between([{ value: true }, { value: false }])
          .withSnapRadius(10)
          .withDropTransition("elastic-out")
      }
    />
  </g>
);

const SimpleDemo = () => {
  const [state, setState] = useState<State>({ value: false });

  return (
    <>
      <h3 className="text-md font-medium italic mt-6 mb-1">simple</h3>
      <DemoNotes>
        A normal use-case – the parent accepts changes from the draggable, but
        also makes its own changes.
      </DemoNotes>
      <div className="mb-2 text-sm text-slate-500">
        value: {String(state.value)}
      </div>
      <div className="mb-2">
        <button
          className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 text-sm"
          onClick={() => setState({ value: !state.value })}
        >
          Toggle externally
        </button>
      </div>
      <div className="mb-2">
        <DraggableRenderer
          draggable={draggable}
          state={state}
          onStateChange={setState}
          width={150}
          height={40}
        />
      </div>
    </>
  );
};

const DoubleDemo = () => {
  const [state, setState] = useState<State>({ value: false });

  return (
    <>
      <h3 className="text-md font-medium italic mt-6 mb-1">double</h3>
      <DemoNotes>
        Two draggable components controlled by the same state.
      </DemoNotes>
      <div className="mb-2">
        <DraggableRenderer
          draggable={draggable}
          state={state}
          onStateChange={setState}
          width={150}
          height={40}
        />
      </div>
      <div className="mb-2">
        <DraggableRenderer
          draggable={draggable}
          state={state}
          onStateChange={setState}
          width={150}
          height={40}
        />
      </div>
    </>
  );
};

const RejectionDemo = () => {
  const [state, setState] = useState<State>({ value: false });

  const onStateChange = useCallback(
    (newState: State) => {
      console.log("onStateChange", newState, "old was", state.value);
      if (newState.value === true) {
        setState(newState);
      }
    },
    [state.value],
  );

  return (
    <>
      <h3 className="text-md font-medium italic mt-6 mb-1">rejection</h3>
      <DemoNotes>Here the parent only accepts changes to "true".</DemoNotes>
      <DraggableRenderer
        draggable={draggable}
        state={state}
        onStateChange={onStateChange}
        width={150}
        height={40}
      />
    </>
  );
};

const OverrideDemo = () => {
  const [state, setState] = useState<State>({ value: false });

  const onStateChange = useCallback((newState: State) => {
    setState({ value: !newState.value });
  }, []);

  return (
    <>
      <h3 className="text-md font-medium italic mt-6 mb-1">override</h3>
      <DemoNotes>
        Here the parent interprets all changes as the opposite of what the
        draggable asks for.
      </DemoNotes>
      <DraggableRenderer
        draggable={draggable}
        state={state}
        onStateChange={onStateChange}
        width={150}
        height={40}
      />
    </>
  );
};

export default demo(
  () => {
    return (
      <div>
        <DemoNotes>
          A few simple tests of using <code>{"<DraggableRenderer>"}</code> as a{" "}
          <i>controlled component</i> – its React parent ultimately controls its
          state.
        </DemoNotes>
        <SimpleDemo />
        <DoubleDemo />
        <RejectionDemo />
        <OverrideDemo />
      </div>
    );
  },
  { tags: ["controlled"] },
);
