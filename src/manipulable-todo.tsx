import { produce } from "immer";
import _ from "lodash";
import { span } from "./DragSpec";
import { Manipulable, SetState, translate } from "./manipulable";
import { Svgx } from "./svgx";

export namespace Todo {
  export type TodoItem = {
    id: string;
    completed: boolean;
    text: string;
  };

  export type State = {
    todos: TodoItem[];
    todoDraft: TodoItem;
  };

  const TILE_SIZE = 55;

  export const manipulable: Manipulable<State> = ({
    state,
    draggable,
    draggedId,
    setState,
  }) => {
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
        {drawTodoItem(state.todoDraft, translate(10, 10), 0, 0, setState)}

        {state.todos.map((todo, idx) => {
          const isDragged = todo.id === draggedId;
          return draggable(
            drawTodoItem(
              todo,
              translate(10 - (isDragged ? 5 : 0), 80 + idx * TILE_SIZE),
              isDragged ? 1 : 0,
              1,
              setState
            ),
            () =>
              span(
                _.range(state.todos.length).map((newIdx) =>
                  produce(state, (s) => {
                    const [removed] = s.todos.splice(idx, 1);
                    s.todos.splice(newIdx, 0, removed);
                  })
                )
              )
          );
        })}
      </g>
    );
  };

  function drawTodoItem(
    todo: TodoItem,
    transform: string,
    zIndex: number,
    opacity = 1,
    setState: SetState<State>
  ): Svgx {
    return (
      <foreignObject
        id={todo.id}
        transform={transform}
        data-z-index={zIndex}
        style={{ opacity, overflow: "visible" }}
        x={0}
        y={0}
        width={350}
        height={45}
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

  export const state1: State = {
    todos: [
      { id: "a", completed: false, text: "Buy milk" },
      { id: "b", completed: true, text: "Walk the dog" },
      { id: "c", completed: false, text: "Read a book" },
    ],
    todoDraft: { id: "draft", completed: false, text: "" },
  };
}
