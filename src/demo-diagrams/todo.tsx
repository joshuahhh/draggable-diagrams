import { produce } from "immer";
import _ from "lodash";
import { ConfigCheckbox, ConfigPanelProps } from "../configurable";
import { configurableManipulable } from "../demos";
import { floating, span } from "../DragSpec";
import { SetState } from "../manipulable";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";

export namespace Todo {
  type TodoItem = {
    id: string;
    completed: boolean;
    text: string;
  };

  type State = {
    todos: TodoItem[];
    todoDraft: TodoItem;
  };

  export const state1: State = {
    todos: [
      { id: "a", completed: false, text: "Buy milk" },
      { id: "b", completed: true, text: "Walk the dog" },
      { id: "c", completed: false, text: "Read a book" },
    ],
    todoDraft: { id: "draft", completed: false, text: "" },
  };

  export type Config = {
    useDetachReattach: boolean;
  };

  const defaultConfig: Config = {
    useDetachReattach: false,
  };

  const TILE_SIZE = 55;

  export const manipulable = configurableManipulable<State, Config>(
    { defaultConfig, ConfigPanel },
    (config, { state, drag, draggedId, setState }) => {
      return (
        <g>
          <foreignObject
            x={10}
            y={10}
            width={350}
            height={60}
            style={{ overflow: "visible" }}
          >
            <div className="flex flex-row gap-2">
              <input
                type="text"
                value={state.todoDraft.text}
                onChange={(e) => {
                  setState(
                    produce(state, (s) => {
                      s.todoDraft.text = e.target.value;
                    }),
                    { immediate: true }
                  );
                }}
                placeholder="What needs to be done?"
                className="border-2 border-gray-200 rounded-lg px-4 py-2 flex-1 text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
              />
              <button
                className="px-5 py-2 bg-blue-500 text-white rounded-lg whitespace-nowrap hover:bg-blue-600 active:bg-blue-700 transition-colors font-medium shadow-sm"
                onClick={() => {
                  if (state.todoDraft.text === "") return;
                  setState(
                    produce(state, (s) => {
                      s.todos.unshift(s.todoDraft);
                      s.todoDraft = {
                        id: `todo-${Date.now()}`,
                        completed: false,
                        text: "",
                      };
                    })
                  );
                }}
              >
                Add
              </button>
            </div>
          </foreignObject>
          {drawTodoItem({
            todo: state.todoDraft,
            transform: translate(10, 10),
            opacity: 0,
            setState,
          })}

          {state.todos.map((todo, idx) => {
            const isDragged = todo.id === draggedId;
            return drawTodoItem({
              todo,
              transform: translate(
                10 - (isDragged && !config.useDetachReattach ? 5 : 0),
                80 + idx * TILE_SIZE
              ),
              "data-z-index": isDragged ? 1 : 0,
              opacity: 1,
              setState,
              "data-on-drag": drag(() => {
                const stateWithout = produce(state, (s) => {
                  s.todos.splice(idx, 1);
                });
                const statesWith = _.range(state.todos.length).map((newIdx) =>
                  produce(stateWithout, (s) => {
                    s.todos.splice(newIdx, 0, todo);
                  })
                );
                return config.useDetachReattach
                  ? floating(statesWith, { backdrop: stateWithout })
                  : span(statesWith);
              }),
            });
          })}
        </g>
      );
    }
  );

  function drawTodoItem({
    todo,
    setState,
    opacity = 1,
    ...otherProps
  }: {
    todo: TodoItem;
    opacity?: number;
    setState: SetState<State>;
  } & React.SVGProps<SVGForeignObjectElement>): Svgx {
    return (
      <foreignObject
        id={todo.id}
        style={{ opacity, overflow: "visible" }}
        x={0}
        y={0}
        width={350}
        height={45}
        {...otherProps}
      >
        <div className="flex flex-row items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all cursor-move">
          <input
            type="checkbox"
            checked={todo.completed}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              setState(
                produce((s: State) => {
                  const t = s.todos.find((td) => td.id === todo.id);
                  if (t) {
                    t.completed = e.target.checked;
                  }
                }),
                { immediate: true }
              );
            }}
            className="w-5 h-5 rounded border-2 border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer"
          />

          <span
            className={`flex-1 text-gray-700 ${
              todo.completed ? "line-through text-gray-400" : ""
            }`}
          >
            {todo.text}
          </span>
        </div>
      </foreignObject>
    );
  }

  function ConfigPanel({ config, setConfig }: ConfigPanelProps<Config>) {
    return (
      <ConfigCheckbox
        label="Detach/reattach"
        value={config.useDetachReattach}
        onChange={(newValue) =>
          setConfig({ ...config, useDetachReattach: newValue })
        }
      />
    );
  }
}
