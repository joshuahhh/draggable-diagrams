# Claude Code Workspace Guide

This document provides guidance for working on the draggable-diagrams codebase.

## How not to annoy the user

- NEVER say "Perfect!" or similar overly enthusiastic confirmations – your work is rarely perfect. Just explain what was done.
- NEVER use `any` as a lazy workaround for type errors. Only use `any` when it is truly called for (e.g., interfacing with untyped external code, or when the type system genuinely cannot express the constraint). Ask first.
- NEVER use React keys in "Manipulable" definitions. They don't use them.
- NEVER run `npm run dev`. The user will start the dev server when needed.

## Project Overview

This project implements interactive, draggable SVG diagrams with sophisticated state interpolation. The core concept is **manifolds** - continuous spaces of valid states that elements can be dragged through. When you drag an element, the system finds nearby valid states and smoothly interpolates between them.

## Development Workflow

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run specific test file
npm test -- svg-transform.test --run

# Build
npm run build

# Type check
npm run typecheck
```

**IMPORTANT:** Do NOT run `npm run dev` automatically. The user will start the dev server when needed.

## Important Gotchas

### 1. Transform Ordering

SVG transforms are right-to-left. Always put `translate()` first in your string:

```typescript
// ✓ Correct
transform={translate(x, y) + rotate(angle)}

// ✗ Wrong
transform={rotate(angle) + translate(x, y)}
```

### 2. No React Keys

The framework uses `id` attributes for element tracking, not React's `key`:

```typescript
// ✓ Correct
<rect id="my-element" />

// ✗ Wrong
<rect key="my-element" />  // Error!
```

### 3. No Slashes in IDs

IDs cannot contain `/` - use hyphens or other separators:

```typescript
// ✓ Correct
<g id="node-1-2" />

// ✗ Wrong
<g id="node/1/2" />  // Error!
```

### 4. Read Before Edit/Write

The Edit and Write tools require reading the file first. Always use Read tool before modifying files.

## How to Make a Draggable Diagram

### Basic Structure

1. **Define your state type** - Must be an object. This represents all possible configurations of your diagram:

   ```typescript
   export type State = {
     items: string[];
     selectedId?: string;
   };
   ```

2. **Export initial states** - Provide one or more starting configurations:

   ```typescript
   export const state1: State = {
     items: ["A", "B", "C"],
   };
   ```

3. **Write the manipulable** - A function that renders SVG based on state:
   ```typescript
   export const manipulable: Manipulable<State> = ({
     state,
     drag,
     draggedId,
   }) => {
     return <g>{/* your SVG elements */}</g>;
   };
   ```

### Making Things Draggable

**For discrete state changes** (e.g., reordering, moving between positions):

- Attach `data-on-drag={drag(...)}` to the element
- Use `span([...states])` to drag between multiple states
- Only attach to elements that should be draggable (check conditions first)

**For continuous state changes** (e.g., angles, positions):

- Use `vary(["path", "to", "number"])` to control a numeric value
- Use `vary(["x"], ["y"])` for multiple values

**Floating pattern** (moving items between containers):

```typescript
data-on-drag={drag(() => {
  // Remove item from current location
  const stateWithout = produce(state, (draft) => {
    draft.items.splice(currentIdx, 1);
  });

  // Generate all valid placement states
  const statesWith = possiblePositions.map(pos =>
    produce(stateWithout, (draft) => {
      draft.items.splice(pos, 0, item);
    })
  );

  return floating(statesWith, { backdrop: stateWithout });
})}
```

### Key Patterns

- **Positioning**: Always use `transform={translate(x, y)}`, never `x` and `y` attributes
- **Element tracking**: Use `id` attributes on draggable elements (required for proper interpolation)
- **Layering**: Use `data-z-index={isDragged ? 2 : 1}` to control draw order
- **Conditional draggability**: Use `data-on-drag={condition && drag(...)}` to only make certain elements draggable
- **Visual feedback**: Use `draggedId` to style the currently-dragged element differently

### Registration

Add your diagram to `src/demos.tsx`:

```typescript
import { YourDiagram } from "./demo-diagrams/your-diagram";

demoData({
  id: "your-diagram",
  title: "Your Diagram Title",
  notes: <>Optional description</>,
  manipulable: YourDiagram.manipulable,
  initialStates: [YourDiagram.state1],
  height: 200,
  padding: 20,
  sourceFile: "your-diagram.tsx",
});
```
