# v2 feedback

I read through the v2 spec, the workshop tutorial, all 33 demo diagrams, and the current DragSpec/ManipulableDrawer implementation. Here's what I think.

## The big picture

The core insight of v2 is good: the current system has three mostly-disjoint drag modes (`drag-manifolds`, `drag-floating`, `drag-params`) handled by separate code paths in the engine, and unifying them into a composable algebra of drag specs would be both cleaner and more expressive. The "foreground with backdrop" framing is a natural generalization of what `floating()` already does.

But I think there are some tensions in the proposal that are worth surfacing before prototyping.

## Things that might pop up as problems

### 1. The interaction model gap between `states()` and current `floating()`

The proposal treats `states([s1, s2, s3])` as equivalent to `floating([s1, s2, s3])`, but the current system implements these with fundamentally different interaction physics:

- **Manifold mode** (`span`): The dragged element stays _in the diagram_. Its position is determined by interpolation between pre-rendered positions. The element never leaves the "surface" of the manifold. This is what makes the permutation reorder feel so tight -- the tile is always at a valid interpolated position.

- **Floating mode**: The dragged element is _ripped out of the diagram_ and follows the cursor freely. The background updates independently. This is what makes canvas-of-lists feel like physically picking something up.

These are genuinely different interaction models, not just different distance thresholds. In the unified `states()` model, which one do you get? The spec says Voronoi-style, which sounds like the manifold behavior. But then how do you get the "pick up and carry" feeling that makes `floating` work? Is the idea that `states()` always floats the element? If so, the tight manifold interpolation from `span` would be lost.

I think this needs an explicit decision: does `states()` float the element or interpolate it? If the answer is "it depends on context" (e.g., `withBackdrop` triggers floating), that's a valid answer but it should be stated.

### 2. The `vary`-on-`states` question deserves a firm answer

You go back and forth on whether `.vary()` should operate on drag specs or individual states, and I think your instinct at the end ("maybe we just do `vary(state1, [...path1...])` like before") is right. Here's why:

When you write `states([s1, s2]).vary(...)`, the semantics get murky fast. Does the vary apply to the active state? To all states? Do the varied paths need to exist in all states? What if `s1` has a field that `s2` doesn't? The "frustration"-based region approach (option 2) is more principled but also way more expensive -- you're running numerical optimization for every state on every frame to compare frustrations.

Keeping `vary()` as a standalone thing that wraps a single state keeps it simple and predictable. And the interesting new combination you describe (vary foreground + vary backdrop) doesn't require vary to compose with states -- it just requires the drag spec algebra to allow vary specs in both foreground and background positions, which is already what you're proposing.

### 3. The "too far" heuristic is load-bearing and under-specified

The `withBackdrop` combinator needs a robust answer to "when do we switch from foreground to background?" Currently this is a hard-coded 50px distance. The spec mentions making it configurable and possibly overlap-based. But in a composable system where backdrops can nest, this becomes more important:

- With `states([s1,s2]).withBackdrop(states([s3,s4]).withBackdrop(states([s5,s6])))`, you need to evaluate each layer's "am I too far?" question. If outer layers are cheap (discrete states) and inner layers are expensive (vary), you might want to short-circuit.

- The overlap heuristic is appealing but introduces a dependency on element geometry that the current system doesn't have. Right now, the engine only cares about the _position_ of the dragged element in each state (a single point). Overlap detection would require bounding boxes, which means more pre-computation.

- For vary-with-backdrop (your planet/orbit example), the "too far" threshold determines whether you're on the orbit or free-floating. Getting this wrong means the planet either snaps to orbit too eagerly or never snaps at all. This feels like it might need per-spec tuning rather than a global default.

I'd suggest making the threshold a first-class part of the drag spec rather than an option on `withBackdrop`. Something like wrapping states with a radius: `state(s1).within(50)` or similar. This lets the diagram author control snapping granularity per-state, not just per-backdrop-boundary.

### 4. Performance of nested evaluation

In the current engine, each frame during a drag does one of:

- Manifold: barycentric interpolation (cheap)
- Floating: distance check + maybe spring step (cheap)
- Params: numerical optimization (expensive but bounded)

With composable nested backdrops, a single frame might need to:

1. Evaluate the foreground drag spec
2. Determine "too far"
3. If too far, evaluate the backdrop drag spec
4. Which might itself need to evaluate _its_ backdrop

If any of these layers involves `vary`, you're running numerical optimization at each level. Practically, I doubt anyone will nest more than 2-3 levels deep, but it's worth thinking about whether the evaluation should be lazy (only evaluate deeper layers when needed) or whether you want to cache/incrementally update.

### 5. How does `andThen` / `Exit` fit in v2?

The current `Exit<T>` type (state + optional andThen) is used in a few important demos (insert-and-remove, list-of-lists) for cases where the displayed state during drag should differ from the state you transition to on release. For instance, in insert-and-remove, the delete state shows the item in a trash bin, but the andThen state removes the deleted flag.

The v2 spec doesn't mention this concept. Does it survive? Does the composable backdrop structure subsume it? I think `andThen` is orthogonal to the foreground/background composition -- it's about the _temporal_ behavior after a drag ends, not the _spatial_ behavior during a drag. It should probably still exist as a wrapper around individual states.

### 6. Spring smoothing across all transitions is ambitious

"Discontinuities are always smoothed with transient spring-driven interpolation" sounds elegant as a principle, but the current spring implementation only handles one case: the floating backdrop transition, where the background morphs between two pre-rendered SVGs. Generalizing this means:

- You need to be able to spring-interpolate between _any_ two rendered states, which requires they be structurally compatible (same element IDs, same tree shape). The current `lerpHoisted` handles missing elements with opacity fading, but structurally very different states (e.g., different numbers of list items) can produce ugly intermediate frames.

- Springs have parameters (omega, gamma) that affect feel. A single global spring might feel right for some transitions and wrong for others. The current 200ms snap-after-spring is a nice compromise but might not work universally.

- During a spring transition, the user is still dragging. The spring target needs to track the "current desired state" as it changes, which can lead to the spring perpetually chasing a moving target if the user is moving fast between regions.

This isn't a reason not to do it -- just worth planning for edge cases early.

## Opportunities for simplification

### 1. Drop the distinction between `span` and `straightTo`

Currently, `straightTo(state)` is just `span([currentState, targetState])` but with the current state implicitly included. In practice, diagrams that use `straightTo` always return arrays of them (e.g., `[canMoveLeft && straightTo(leftState), canMoveRight && straightTo(rightState)]`). This could be `states([currentState, ...conditionalStates].filter(Boolean))` in v2. The `straightTo` concept doesn't add much and removing it simplifies the type hierarchy.

### 2. Consider a state-generation helper as a first-class concept

Across the demos, the most common pattern by far is:

```typescript
const stateWithout = produce(state, (draft) => {
  /* remove item */
});
const statesWith = produceAmb(stateWithout, (draft) => {
  const target = amb(possibleTargets);
  /* insert item at target */
});
return floating(statesWith, { backdrop: stateWithout });
```

This "remove, then enumerate all insertions" pattern appears in perm-floating, canvas-of-lists, canvas-of-lists-nested, list-of-lists, list-of-lists-sizes, insert-and-remove, outline, and todo. That's 8+ diagrams with nearly identical structure. Maybe v2 could have a dedicated helper for "floating rearrangement" that captures this pattern? Something like:

```typescript
rearrange({
  remove: (draft) => {
    draft.items.splice(idx, 1);
  },
  insertions: (draft) => {
    const pos = amb(_.range(draft.items.length + 1));
    draft.items.splice(pos, 0, item);
  },
  backdrop: stateWithout, // or vary(...)
});
```

Though this might conflict with the "composable primitives" philosophy -- you could argue that the primitives are good enough and a helper is just sugar.

### 3. Unify the "foreground" concept

Right now there are three kinds of foreground behavior:

1. **Manifold interpolation** (span): element stays in diagram, interpolated
2. **Floating** (floating): element ripped out, follows cursor
3. **Params** (vary): element stays in diagram, position computed by optimization

In v2, if you think of "foreground" as "what happens to the dragged element", you could model these as three strategies:

```
interpolate(states)  -- manifold-style
float(states)        -- floating-style
optimize(paths)      -- vary-style
```

And then the foreground/background composition works the same way regardless of which strategy the foreground uses. This makes the algebra more explicit about what _kind_ of drag interaction you're creating.

## On your uncertainties

### `span` as a "foreground"

Your instinct to treat span as a leaf-node foreground seems right. The key question is whether span-inside-backdrop makes sense: `float(states).withBackdrop(span(otherStates))`. I think it does -- it means "pick up the item, and if you drag it far away, snap it to interpolated positions between otherStates." The reverse (`span(states).withBackdrop(float(otherStates))`) is weirder but conceivable -- "interpolate between positions, and if you drag far from the manifold, let the item float."

I wouldn't try to put vary _inside_ spans right now. That's a research project unto itself (continuous variation along a manifold), and the use cases aren't clear.

### Ghosts in hierarchies

Ghost display (showing a preview of where the element will land) currently only works in floating mode. In the composable model, I'd suggest ghosts are a property of individual states rather than the drag spec. When you write `state(s1).withGhost()`, it means "when the drag is near s1, show a ghost of the element at its s1 position." This naturally composes -- different states in a hierarchy can independently decide whether to show ghosts.

### Snapping

The `snapWithin(radius)` idea is good. I'd lean toward making it a property of individual states: `states(myStates.map(s => state(s).snapWithin(5)))`. This is because different states in the same drag spec might deserve different snap radii (e.g., a "home position" with a large snap radius vs. other positions with small ones). The shorthand `states(myStates).snapWithin(5)` could work as sugar that applies to all states uniformly.

### Animation control

For cases where a user doesn't want animation across a boundary: the simplest approach is a `.immediate()` modifier on the boundary, like `states(...).withBackdrop(backdrop, { immediate: true })`. This is a pragmatic escape hatch. The more principled approach would be to let the user control the spring parameters per-boundary, including a "stiffness = infinity" option that effectively disables animation.

## One more thought: naming

The doc mentions renaming "backdrop" to "background" and repurposing "backdrop" for the internal rendered-behind-floating concept. I'd go further and consider whether "foreground/background" is the right frame at all. What you're really describing is a priority-ordered chain of behaviors: "try this first, and if it doesn't fit, try that." This is more like pattern matching or a chain of responsibility. Names like `fallback` or `otherwise` might capture the semantics better:

```typescript
states([s1, s2, s3])
  .otherwise(vary(backState, ["x"], ["y"]))
  .otherwise(states([s4, s5]));
```

"Foreground/background" implies spatial layering, but what's actually happening is behavioral fallback. Though I concede that the spatial metaphor is intuitive for the common case.

## Summary

The v2 direction is sound. The biggest risks I see are:

1. **Losing the manifold/floating distinction** -- these are genuinely different interaction models and flattening them might sacrifice the tight feel of manifold drags.
2. **"Too far" heuristics** becoming a tuning nightmare in nested compositions.
3. **Spring smoothing everywhere** being harder than expected due to structural mismatches between states.

The biggest wins would be:

1. **Composable foreground + backdrop** enabling new interactions (your planet/orbit example is compelling).
2. **Removing the tripartite engine state machine** in favor of a uniform recursive evaluator.
3. **Making the system more learnable** -- right now a new user has to understand span vs. floating vs. vary as entirely separate concepts before they can do anything interesting.

I'd prototype the simplest interesting case first: `states([s1, s2]).withBackdrop(s3)` where the states are discrete and the backdrop is a single state. Get the "too far" heuristic right for that case, then extend to vary-driven backdrops and nesting.
