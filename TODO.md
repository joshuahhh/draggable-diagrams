# TODO

- [x] v2: snapping (in general, in spans)
  - some mild hysteresis with snaps; don't snap coming out of your start state?
- v2: nicer elastic feeling on release, like v1
  - customizable transitions?
- v2: better demo page, with options, etc.
- v2: drag chaining
- v2: do we want "context" in the DSL, to set props for lots of specs at once
- add cutesy "just return states" thing?
- memoize a lot of rendering of states? (but only if it's actually a problem; no premature stuff!)

- tiles: fix the thing where it transitions back home cuz there are multiple spans meeting there

- names...
  - background "radius" -> "threshold"?
  - withBackground -> withDefault?
  - "drawer" -> "engine"?
  - "data-on-drag" -> "dragTargets"? "targetStates"?
  - eliminate other "data-"s?
