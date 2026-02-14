import { produce } from "immer";
import React from "react";
import { demo } from "../demo";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { DragSpec, DragSpecBuilder, lessThan } from "../DragSpec";
import { translate } from "../svgx/helpers";
import { makeId } from "../utils";

// ─── Types ───

type StateExpr = { type: "state"; label: "A" | "B" | "C" };
type BetweenExpr = { type: "between"; childIds: string[] };
type WithSnapRadiusExpr = {
  type: "withSnapRadius";
  childId: string | null;
  radius: number;
};
type ClosestExpr = { type: "closest"; childIds: string[] };
type FloatingExpr = { type: "floating"; childId: string | null };
type Expr =
  | StateExpr
  | BetweenExpr
  | WithSnapRadiusExpr
  | ClosestExpr
  | FloatingExpr;

type CanvasNode = { expr: Expr; x: number; y: number };
type DotLabel = "A" | "B" | "C";
type State = {
  nodes: Record<string, CanvasNode>;
  activeSpecId: string | null;
  previewDot: DotLabel;
};

// ─── Constants ───

const DIAMOND_R = 14;
const BLK_PAD = 14;
const BLK_HDR = 26;
const BLK_RX = 8;
const SLOT_W = 38;
const BETWEEN_BODY_PAD = 18;
const BTW_NOTCH_HW = DIAMOND_R;
const BTW_NOTCH_D = DIAMOND_R;

const WSR_PAD = 12;
const WSR_SLIDER_H = 40;
const WSR_MIN_W = 160;
const WSR_DEFAULT_NOTCH_HW = 24;
const WSR_NOTCH_PAD = 0;
const WSR_NOTCH_D = 10;

const CLS_PAD = 14;
const CLS_GAP = 8;
const CLS_DEFAULT_NHW = 30;

const FLT_W = 100;
const AS_MIN_W = 120;

const TOOLBAR_H = 52;
const CANVAS_W = 600;
const CANVAS_H = 400;

const PV_W = 160;
const PV_H = 140;
const PV_X = CANVAS_W - PV_W - 10;
const PV_Y = CANVAS_H - PV_H - 10;
const PV_DOT_R = 12;
const PV_DOTS: Record<DotLabel, { x: number; y: number }> = {
  A: { x: PV_W / 2, y: 35 },
  B: { x: 35, y: PV_H - 30 },
  C: { x: PV_W - 35, y: PV_H - 30 },
};

const STATE_FILL: Record<string, string> = {
  A: "#f97316",
  B: "#3b82f6",
  C: "#22c55e",
};

type BlockStyle = { bg: string; stroke: string; text: string; fs: number };
const S: Record<string, BlockStyle> = {
  between: { bg: "#ede9fe", stroke: "#c4b5fd", text: "#7c3aed", fs: 11 },
  floating: { bg: "#ccfbf1", stroke: "#5eead4", text: "#0f766e", fs: 11 },
  closest: { bg: "#fef3c7", stroke: "#fcd34d", text: "#b45309", fs: 11 },
  wsr: { bg: "#e0f2fe", stroke: "#93c5fd", text: "#2563eb", fs: 10 },
  activeSpec: { bg: "#f1f5f9", stroke: "#94a3b8", text: "#475569", fs: 10 },
};

// ─── Geometry ───

// -- Between --

function btwSlots(e: BetweenExpr) {
  return e.childIds.length + 1;
}
function btwW(e: BetweenExpr) {
  return BLK_PAD * 2 + btwSlots(e) * SLOT_W;
}
function btwH() {
  return BLK_HDR + BETWEEN_BODY_PAD;
}
function btwInlet(_e: BetweenExpr, i: number) {
  return {
    x: BLK_PAD + i * SLOT_W + SLOT_W / 2,
    y: btwH() - BTW_NOTCH_D + DIAMOND_R,
  };
}

// -- Floating --

function fltInlet() {
  return {
    x: FLT_W / 2,
    y: btwH() - BTW_NOTCH_D + DIAMOND_R,
  };
}

// -- WSR --

function wsrH() {
  return BLK_HDR + WSR_SLIDER_H;
}

// -- Shared --

function childBlockW(expr: Expr, nodes: Record<string, CanvasNode>): number {
  switch (expr.type) {
    case "between":
      return btwW(expr);
    case "closest":
      return clsW(expr, nodes);
    case "withSnapRadius":
      return wsrW(expr, nodes);
    case "floating":
      return FLT_W;
    default:
      return DIAMOND_R * 2;
  }
}

// -- WSR (continued) --

function wsrNotchHW(
  expr: WithSnapRadiusExpr,
  nodes: Record<string, CanvasNode>,
): number {
  if (!expr.childId || !nodes[expr.childId]) return WSR_DEFAULT_NOTCH_HW;
  return childBlockW(nodes[expr.childId].expr, nodes) / 2 + WSR_NOTCH_PAD;
}

function wsrW(
  expr: WithSnapRadiusExpr,
  nodes: Record<string, CanvasNode>,
): number {
  const nhw = wsrNotchHW(expr, nodes);
  return Math.max(WSR_MIN_W, nhw * 2 + WSR_PAD * 2);
}

function wsrChildOff(
  wsrExpr: WithSnapRadiusExpr,
  childExpr: Expr,
  nodes: Record<string, CanvasNode>,
) {
  const w = wsrW(wsrExpr, nodes);
  const childW = childBlockW(childExpr, nodes);
  return { x: w / 2 - childW / 2, y: wsrH() - WSR_NOTCH_D };
}

// -- Closest --

function clsSlots(e: ClosestExpr) {
  return e.childIds.length + 1;
}

function clsNHW(
  expr: ClosestExpr,
  i: number,
  nodes: Record<string, CanvasNode>,
): number {
  if (i < expr.childIds.length && nodes[expr.childIds[i]]) {
    return childBlockW(nodes[expr.childIds[i]].expr, nodes) / 2;
  }
  return CLS_DEFAULT_NHW;
}

function clsW(expr: ClosestExpr, nodes: Record<string, CanvasNode>): number {
  const slots = clsSlots(expr);
  let w = CLS_PAD * 2 + CLS_GAP * Math.max(0, slots - 1);
  for (let i = 0; i < slots; i++) w += 2 * clsNHW(expr, i, nodes);
  return w;
}

function clsSlotCenterX(
  expr: ClosestExpr,
  i: number,
  nodes: Record<string, CanvasNode>,
): number {
  let x = CLS_PAD;
  for (let j = 0; j < i; j++) {
    x += 2 * clsNHW(expr, j, nodes) + CLS_GAP;
  }
  return x + clsNHW(expr, i, nodes);
}

function clsChildOff(
  expr: ClosestExpr,
  i: number,
  childExpr: Expr,
  nodes: Record<string, CanvasNode>,
) {
  const cx = clsSlotCenterX(expr, i, nodes);
  const childW = childBlockW(childExpr, nodes);
  return { x: cx - childW / 2, y: btwH() - WSR_NOTCH_D };
}

// -- Active Spec --

function asNotchHW(state: State): number {
  if (!state.activeSpecId || !state.nodes[state.activeSpecId])
    return WSR_DEFAULT_NOTCH_HW;
  return childBlockW(state.nodes[state.activeSpecId].expr, state.nodes) / 2;
}

function asW(state: State): number {
  const nhw = asNotchHW(state);
  return Math.max(AS_MIN_W, nhw * 2 + WSR_PAD * 2);
}

function asChildOff(state: State): { x: number; y: number } {
  const w = asW(state);
  const childW =
    state.activeSpecId && state.nodes[state.activeSpecId]
      ? childBlockW(state.nodes[state.activeSpecId].expr, state.nodes)
      : 0;
  return { x: w / 2 - childW / 2, y: btwH() - WSR_NOTCH_D };
}

// ─── Path Builders ───

const MAX_BTW_SLOTS = 6;

function betweenPathD(expr: BetweenExpr): string {
  const w = btwW(expr);
  const h = btwH();
  const r = BLK_RX;
  const slots = btwSlots(expr);
  const nhw = BTW_NOTCH_HW;
  const nd = BTW_NOTCH_D;

  let p = `M ${r},0`;
  p += ` H ${w - r}`;
  p += ` A ${r},${r} 0 0 1 ${w},${r}`;
  p += ` V ${h - r}`;
  p += ` A ${r},${r} 0 0 1 ${w - r},${h}`;

  // Bottom edge with V-notch concavities (right to left)
  for (let i = MAX_BTW_SLOTS - 1; i >= 0; i--) {
    if (i < slots) {
      const cx = BLK_PAD + i * SLOT_W + SLOT_W / 2;
      p += ` H ${cx + nhw}`;
      p += ` L ${cx},${h - nd}`;
      p += ` L ${cx - nhw},${h}`;
    } else {
      p += ` H ${w - r}`;
      p += ` L ${w - r},${h}`;
      p += ` L ${w - r},${h}`;
    }
  }

  p += ` H ${r}`;
  p += ` A ${r},${r} 0 0 1 0,${h - r}`;
  p += ` V ${r}`;
  p += ` A ${r},${r} 0 0 1 ${r},0`;
  p += " Z";

  return p;
}

function floatingPathD(): string {
  const w = FLT_W;
  const h = btwH();
  const r = BLK_RX;
  const nhw = BTW_NOTCH_HW;
  const nd = BTW_NOTCH_D;
  const cx = w / 2;

  let p = `M ${r},0`;
  p += ` H ${w - r}`;
  p += ` A ${r},${r} 0 0 1 ${w},${r}`;
  p += ` V ${h - r}`;
  p += ` A ${r},${r} 0 0 1 ${w - r},${h}`;

  // Single V-notch
  p += ` H ${cx + nhw}`;
  p += ` L ${cx},${h - nd}`;
  p += ` L ${cx - nhw},${h}`;

  p += ` H ${r}`;
  p += ` A ${r},${r} 0 0 1 0,${h - r}`;
  p += ` V ${r}`;
  p += ` A ${r},${r} 0 0 1 ${r},0`;
  p += " Z";

  return p;
}

function wsrPathD(w: number, nhw: number): string {
  const h = wsrH();
  const r = BLK_RX;
  const nd = WSR_NOTCH_D;
  const cx = w / 2;

  let p = `M ${r},0`;
  p += ` H ${w - r}`;
  p += ` A ${r},${r} 0 0 1 ${w},${r}`;
  p += ` V ${h - r}`;
  p += ` A ${r},${r} 0 0 1 ${w - r},${h}`;

  // Bottom edge with rounded-rect concavity (right to left)
  p += ` H ${cx + nhw}`;
  p += ` V ${h - nd + r}`;
  p += ` A ${r},${r} 0 0 0 ${cx + nhw - r},${h - nd}`;
  p += ` H ${cx - nhw + r}`;
  p += ` A ${r},${r} 0 0 0 ${cx - nhw},${h - nd + r}`;
  p += ` V ${h}`;

  p += ` H ${r}`;
  p += ` A ${r},${r} 0 0 1 0,${h - r}`;
  p += ` V ${r}`;
  p += ` A ${r},${r} 0 0 1 ${r},0`;
  p += " Z";

  return p;
}

const MAX_CLS_SLOTS = 6;

function closestPathD(
  expr: ClosestExpr,
  nodes: Record<string, CanvasNode>,
): string {
  const w = clsW(expr, nodes);
  const h = btwH();
  const r = BLK_RX;
  const nd = WSR_NOTCH_D;
  const slots = clsSlots(expr);

  let p = `M ${r},0`;
  p += ` H ${w - r}`;
  p += ` A ${r},${r} 0 0 1 ${w},${r}`;
  p += ` V ${h - r}`;
  p += ` A ${r},${r} 0 0 1 ${w - r},${h}`;

  // Bottom edge with rounded-rect notches (right to left)
  for (let i = MAX_CLS_SLOTS - 1; i >= 0; i--) {
    if (i < slots) {
      const cx = clsSlotCenterX(expr, i, nodes);
      const nhw = clsNHW(expr, i, nodes);
      p += ` H ${cx + nhw}`;
      p += ` V ${h - nd + r}`;
      p += ` A ${r},${r} 0 0 0 ${cx + nhw - r},${h - nd}`;
      p += ` H ${cx - nhw + r}`;
      p += ` A ${r},${r} 0 0 0 ${cx - nhw},${h - nd + r}`;
      p += ` V ${h}`;
    } else {
      // Collapsed notch — same 6 commands at right edge
      p += ` H ${w - r}`;
      p += ` V ${h}`;
      p += ` A 0.01,0.01 0 0 0 ${w - r},${h}`;
      p += ` H ${w - r}`;
      p += ` A 0.01,0.01 0 0 0 ${w - r},${h}`;
      p += ` V ${h}`;
    }
  }

  p += ` H ${r}`;
  p += ` A ${r},${r} 0 0 1 0,${h - r}`;
  p += ` V ${r}`;
  p += ` A ${r},${r} 0 0 1 ${r},0`;
  p += " Z";

  return p;
}

function activeSpecPathD(state: State): string {
  const w = asW(state);
  const h = btwH();
  const r = BLK_RX;
  const nhw = asNotchHW(state);
  const nd = WSR_NOTCH_D;
  const cx = w / 2;

  // Top corners are right angles (anchored to toolbar)
  let p = `M 0,0`;
  p += ` H ${w}`;
  p += ` V ${h - r}`;
  p += ` A ${r},${r} 0 0 1 ${w - r},${h}`;

  // Rounded-rect notch
  p += ` H ${cx + nhw}`;
  p += ` V ${h - nd + r}`;
  p += ` A ${r},${r} 0 0 0 ${cx + nhw - r},${h - nd}`;
  p += ` H ${cx - nhw + r}`;
  p += ` A ${r},${r} 0 0 0 ${cx - nhw},${h - nd + r}`;
  p += ` V ${h}`;

  p += ` H ${r}`;
  p += ` A ${r},${r} 0 0 1 0,${h - r}`;
  p += " Z";

  return p;
}

// ─── State Helpers ───

function findParent(state: State, nodeId: string) {
  for (const [pid, pnode] of Object.entries(state.nodes)) {
    const e = pnode.expr;
    if (e.type === "between") {
      const idx = e.childIds.indexOf(nodeId);
      if (idx >= 0) return { parentId: pid, idx };
    }
    if (e.type === "closest") {
      const idx = e.childIds.indexOf(nodeId);
      if (idx >= 0) return { parentId: pid, idx };
    }
    if (e.type === "withSnapRadius" && e.childId === nodeId) {
      return { parentId: pid, idx: 0 };
    }
    if (e.type === "floating" && e.childId === nodeId) {
      return { parentId: pid, idx: 0 };
    }
  }
  return null;
}

function detach(state: State, nodeId: string): State {
  // Active spec detach
  if (state.activeSpecId === nodeId) {
    const off = asChildOff(state);
    return produce(state, (draft) => {
      draft.activeSpecId = null;
      draft.nodes[nodeId].x = off.x;
      draft.nodes[nodeId].y = TOOLBAR_H + off.y;
    });
  }

  const parent = findParent(state, nodeId);
  if (!parent) return state;

  const pn = state.nodes[parent.parentId];
  let gx: number, gy: number;

  switch (pn.expr.type) {
    case "between": {
      const off = btwInlet(pn.expr, parent.idx);
      gx = pn.x + off.x;
      gy = pn.y + off.y;
      break;
    }
    case "floating": {
      const off = fltInlet();
      gx = pn.x + off.x;
      gy = pn.y + off.y;
      break;
    }
    case "withSnapRadius": {
      const off = wsrChildOff(pn.expr, state.nodes[nodeId].expr, state.nodes);
      gx = pn.x + off.x;
      gy = pn.y + off.y;
      break;
    }
    case "closest": {
      const off = clsChildOff(
        pn.expr,
        parent.idx,
        state.nodes[nodeId].expr,
        state.nodes,
      );
      gx = pn.x + off.x;
      gy = pn.y + off.y;
      break;
    }
    default:
      return state;
  }

  return produce(state, (draft) => {
    const pe = draft.nodes[parent.parentId].expr;
    if (pe.type === "between") pe.childIds.splice(parent.idx, 1);
    else if (pe.type === "closest") pe.childIds.splice(parent.idx, 1);
    else if (pe.type === "withSnapRadius") pe.childId = null;
    else if (pe.type === "floating") pe.childId = null;
    draft.nodes[nodeId].x = gx;
    draft.nodes[nodeId].y = gy;
  });
}

// ─── Drag Builder ───

function nodeDrag(
  d: DragSpecBuilder<State>,
  base: State,
  nid: string,
): DragSpec<State> {
  const node = base.nodes[nid];
  const snaps: State[] = [];

  if (node.expr.type === "state") {
    // States snap into between and floating blocks
    for (const [sid, sn] of Object.entries(base.nodes)) {
      if (sn.expr.type === "between" && sid !== nid) {
        for (let i = 0; i <= sn.expr.childIds.length; i++) {
          snaps.push(
            produce(base, (draft) => {
              (draft.nodes[sid].expr as BetweenExpr).childIds.splice(i, 0, nid);
            }),
          );
        }
      }
      if (
        sn.expr.type === "floating" &&
        sn.expr.childId === null &&
        sid !== nid
      ) {
        snaps.push(
          produce(base, (draft) => {
            (draft.nodes[sid].expr as FloatingExpr).childId = nid;
          }),
        );
      }
    }
  } else {
    // Spec blocks snap into WSR and closest blocks
    for (const [sid, sn] of Object.entries(base.nodes)) {
      if (
        sn.expr.type === "withSnapRadius" &&
        sn.expr.childId === null &&
        sid !== nid
      ) {
        snaps.push(
          produce(base, (draft) => {
            (draft.nodes[sid].expr as WithSnapRadiusExpr).childId = nid;
          }),
        );
      }
      if (sn.expr.type === "closest" && sid !== nid) {
        for (let i = 0; i <= sn.expr.childIds.length; i++) {
          snaps.push(
            produce(base, (draft) => {
              (draft.nodes[sid].expr as ClosestExpr).childIds.splice(i, 0, nid);
            }),
          );
        }
      }
    }
    // Active spec slot
    if (!base.activeSpecId) {
      snaps.push(
        produce(base, (draft) => {
          draft.activeSpecId = nid;
        }),
      );
    }
  }

  const free = d.vary(base, ["nodes", nid, "x"], ["nodes", nid, "y"]);

  if (snaps.length > 0) {
    return d.closest(d.floating(snaps)).withBackground(free, { radius: 40 });
  }
  return free;
}

// ─── Initial State ───

const initialState: State = {
  nodes: {},
  activeSpecId: null,
  previewDot: "A",
};

// ─── Rendering Helpers ───

function renderDiamond(label: string) {
  const r = DIAMOND_R;
  return (
    <g>
      <polygon
        points={`0,${-r} ${r},0 0,${r} ${-r},0`}
        fill={STATE_FILL[label]}
        strokeLinejoin="round"
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight="700"
        fill="white"
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

function blockHeader(pathD: string, w: number, label: string, s: BlockStyle) {
  return (
    <>
      <path
        d={pathD}
        fill={s.bg}
        stroke={s.stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <text
        x={w / 2}
        y={BLK_HDR / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={s.fs}
        fontWeight="600"
        fill={s.text}
        pointerEvents="none"
      >
        {label}
      </text>
    </>
  );
}

function tbPreview(label: string, s: BlockStyle, hw = 28, fs = 9) {
  return (
    <g>
      <rect
        x={-hw}
        y={-12}
        width={hw * 2}
        height={24}
        rx={6}
        fill={s.bg}
        stroke={s.stroke}
        strokeWidth={1.5}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fs}
        fill={s.text}
        fontWeight="500"
      >
        {label}
      </text>
    </g>
  );
}

// ─── Compile Expr → DragSpec ───

function compileExpr(
  d: DragSpecBuilder<State>,
  state: State,
  nodeId: string,
): DragSpec<State> | null {
  const node = state.nodes[nodeId];
  if (!node) return null;
  const expr = node.expr;

  switch (expr.type) {
    case "between": {
      const childStates = expr.childIds
        .map((cid) => state.nodes[cid])
        .filter((n) => n && n.expr.type === "state")
        .map((n) => ({ ...state, previewDot: (n.expr as StateExpr).label }));
      if (childStates.length === 0) return null;
      return d.between(childStates);
    }
    case "floating": {
      if (!expr.childId || !state.nodes[expr.childId]) return null;
      const cn = state.nodes[expr.childId];
      if (cn.expr.type !== "state") return null;
      return d.floating({ ...state, previewDot: cn.expr.label });
    }
    case "closest": {
      const childSpecs = expr.childIds
        .map((cid) => compileExpr(d, state, cid))
        .filter((s): s is DragSpec<State> => s !== null);
      if (childSpecs.length === 0) return null;
      return d.closest(childSpecs);
    }
    case "withSnapRadius": {
      if (!expr.childId) return null;
      const inner = compileExpr(d, state, expr.childId);
      if (!inner) return null;
      return inner.withSnapRadius(expr.radius);
    }
    default:
      return null;
  }
}

// ─── Draggable ───

const draggable: Draggable<State> = ({ state, d, draggedId }) => {
  // Collect snapped IDs
  const snappedIds = new Set<string>();
  for (const n of Object.values(state.nodes)) {
    if (n.expr.type === "between")
      for (const cid of n.expr.childIds) snappedIds.add(cid);
    if (n.expr.type === "closest")
      for (const cid of n.expr.childIds) snappedIds.add(cid);
    if (n.expr.type === "withSnapRadius" && n.expr.childId)
      snappedIds.add(n.expr.childId);
    if (n.expr.type === "floating" && n.expr.childId)
      snappedIds.add(n.expr.childId);
  }
  if (state.activeSpecId) snappedIds.add(state.activeSpecId);

  // ── Toolbar defs ──

  const toolbarDefs: {
    label: string;
    makeExpr: () => Expr;
    preview: React.ReactElement;
    x: number;
  }[] = [
    ...(["A", "B", "C"] as const).map((l, i) => ({
      label: l,
      makeExpr: (): Expr => ({ type: "state" as const, label: l }),
      preview: (
        <g>
          <polygon
            points={`0,-10 10,0 0,10 -10,0`}
            fill={STATE_FILL[l]}
            strokeLinejoin="round"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fontWeight="700"
            fill="white"
            pointerEvents="none"
          >
            {l}
          </text>
        </g>
      ),
      x: 30 + i * 40,
    })),
    {
      label: "between",
      makeExpr: (): Expr => ({ type: "between", childIds: [] }),
      preview: tbPreview("between", S.between),
      x: 195,
    },
    {
      label: "floating",
      makeExpr: (): Expr => ({ type: "floating", childId: null }),
      preview: tbPreview("floating", S.floating),
      x: 290,
    },
    {
      label: "closest",
      makeExpr: (): Expr => ({ type: "closest", childIds: [] }),
      preview: tbPreview("closest", S.closest),
      x: 385,
    },
    {
      label: "wsr",
      makeExpr: (): Expr => ({
        type: "withSnapRadius",
        childId: null,
        radius: 15,
      }),
      preview: tbPreview("withSnapRadius", S.wsr, 42, 8),
      x: 510,
    },
  ];

  // ── Render helpers (using closure over state, d, draggedId) ──

  function renderSnappedChild(
    childId: string,
    pos: { x: number; y: number },
    content: React.ReactElement | null,
  ) {
    if (!content) return null;
    return (
      <g
        id={`n-${childId}`}
        key={childId}
        transform={translate(pos.x, pos.y)}
        data-z-index={draggedId === `n-${childId}` ? 10 : 1}
        data-on-drag={() => {
          const base = detach(state, childId);
          return nodeDrag(d, base, childId);
        }}
      >
        {content}
      </g>
    );
  }

  function renderSpecBlock(
    nodeId: string,
    node: CanvasNode,
  ): React.ReactElement | null {
    switch (node.expr.type) {
      case "between":
        return renderBetweenBlock(nodeId, node.expr);
      case "withSnapRadius":
        return renderWSRBlock(nodeId, node.expr);
      case "closest":
        return renderClosestBlock(nodeId, node.expr);
      case "floating":
        return renderFloatingBlock(nodeId, node.expr);
      default:
        return null;
    }
  }

  function renderBetweenBlock(_parentId: string, expr: BetweenExpr) {
    return (
      <g>
        {blockHeader(betweenPathD(expr), btwW(expr), "between", S.between)}
        {expr.childIds.map((childId, i) => {
          const cn = state.nodes[childId];
          if (!cn || cn.expr.type !== "state") return null;
          return renderSnappedChild(
            childId,
            btwInlet(expr, i),
            renderDiamond(cn.expr.label),
          );
        })}
      </g>
    );
  }

  function renderFloatingBlock(_parentId: string, expr: FloatingExpr) {
    return (
      <g>
        {blockHeader(floatingPathD(), FLT_W, "floating", S.floating)}
        {expr.childId &&
          state.nodes[expr.childId] &&
          (() => {
            const cn = state.nodes[expr.childId!];
            if (cn.expr.type !== "state") return null;
            return renderSnappedChild(
              expr.childId!,
              fltInlet(),
              renderDiamond(cn.expr.label),
            );
          })()}
      </g>
    );
  }

  function renderWSRBlock(parentId: string, expr: WithSnapRadiusExpr) {
    const nhw = wsrNotchHW(expr, state.nodes);
    const w = wsrW(expr, state.nodes);
    const trackX = WSR_PAD;
    const trackW = w - WSR_PAD * 2;
    const sliderY = BLK_HDR + WSR_SLIDER_H / 2;
    const knobX = trackX + (expr.radius / 30) * trackW;
    const parentDragged = draggedId === `n-${parentId}`;

    return (
      <g>
        {blockHeader(wsrPathD(w, nhw), w, "withSnapRadius", S.wsr)}
        <line
          x1={trackX}
          y1={sliderY}
          x2={trackX + trackW}
          y2={sliderY}
          stroke="#ddd"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle
          id={`slider-${parentId}`}
          transform={translate(knobX, sliderY)}
          r={7}
          fill="#2563eb"
          stroke="white"
          strokeWidth={2}
          style={{ cursor: "ew-resize" }}
          data-z-index={parentDragged ? 11 : 2}
          data-on-drag={() =>
            d.vary(state, ["nodes", parentId, "expr", "radius"] as never, {
              constraint: (s: State) => [
                lessThan(
                  0,
                  (s.nodes[parentId].expr as WithSnapRadiusExpr).radius,
                ),
                lessThan(
                  (s.nodes[parentId].expr as WithSnapRadiusExpr).radius,
                  30,
                ),
              ],
            })
          }
        />
        <text
          x={knobX}
          y={sliderY - 12}
          textAnchor="middle"
          fontSize={9}
          fill="#2563eb"
          fontWeight="500"
          pointerEvents="none"
        >
          {Math.round(expr.radius)}
        </text>
        {expr.childId &&
          state.nodes[expr.childId] &&
          (() => {
            const childId = expr.childId!;
            const cn = state.nodes[childId];
            return renderSnappedChild(
              childId,
              wsrChildOff(expr, cn.expr, state.nodes),
              renderSpecBlock(childId, cn),
            );
          })()}
      </g>
    );
  }

  function renderClosestBlock(_parentId: string, expr: ClosestExpr) {
    return (
      <g>
        {blockHeader(
          closestPathD(expr, state.nodes),
          clsW(expr, state.nodes),
          "closest",
          S.closest,
        )}
        {expr.childIds.map((childId, i) => {
          const cn = state.nodes[childId];
          if (!cn) return null;
          return renderSnappedChild(
            childId,
            clsChildOff(expr, i, cn.expr, state.nodes),
            renderSpecBlock(childId, cn),
          );
        })}
      </g>
    );
  }

  function renderNode(nodeId: string, node: CanvasNode) {
    const isDragged = draggedId === `n-${nodeId}`;
    const inner =
      node.expr.type === "state"
        ? renderDiamond(node.expr.label)
        : renderSpecBlock(nodeId, node);

    return (
      <g
        id={`n-${nodeId}`}
        key={nodeId}
        transform={translate(node.x, node.y)}
        data-z-index={isDragged ? 10 : 0}
        data-on-drag={() => {
          const base = detach(state, nodeId);
          return nodeDrag(d, base, nodeId);
        }}
      >
        {inner}
      </g>
    );
  }

  const previewDragSpec =
    state.activeSpecId !== null && compileExpr(d, state, state.activeSpecId);

  // ── Main render ──

  return (
    <g>
      {/* toolbar background */}
      <rect
        id="toolbar-bg"
        x={0}
        y={0}
        width={CANVAS_W}
        height={TOOLBAR_H}
        fill="#f9fafb"
        stroke="#e5e7eb"
        rx={0}
        data-z-index={-10}
      />
      <line
        x1={0}
        y1={TOOLBAR_H}
        x2={CANVAS_W}
        y2={TOOLBAR_H}
        stroke="#e5e7eb"
      />

      {/* toolbar label */}
      <text x={10} y={14} fontSize={9} fill="#aaa" fontWeight="500">
        DRAG TO ADD
      </text>

      {/* toolbar items */}
      {toolbarDefs.map((t) => (
        <g
          id={`tb-${t.label}`}
          key={t.label}
          transform={translate(t.x, TOOLBAR_H / 2 + 4)}
          style={{ cursor: "grab" }}
          data-on-drag={() => {
            const nid = makeId();
            const ns = produce(state, (draft) => {
              draft.nodes[nid] = {
                expr: t.makeExpr(),
                x: t.x,
                y: TOOLBAR_H / 2 + 4,
              };
            });
            return d.switchToStateAndFollow(
              ns,
              `n-${nid}`,
              nodeDrag(d, ns, nid),
            );
          }}
        >
          {t.preview}
        </g>
      ))}

      {/* active spec slot (fixed, anchored to toolbar) */}
      <g transform={translate(0, TOOLBAR_H)}>
        {blockHeader(
          activeSpecPathD(state),
          asW(state),
          "active spec",
          S.activeSpec,
        )}

        {state.activeSpecId &&
          state.nodes[state.activeSpecId] &&
          renderSnappedChild(
            state.activeSpecId,
            asChildOff(state),
            renderSpecBlock(
              state.activeSpecId,
              state.nodes[state.activeSpecId],
            ),
          )}
      </g>

      {/* preview box */}
      <g transform={translate(PV_X, PV_Y)}>
        <rect
          width={PV_W}
          height={PV_H}
          rx={8}
          fill="white"
          stroke="#e5e7eb"
          strokeWidth={1.5}
        />
        <text
          x={PV_W / 2}
          y={14}
          textAnchor="middle"
          fontSize={9}
          fill="#aaa"
          fontWeight="500"
        >
          PREVIEW
        </text>
        {(["A", "B", "C"] as const).map((l) => (
          <g key={l} transform={translate(PV_DOTS[l].x, PV_DOTS[l].y)}>
            <circle r={PV_DOT_R} fill={STATE_FILL[l]} opacity={0.25} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fontWeight="700"
              fill={STATE_FILL[l]}
              pointerEvents="none"
            >
              {l}
            </text>
          </g>
        ))}
        <circle
          id="preview-dot"
          transform={translate(
            PV_DOTS[state.previewDot].x,
            PV_DOTS[state.previewDot].y,
          )}
          r={PV_DOT_R}
          fill={STATE_FILL[state.previewDot]}
          stroke="white"
          strokeWidth={2}
          data-on-drag={previewDragSpec && (() => previewDragSpec)}
        />
      </g>

      {/* canvas nodes (only free / non-snapped ones) */}
      {Object.entries(state.nodes)
        .filter(([id]) => !snappedIds.has(id))
        .map(([id, node]) => renderNode(id, node))}
    </g>
  );
};

// ─── Export ───

export default demo(() => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={CANVAS_W}
    height={CANVAS_H}
  />
));
