# v2 feedback

I read through the v2 spec, the workshop tutorial, all 33 demo diagrams, and the current DragSpec/ManipulableDrawer implementation. Here's what I think.

Note on scope: v2 covers floating + params. Span/manifold stuff is deferred.

## The big picture

The core move of v2 is to unify the currently-separate `floating` and `vary` (params) drag modes into a composable algebra of drag specs, with "foreground with backdrop" as the central organizing principle. This is a natural generalization of what `floating()` already does -- floating already has states + an optional backdrop, and the backdrop can already be a `vary` spec. v2 makes this composition recursive and uniform.

The direction is sound. Here are the things I'd think about.

## Things that might pop up as problems

### 1. The `vary`-on-`states` question deserves a firm answer

You go back and forth on whether `.vary()` should operate on drag specs or individual states, and I think your instinct at the end ("maybe we just do `vary(state1, [...path1...])` like before") is right. Here's why:

When you write `states([s1, s2]).vary(...)`, the semantics get murky fast. Does the vary apply to the active state? To all states? Do the varied paths need to exist in all states? What if `s1` has a field that `s2` doesn't? The "frustration"-based region approach (option 2) is more principled but also way more expensive -- you're running numerical optimization for every state on every frame to compare frustrations.

Keeping `vary()` as a standalone thing that wraps a single state keeps it simple and predictable. And the interesting new combination you describe (vary foreground + vary backdrop) doesn't require vary to compose with states -- it just requires the drag spec algebra to allow vary specs in both foreground and background positions, which is already what you're proposing.

One more angle on this: the current `floating` already accepts `vary(...)` as a backdrop, and that works well (canvas-of-lists uses it). The v2 proposal generalizes this so vary can also appear in the foreground position. That's the useful new capability. Trying to also make vary *modify* a set of discrete states adds complexity without clear new expressive power -- it's a second axis of generalization that you don't need yet.

### 2. The "too far" heuristic is load-bearing and under-specified

The `withBackdrop` combinator needs a robust answer to "when do we switch from foreground to background?" Currently this is a hard-coded 50px distance. The spec mentions making it configurable and possibly overlap-based. But in a composable system where backdrops can nest, this becomes more important:

- With `states([s1,s2]).withBackdrop(states([s3,s4]).withBackdrop(states([s5,s6])))`, you need to evaluate each layer's "am I too far?" question. If outer layers are cheap (discrete states) and inner layers are expensive (vary), you might want to short-circuit.

- The overlap heuristic is appealing but introduces a dependency on element geometry that the current system doesn't have. Right now, the engine only cares about the *position* of the dragged element in each state (a single point). Overlap detection would require bounding boxes, which means more pre-computation.

- For vary-with-backdrop (your planet/orbit example), the "too far" threshold determines whether you're on the orbit or free-floating. Getting this wrong means the planet either snaps to orbit too eagerly or never snaps at all. This feels like it might need per-spec tuning rather than a global default.

I'd suggest making the threshold a first-class part of the drag spec rather than an option on `withBackdrop`. Something like wrapping states with a radius: `state(s1).within(50)` or similar. This lets the diagram author control snapping granularity per-state, not just per-backdrop-boundary.

Your self-observation in the spec is interesting -- that maybe the foreground's own distance-to-desired-position is sufficient and `withBackdrop` can just check if we're "too far" based on that, without needing extra metadata. That would be elegant if it works! But I'd be wary of cases where two foreground states are far apart and the "too far" threshold accidentally kicks in when you're between them (not near either, but not really wanting the backdrop either). The Voronoi approach helps here since it assigns every point to *some* state, but the distance to the assigned state can still be large if states are sparse.

### 3. Performance of nested evaluation

In the current engine, each frame during a drag does one of:
- Floating: distance check + maybe spring step (cheap)
- Params: numerical optimization (expensive but bounded)

With composable nested backdrops, a single frame might need to:
1. Evaluate the foreground drag spec
2. Determine "too far"
3. If too far, evaluate the backdrop drag spec
4. Which might itself need to evaluate *its* backdrop

If any of these layers involves `vary`, you're running numerical optimization at each level. Practically, I doubt anyone will nest more than 2-3 levels deep, but it's worth thinking about whether the evaluation should be lazy (only evaluate deeper layers when needed) or whether you want to cache/incrementally update.

The good news is that laziness is the natural approach here -- you only evaluate the backdrop when the foreground says "too far." But if the user is dragging back and forth across a boundary, you'll be thrashing between foreground and backdrop evaluation, which could cause frame drops if both involve optimization.

### 4. How does `andThen` / `Exit` fit in v2?

The current `Exit<T>` type (state + optional andThen) is used in a few important demos (insert-and-remove, list-of-lists) for cases where the displayed state during drag should differ from the state you transition to on release. For instance, in insert-and-remove, the delete state shows the item in a trash bin, but the andThen state removes the deleted flag so the trash bin appears empty after release.

The v2 spec doesn't mention this concept. Does it survive? Does the composable backdrop structure subsume it? I think `andThen` is orthogonal to the foreground/background composition -- it's about the *temporal* behavior after a drag ends, not the *spatial* behavior during a drag. It should probably still exist as a wrapper around individual states.

### 5. Spring smoothing across all transitions is ambitious

"Discontinuities are always smoothed with transient spring-driven interpolation" sounds elegant as a principle, but the current spring implementation only handles one case: the floating backdrop transition, where the background morphs between two pre-rendered SVGs. Generalizing this means:

- You need to be able to spring-interpolate between *any* two rendered states, which requires they be structurally compatible (same element IDs, same tree shape). The current `lerpHoisted` handles missing elements with opacity fading, but structurally very different states (e.g., different numbers of list items) can produce ugly intermediate frames.

- Springs have parameters (omega, gamma) that affect feel. A single global spring might feel right for some transitions and wrong for others. The current 200ms snap-after-spring is a nice compromise but might not work universally.

- During a spring transition, the user is still dragging. The spring target needs to track the "current desired state" as it changes, which can lead to the spring perpetually chasing a moving target if the user is moving fast between regions.

This isn't a reason not to do it -- just worth planning for edge cases early.

### 6. What does `states()` look like *during* a drag?

This is something the spec doesn't fully address. With current `floating`, the dragged element is ripped out and follows the cursor, while the background shows whichever state is closest (with the dragged element removed from it). That's the "floating" feel.

But the spec describes `states([s1, s2, s3])` with Voronoi-style behavior. During a drag, does the element follow the cursor (floating-style)? Or does the background just swap between states while the element stays put? I assume floating-style, since that's the scope, but it's worth being explicit. Especially because "Voronoi-style" in the current manifold system means something different (interpolation, not just nearest-neighbor switching).

For the v2 floating context, "Voronoi-style" presumably means: the background shows the nearest state (with dragged element removed), while the dragged element follows the cursor freely. That's already how `floating` works today. Maybe worth stating this explicitly to avoid confusion with the manifold Voronoi behavior that v2 is deferring.

## Opportunities for simplification

### 1. Consider a state-generation helper as a first-class concept

Across the demos, the most common pattern by far is:

```typescript
const stateWithout = produce(state, draft => { /* remove item */ });
const statesWith = produceAmb(stateWithout, draft => {
  const target = amb(possibleTargets);
  /* insert item at target */
});
return floating(statesWith, { backdrop: stateWithout });
```

This "remove, then enumerate all insertions" pattern appears in perm-floating, canvas-of-lists, canvas-of-lists-nested, list-of-lists, list-of-lists-sizes, insert-and-remove, outline, and todo. That's 8+ diagrams with nearly identical structure. Maybe v2 could have a dedicated helper for "floating rearrangement" that captures this pattern? Something like:

```typescript
rearrange({
  remove: (draft) => { draft.items.splice(idx, 1) },
  insertions: (draft) => {
    const pos = amb(_.range(draft.items.length + 1));
    draft.items.splice(pos, 0, item);
  },
  backdrop: stateWithout,  // or vary(...)
})
```

Though this might conflict with the "composable primitives" philosophy -- you could argue that the primitives are good enough and a helper is just sugar. And some of the 8 diagrams have interesting variations (canvas-of-lists creates a new row for the backdrop with vary; insert-and-remove has both rearrange states and a delete state with andThen). A helper that's too opinionated might not cover these.

### 2. The drag spec as a function from position to (state, distance)

You hint at this in the spec but don't fully commit to it. If a drag spec is fundamentally a function `(cursorPosition) => { state: T, distance: number }` (where `distance` is how far the dragged element ends up from the cursor), then:

- `states([s1, s2])` renders each, finds the dragged element's position in each, returns the nearest one
- `vary(s, paths)` runs optimization, returns the optimized state and residual distance
- `spec.withBackdrop(backdrop)` calls the foreground function, and if distance > threshold, calls the backdrop function instead

This formulation makes composition trivial and the "too far" question just becomes "is the returned distance above a threshold?" It also makes the engine simple: it just calls the top-level drag spec function on every frame. The question is whether this abstraction is sufficient -- can it handle spring smoothing, ghosts, andThen, and the other secondary concerns? I think those might need to live outside this core abstraction as decorators.

## On your uncertainties

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
  .otherwise(states([s4, s5]))
```

"Foreground/background" implies spatial layering, but what's actually happening is behavioral fallback. Though I concede that the spatial metaphor is intuitive for the common case -- and there *is* actual spatial layering happening (the floating element renders on top of the background).

Actually, thinking about it more, there's a tension here: "foreground/background" accurately describes the *rendering* (floating element on top, rest behind), while "fallback/otherwise" accurately describes the *selection logic* (try this behavior first, fall back to that one). Both are real. Maybe just pick whichever aspect you want to emphasize to users.

## Summary

The v2 direction is sound for the floating + params scope. The biggest risks I see are:

1. **"Too far" heuristics** becoming a tuning problem in nested compositions.
2. **Spring smoothing everywhere** being harder than expected due to structural mismatches between states.
3. **Vary-on-states** being a tempting generalization that adds complexity without proportionate expressiveness -- I'd resist it.

The biggest wins would be:

1. **Composable foreground + backdrop** enabling new interactions (your planet/orbit example is compelling).
2. **A uniform engine model** where floating and params are composed rather than handled as separate state-machine branches.
3. **Vary in both positions** (foreground and background) as a natural consequence of the composition, without needing to be a special case.

I'd prototype the simplest interesting case first: `states([s1, s2]).withBackdrop(s3)` where the states are discrete and the backdrop is a single state. Get the "too far" heuristic and spring smoothing right for that case, then extend to vary-driven backdrops and nesting.
