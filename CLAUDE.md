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
