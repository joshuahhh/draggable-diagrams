import { useMemo, useState } from "react";
import { demo } from "../demo";
import {
  ConfigPanel,
  ConfigSelect,
  DemoDraggable,
  DemoNotes,
  DemoWithConfig,
} from "../demo/ui";
import { Draggable } from "../draggable";
import { lessThan, moreThan } from "../DragSpec";
import { PathIn } from "../paths";
import { translate } from "../svgx/helpers";

// Face dimensions (hardcoded — candidates for future state)
const FACE_CX = 200;
const FACE_CY = 180;
const FACE_R = 120;

const EYE_R = 12;
const FACE_STROKE = 3;
const MOUTH_STROKE = 4;
// Eyes must stay fully inside face edge (accounting for radii and strokes)
const FACE_MARGIN = EYE_R + FACE_STROKE / 2 + 2;
// Mouth curve must clear eyes (eye radius + half mouth stroke + gap)
const EYE_MARGIN = EYE_R + MOUTH_STROKE / 2 + 4;
// Minimum gap between eye line and mouth endpoints
const EYE_MOUTH_GAP = EYE_R + MOUTH_STROKE / 2 + 4;
const MIN_EYE_SPACING = EYE_R + 5;

// The lowest the mouth can go (face bottom minus margin)
const FACE_BOTTOM = FACE_CY + FACE_R - FACE_MARGIN;

type CouplingMode = "none" | "free" | "coupled";

type State = {
  eyeY: number;
  eyeDx: number;
  mouthDx: number;
  mouthEy: number;
  cp1dx: number;
  cp1dy: number;
  cp2dx: number;
  cp2dy: number;
  pinned: { eyes: boolean; mouth: boolean };
};

const initialState: State = {
  eyeY: FACE_CY - 25,
  eyeDx: 40,
  mouthDx: 50,
  mouthEy: FACE_CY + 40,
  cp1dx: 20,
  cp1dy: 30,
  cp2dx: -20,
  cp2dy: 30,
  pinned: { eyes: false, mouth: false },
};

// Derived positions
function mouthLeft(s: State) {
  return { x: FACE_CX - s.mouthDx, y: s.mouthEy };
}
function mouthRight(s: State) {
  return { x: FACE_CX + s.mouthDx, y: s.mouthEy };
}
function cp1(s: State) {
  const ml = mouthLeft(s);
  return { x: ml.x + s.cp1dx, y: ml.y + s.cp1dy };
}
function cp2(s: State) {
  const mr = mouthRight(s);
  return { x: mr.x + s.cp2dx, y: mr.y + s.cp2dy };
}
function leftEye(s: State) {
  return { x: FACE_CX - s.eyeDx, y: s.eyeY };
}
function rightEye(s: State) {
  return { x: FACE_CX + s.eyeDx, y: s.eyeY };
}

function mouthPath(s: State): string {
  const ml = mouthLeft(s);
  const mr = mouthRight(s);
  const c1 = cp1(s);
  const c2 = cp2(s);
  return `M ${ml.x} ${ml.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${mr.x} ${mr.y}`;
}

function evalMouthBezier(s: State, t: number): { x: number; y: number } {
  const p0 = mouthLeft(s);
  const p1 = cp1(s);
  const p2 = cp2(s);
  const p3 = mouthRight(s);
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  };
}

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

const faceCenter = { x: FACE_CX, y: FACE_CY };

function allConstraints(s: State): number[] {
  const results: number[] = [];
  const le = leftEye(s);
  const re = rightEye(s);
  const ml = mouthLeft(s);
  const mr = mouthRight(s);

  results.push(lessThan(dist(le, faceCenter), FACE_R - FACE_MARGIN));
  results.push(lessThan(dist(re, faceCenter), FACE_R - FACE_MARGIN));
  results.push(moreThan(s.eyeDx, MIN_EYE_SPACING));
  results.push(lessThan(dist(ml, faceCenter), FACE_R - FACE_MARGIN));
  results.push(lessThan(dist(mr, faceCenter), FACE_R - FACE_MARGIN));
  results.push(moreThan(s.mouthDx, 10));

  // CP offset magnitude limit (prevents sharp cusps)
  const MAX_CP_OFFSET = 100;
  results.push(
    lessThan(Math.sqrt(s.cp1dx ** 2 + s.cp1dy ** 2), MAX_CP_OFFSET),
  );
  results.push(
    lessThan(Math.sqrt(s.cp2dx ** 2 + s.cp2dy ** 2), MAX_CP_OFFSET),
  );

  const N = 8;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const pt = evalMouthBezier(s, t);
    results.push(lessThan(dist(pt, faceCenter), FACE_R - FACE_MARGIN));
    results.push(moreThan(dist(pt, le), EYE_R + EYE_MARGIN));
    results.push(moreThan(dist(pt, re), EYE_R + EYE_MARGIN));
  }
  for (let i = 0; i < N; i++) {
    const pt1 = evalMouthBezier(s, i / N);
    const pt2 = evalMouthBezier(s, (i + 1) / N);
    results.push(lessThan(pt1.x, pt2.x));
  }
  return results;
}

const CURVE_SAMPLES = 11;
const tValues = Array.from(
  { length: CURVE_SAMPLES },
  (_, i) => (i + 1) / (CURVE_SAMPLES + 1),
);

const ENDPOINT_R = 6;
const PIN_R = 5;
const PIN_X = FACE_CX + FACE_R + 18;

function makeDraggable(couplingMode: CouplingMode): Draggable<State> {
  return ({ state, d, draggedId }) => {
    const ml = mouthLeft(state);
    const mr = mouthRight(state);
    const le = leftEye(state);
    const re = rightEye(state);
    const eyesPinned = state.pinned.eyes;
    const mouthPinned = state.pinned.mouth;

    function eyeDragology() {
      const paths: PathIn<State, number>[] = [["eyeY"], ["eyeDx"]];
      if (!mouthPinned) {
        paths.push(["mouthEy"]);
        // "free": COBYLA also varies CP offsets (may drift)
        if (couplingMode === "free") {
          paths.push(["cp1dx"], ["cp1dy"], ["cp2dx"], ["cp2dy"]);
        }
      }
      const spec = d.vary(state, paths, { constraint: allConstraints });
      // "coupled": deterministic scaling — CP offsets scale with available space
      if (couplingMode === "coupled" && !mouthPinned) {
        const origSpace = FACE_BOTTOM - state.mouthEy;
        const origCp1dy = state.cp1dy;
        const origCp2dy = state.cp2dy;
        return spec.during((s) => {
          const newSpace = FACE_BOTTOM - s.mouthEy;
          const scale = origSpace > 0 ? newSpace / origSpace : 1;
          return { ...s, cp1dy: origCp1dy * scale, cp2dy: origCp2dy * scale };
        });
      }
      return spec;
    }

    function endpointDragology() {
      const paths: PathIn<State, number>[] = [["mouthDx"], ["mouthEy"]];
      if (!eyesPinned) paths.push(["eyeY"]);
      return d.vary(state, paths, { constraint: allConstraints });
    }

    function curveDragology(t: number) {
      const paths: PathIn<State, number>[] =
        t < 0.4
          ? [["cp1dx"], ["cp1dy"]]
          : t > 0.6
            ? [["cp2dx"], ["cp2dy"]]
            : [["cp1dx"], ["cp1dy"], ["cp2dx"], ["cp2dy"]];
      if (!eyesPinned) paths.push(["eyeY"]);
      return d.vary(state, paths, { constraint: allConstraints });
    }

    return (
      <g>
        {/* Face outline */}
        <circle
          id="face"
          cx={FACE_CX}
          cy={FACE_CY}
          r={FACE_R}
          fill="#ffe0b2"
          stroke="#e6a756"
          strokeWidth={3}
          data-z-index={0}
        />

        {/* Eyes */}
        <circle
          id="left-eye"
          transform={translate(le.x, le.y)}
          r={EYE_R}
          fill="#333"
          data-z-index={1}
          dragology={eyeDragology}
        />
        <circle
          id="right-eye"
          transform={translate(re.x, re.y)}
          r={EYE_R}
          fill="#333"
          data-z-index={1}
          dragology={eyeDragology}
        />

        {/* Mouth curve */}
        <path
          id="mouth"
          d={mouthPath(state)}
          fill="none"
          stroke="#c0392b"
          strokeWidth={4}
          strokeLinecap="round"
          style={{ pointerEvents: "none" }}
          data-z-index={1}
        />

        {/* Drag handles along the mouth curve */}
        {tValues.map((t) => {
          const pt = evalMouthBezier(state, t);
          const id = `mouth-${t}`;
          const isDragged = draggedId === id;
          return (
            <circle
              id={id}
              transform={translate(pt.x, pt.y)}
              r={isDragged ? 8 : 14}
              fill={isDragged ? "rgba(192, 57, 43, 0.4)" : "transparent"}
              data-z-index={2}
              dragology={() => curveDragology(t)}
            />
          );
        })}

        {/* Mouth endpoint handles */}
        <circle
          id="mouth-endpoint-left"
          transform={translate(ml.x, ml.y)}
          r={ENDPOINT_R}
          fill={draggedId === "mouth-endpoint-left" ? "#e74c3c" : "#c0392b"}
          stroke="#7f1d1d"
          strokeWidth={1.5}
          data-z-index={3}
          dragology={endpointDragology}
        />
        <circle
          id="mouth-endpoint-right"
          transform={translate(mr.x, mr.y)}
          r={ENDPOINT_R}
          fill={draggedId === "mouth-endpoint-right" ? "#e74c3c" : "#c0392b"}
          stroke="#7f1d1d"
          strokeWidth={1.5}
          data-z-index={3}
          dragology={endpointDragology}
        />

        {/* Pin toggles */}
        <g id="pin-eyes" data-z-index={4}>
          <circle
            transform={translate(PIN_X, state.eyeY)}
            r={PIN_R}
            fill={eyesPinned ? "#666" : "transparent"}
            stroke={eyesPinned ? "#666" : "#ccc"}
            strokeWidth={1.5}
            dragology={() =>
              d.fixed({
                ...state,
                pinned: { ...state.pinned, eyes: !eyesPinned },
              })
            }
          />
          <line
            x1={PIN_X}
            y1={state.eyeY - PIN_R + 1}
            x2={PIN_X}
            y2={state.eyeY + PIN_R + 3}
            stroke="#666"
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={eyesPinned ? 1 : 0}
          />
        </g>
        <g id="pin-mouth" data-z-index={4}>
          <circle
            transform={translate(PIN_X, state.mouthEy)}
            r={PIN_R}
            fill={mouthPinned ? "#666" : "transparent"}
            stroke={mouthPinned ? "#666" : "#ccc"}
            strokeWidth={1.5}
            dragology={() =>
              d.fixed({
                ...state,
                pinned: { ...state.pinned, mouth: !mouthPinned },
              })
            }
          />
          <line
            x1={PIN_X}
            y1={state.mouthEy - PIN_R + 1}
            x2={PIN_X}
            y2={state.mouthEy + PIN_R + 3}
            stroke="#666"
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={mouthPinned ? 1 : 0}
          />
        </g>
      </g>
    );
  };
}

const couplingModes: readonly CouplingMode[] = ["none", "free", "coupled"];
const couplingLabels: Record<CouplingMode, string> = {
  none: "None — rigid push only",
  free: "Free — COBYLA varies curve shape",
  coupled: "Coupled — curve scales with space",
};

export default demo(
  () => {
    const [couplingMode, setCouplingMode] = useState<CouplingMode>("none");
    const draggable = useMemo(() => makeDraggable(couplingMode), [couplingMode]);
    return (
      <DemoWithConfig>
        <div>
          <DemoNotes>
            Drag eyes to move/space them. Drag the mouth curve or endpoints.
            Unpinned features get pushed. Click indicators on the right to
            pin/unpin.
          </DemoNotes>
          <DemoDraggable
            draggable={draggable}
            initialState={initialState}
            width={400}
            height={350}
          />
        </div>
        <ConfigPanel>
          <ConfigSelect
            label="Eye→mouth coupling"
            value={couplingMode}
            onChange={setCouplingMode}
            options={couplingModes}
            stringifyOption={(m) => couplingLabels[m]}
          />
        </ConfigPanel>
      </DemoWithConfig>
    );
  },
  { tags: ["d.vary"] },
);
