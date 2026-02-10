import { produce } from "immer";
import { DemoDraggable } from "../demo-ui";
import { Draggable } from "../draggable";
import { transitionToAndThen } from "../DragSpec";
import { translate } from "../svgx/helpers";

const NODE_W = 90;
const NODE_HEADER = 20;
const PORT_SPACING = 22;
const PORT_R = 5;

const NODE_DEFS: Record<
  string,
  { label: string; inputs: string[]; outputs: string[] }
> = {
  A: { label: "Mix", inputs: ["a", "b"], outputs: ["out"] },
  B: { label: "Filter", inputs: ["in"], outputs: ["out"] },
  C: { label: "Output", inputs: ["in"], outputs: [] },
};

function nodeHeight(nodeId: string) {
  const def = NODE_DEFS[nodeId];
  const maxPorts = Math.max(def.inputs.length, def.outputs.length, 1);
  return NODE_HEADER + maxPorts * PORT_SPACING + 6;
}

function portY(count: number, idx: number, h: number) {
  const startY =
    NODE_HEADER +
    (h - NODE_HEADER - count * PORT_SPACING) / 2 +
    PORT_SPACING / 2;
  return startY + idx * PORT_SPACING;
}

function portPos(
  nodes: State["nodes"],
  nodeId: string,
  port: string,
): [number, number] {
  const n = nodes[nodeId];
  const def = NODE_DEFS[nodeId];
  const h = nodeHeight(nodeId);
  const outIdx = def.outputs.indexOf(port);
  if (outIdx >= 0) {
    return [n.x + NODE_W, n.y + portY(def.outputs.length, outIdx, h)];
  }
  const inIdx = def.inputs.indexOf(port);
  return [n.x, n.y + portY(def.inputs.length, inIdx, h)];
}

type WireEnd =
  | { type: "on-port"; nodeId: string; port: string }
  | { type: "free"; x: number; y: number };

type State = {
  nodes: Record<string, { x: number; y: number }>;
  wires: Record<string, { from: WireEnd; to: WireEnd }>;
};

function endPos(nodes: State["nodes"], end: WireEnd): [number, number] {
  if (end.type === "on-port") {
    return portPos(nodes, end.nodeId, end.port);
  }
  return [end.x, end.y];
}

function nextWireId(state: State): string {
  let i = 0;
  while (`w${i}` in state.wires) i++;
  return `w${i}`;
}

function allPorts(side: "in" | "out") {
  const result: { nodeId: string; port: string }[] = [];
  for (const [nodeId, def] of Object.entries(NODE_DEFS)) {
    for (const p of side === "in" ? def.inputs : def.outputs) {
      result.push({ nodeId, port: p });
    }
  }
  return result;
}

const initialState: State = {
  nodes: {
    A: { x: 20, y: 30 },
    B: { x: 200, y: 10 },
    C: { x: 380, y: 40 },
  },
  wires: {
    w1: {
      from: { type: "on-port", nodeId: "A", port: "out" },
      to: { type: "on-port", nodeId: "B", port: "in" },
    },
    w2: {
      from: { type: "on-port", nodeId: "B", port: "out" },
      to: { type: "free", x: 340, y: 130 },
    },
  },
};

const draggable: Draggable<State> = ({ state, d, draggedId }) => {
  function endDragSpec(wireId: string, endKey: "from" | "to") {
    // ways to snap it
    const side = endKey === "to" ? "in" : "out";
    const snapSpecs = allPorts(side).map(({ nodeId, port }) =>
      d.just(
        produce(state, (draft) => {
          draft.wires[wireId][endKey] = { type: "on-port", nodeId, port };
        }),
      ),
    );

    // ways to leave it danglin'
    const [px, py] = endPos(state.nodes, state.wires[wireId][endKey]);
    const freeState = produce(state, (draft) => {
      draft.wires[wireId][endKey] = { type: "free", x: px, y: py };
    });
    let varySpec = d.vary(
      freeState,
      ["wires", wireId, endKey, "x"],
      ["wires", wireId, endKey, "y"],
    );
    if (
      freeState.wires[wireId].from.type === "free" &&
      freeState.wires[wireId].to.type === "free"
    ) {
      varySpec = varySpec.andThen(
        produce(freeState, (draft) => {
          delete draft.wires[wireId];
        }),
      );
    }

    // put 'em together
    return d.closest(snapSpecs).withBackground(varySpec, { radius: 20 });
  }

  return (
    <g>
      {/* wires */}
      {Object.entries(state.wires).map(([wid, wire]) => {
        const [fx, fy] = endPos(state.nodes, wire.from);
        const [tx, ty] = endPos(state.nodes, wire.to);
        const dx = Math.max(Math.abs(tx - fx) * 0.4, 30);

        return (
          <g id={`wire-${wid}`}>
            <path
              id={`wire-path-${wid}`}
              d={`M${fx},${fy} C${fx + dx},${fy} ${tx - dx},${ty} ${tx},${ty}`}
              fill="none"
              stroke="#aaa"
              strokeWidth={2}
            />
            <circle
              id={`wire-${wid}-from`}
              transform={translate(fx, fy)}
              r={wire.from.type === "free" ? 6 : PORT_R}
              fill={wire.from.type === "free" ? "#ccc" : "transparent"}
              stroke={wire.from.type === "free" ? "#999" : "none"}
              strokeWidth={wire.from.type === "free" ? 1 : 0}
              data-z-index={3}
              data-on-drag={() => endDragSpec(wid, "from")}
            />
            <circle
              id={`wire-${wid}-to`}
              transform={translate(tx, ty)}
              r={wire.to.type === "free" ? 6 : PORT_R}
              fill={wire.to.type === "free" ? "#ccc" : "transparent"}
              stroke={wire.to.type === "free" ? "#999" : "none"}
              strokeWidth={wire.to.type === "free" ? 1 : 0}
              data-z-index={3}
              data-on-drag={() => endDragSpec(wid, "to")}
            />
          </g>
        );
      })}

      {/* nodes */}
      {Object.entries(state.nodes).map(([nid, node]) => {
        const def = NODE_DEFS[nid];
        const h = nodeHeight(nid);

        return (
          <g
            id={`node-${nid}`}
            transform={translate(node.x, node.y)}
            data-z-index={draggedId === `node-${nid}` ? 5 : 1}
            data-on-drag={() =>
              d.vary(state, ["nodes", nid, "x"], ["nodes", nid, "y"])
            }
          >
            <rect
              width={NODE_W}
              height={h}
              rx={5}
              fill="#fdfdfd"
              stroke="#bbb"
              strokeWidth={1.2}
            />
            <line
              x1={0}
              y1={NODE_HEADER}
              x2={NODE_W}
              y2={NODE_HEADER}
              stroke="#ddd"
            />
            <text
              x={NODE_W / 2}
              y={NODE_HEADER / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fontWeight="600"
              fill="#444"
            >
              {def.label}
            </text>

            {(["in", "out"] as const).map((side) => {
              const ports = side === "in" ? def.inputs : def.outputs;
              const cx = side === "in" ? 0 : NODE_W;
              const colors =
                side === "in" ? ["#4a9eff", "#c0d8f0"] : ["#ff6b4a", "#f0c8c0"];
              const wireEnd = side === "in" ? "to" : "from";
              return ports.map((port, i) => {
                const py = portY(ports.length, i, h);
                const connected = Object.values(state.wires).some((w) => {
                  const end = w[wireEnd];
                  return (
                    end.type === "on-port" &&
                    end.nodeId === nid &&
                    end.port === port
                  );
                });
                return (
                  <g
                    id={`${side === "in" ? "port" : "oport"}-${nid}-${port}`}
                    data-on-drag={
                      !connected &&
                      (() => {
                        const [px, py] = portPos(state.nodes, nid, port);
                        const wid = nextWireId(state);
                        const endKey = side === "out" ? "to" : "from";
                        const newState = produce(state, (draft) => {
                          draft.wires[wid] =
                            side === "out"
                              ? {
                                  from: {
                                    type: "on-port",
                                    nodeId: nid,
                                    port,
                                  },
                                  to: { type: "free", x: px, y: py },
                                }
                              : {
                                  from: { type: "free", x: px, y: py },
                                  to: {
                                    type: "on-port",
                                    nodeId: nid,
                                    port,
                                  },
                                };
                        });
                        return transitionToAndThen(
                          newState,
                          `wire-${wid}-${endKey}`,
                        );
                      })
                    }
                  >
                    <circle
                      cx={cx}
                      cy={py}
                      r={PORT_R}
                      fill={connected ? colors[0] : colors[1]}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                    <text
                      x={side === "in" ? PORT_R + 4 : NODE_W - PORT_R - 4}
                      y={py}
                      dominantBaseline="middle"
                      textAnchor={side === "in" ? "start" : "end"}
                      fontSize={9}
                      fill="#999"
                    >
                      {port}
                    </text>
                  </g>
                );
              });
            })}
          </g>
        );
      })}
    </g>
  );
};

export const NodeWires = () => (
  <DemoDraggable
    draggable={draggable}
    initialState={initialState}
    width={500}
    height={200}
  />
);
