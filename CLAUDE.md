# Claude Code Workspace Guide

## Rules

- NEVER say "Perfect!" or similar overly enthusiastic confirmations.
- NEVER use `any` as a lazy workaround for type errors. Only use `any` when truly called for. Ask first.
- NEVER run `npm run dev`. The user will start the dev server when needed.
- NEVER mention Claude in commit messages.

## 1. Working on the Library Codebase

### Development

```bash
npm install       # Install dependencies
npm test          # Run tests
npm run build     # Build
npm run typecheck # Type check
```

### Key Files

| File | Purpose |
|---|---|
| `src/draggable.tsx` | `Draggable<T>` type, `Drag`, `SetState`, `OnDragPropValue` |
| `src/DraggableRenderer.tsx` | Low-level component that runs a `Draggable` with drag handling, spring animation |
| `src/DragSpec.tsx` | `DragSpec<T>` union type + constructors (`between`, `just`, `floating`, `closest`, `vary`, `andThen`, `withSnapRadius`, etc.) |
| `src/demo-ui.tsx` | `DemoDraggable` (wraps `DraggableRenderer` with debug UI), `DemoSettingsProvider`, `DemoSettingsBar`, `ConfigPanel`, `ConfigCheckbox`, `ConfigSelect`, `DemoNotes` |
| `src/demos.tsx` | Demo registry — array of `{ id, Component }` |
| `src/demo-diagrams/` | Individual demo implementations |
| `src/DemoPage.tsx` | Gallery page showing all demos |
| `src/SingleDemoPage.tsx` | Single demo page |
| `src/docs/LiveEditor.tsx` | Interactive code editor for docs (evaluates user code that exports `draggable` + `initialState`) |
| `src/svgx/` | SVG representation (`Svgx`, `LayeredSvgx`), transforms, interpolation |

### Architecture

```
Draggable<T>  (render function: state → SVG)
     ↓
DraggableRenderer  (low-level: drag state machine, spring animation, pointer handling)
     ↓
DemoDraggable  (wraps with debug overlays, tree view, state viewer)
```

DragSpec data flow:
```
DragSpec (plain data) → dragSpecToBehavior() → DragBehavior (frame → DragResult) → DraggableRenderer renders result
```

### SVG Representation

- `Svgx` = `React.ReactElement<React.SVGProps<SVGElement>>`
- `LayeredSvgx` = `{ byId: Map<string, Svgx>, descendents: ... }` — elements with `id` get pulled to top-level
- Root goes in with key `""`

## 2. Making Draggables

### Structure

Each demo in `src/demo-diagrams/` is a self-contained file registered in `src/demos.tsx`.

A draggable definition has four parts:

```typescript
import { DemoDraggable } from "../demo-ui";
import { Draggable } from "../draggable";
import { between } from "../DragSpec";

// 1. State type (must be an object)
type State = { value: boolean };

// 2. Initial state
const initialState: State = { value: false };

// 3. Draggable render function
const draggable: Draggable<State> = ({ state, drag }) => (
  <g>
    <rect
      id="my-element"
      data-on-drag={drag(() => between([{ value: true }, { value: false }]))}
    />
  </g>
);

// 4. Export as a component using DemoDraggable
export const MyDemo = () => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={400}
    height={300}
  />
);
```

### Drag Spec Constructors

| Function | Use |
|---|---|
| `between([state1, state2, ...])` | Drag between discrete states (interpolated) |
| `just(state)` | Always resolve to this state |
| `vary(state, ["x"], ["y"])` | Continuous numeric variation along paths |
| `floating(states, { backdrop })` | Float between states with a backdrop |
| `closest([spec1, spec2])` | Pick whichever spec is closest |
| `andThen(spec, nextState)` | Chain into a new drag on state change |
| `withSnapRadius(spec, radius)` | Snap within radius |
| `withDropTransition(spec, easing)` | Custom transition on drop |

### Gotchas

- **Transform ordering**: SVG transforms are right-to-left. Put `translate()` first: `translate(x, y) + rotate(angle)`
- **No React keys**: Use `id` attributes for element tracking, never `key`
- **No slashes in IDs**: Use hyphens — `id="node-1-2"` not `id="node/1/2"`
- **Positioning**: Always use `transform={translate(x, y)}`, never `x`/`y` attributes directly
- **Layering**: Use `data-z-index={isDragged ? 2 : 1}` to control draw order
- **Conditional drag**: `data-on-drag={condition && drag(...)}` to make things conditionally draggable
- **drag() wrapper**: Every `data-on-drag` value must be wrapped in `drag(...)` — the framework throws if you don't
- **`data-transition={false}`**: Elements with this skip spring animation and track the cursor directly

### Registration

Add to `src/demos.tsx`:

```typescript
import { MyDemo } from "./demo-diagrams/my-demo";

// Add to the demos array:
{ id: "my-demo", Component: MyDemo },
```

### Config Panels

For demos with user-configurable options:

```typescript
import { ConfigCheckbox, ConfigPanel, DemoDraggable } from "../demo-ui";

export const MyDemo = () => {
  const [showLabels, setShowLabels] = useState(true);
  const draggable = useMemo(() => makeDraggable(showLabels), [showLabels]);
  return (
    <div className="flex flex-col md:flex-row gap-4 items-start">
      <DemoDraggable draggable={draggable} initialState={state} width={400} height={300} />
      <ConfigPanel>
        <ConfigCheckbox label="Show labels" value={showLabels} onChange={setShowLabels} />
      </ConfigPanel>
    </div>
  );
};
```
