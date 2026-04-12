import { amb, produceAmb } from "../amb";
import { arrowhead } from "../arrows";
import { DemoDraggable } from "../demo/ui";
import { Draggable } from "../draggable";
import { param } from "../DragSpec";

import { demo } from "../demo";
import { Vec2 } from "../math/vec2";
import { path, translate } from "../svgx/helpers";
type State = {
  nodes: { [key: string]: { x: number; y: number } };
  edges: { [key: string]: { from: string; to: string } };
};

const initialState: State = {
  nodes: {
    "1": { x: 50, y: 100 },
    "2": { x: 257, y: 73 },
    "3": { x: 244, y: 200 },
    "4": { x: 96, y: 240 },
  },
  edges: {
    "1": { from: "1", to: "2" },
    "2": { from: "2", to: "3" },
    "3": { from: "3", to: "4" },
    "4": { from: "4", to: "1" },
    "5": { from: "1", to: "1" },
    "6": { from: "1", to: "2" },
    "7": { from: "2", to: "1" },
    "8": { from: "1", to: "3" },
    "9": { from: "3", to: "4" },
    "10": { from: "4", to: "3" },
  },
};

function getOrCreate<K, V>(map: Map<K, V>, key: K, init: () => V): V {
  if (!map.has(key)) map.set(key, init());
  return map.get(key)!;
}

const draggable: Draggable<State> = ({ state, d }) => {
  const NODE_R = 20;
  const arrowHeadLength = 20;

  // For each edge, find its index among all edges connecting the same
  // unordered node pair (so A→B and B→A share a group).
  const pairGroups = new Map<string, string[]>();
  for (const [edgeKey, edge] of Object.entries(state.edges)) {
    const pairKey =
      edge.from === edge.to
        ? `${edge.from}=>${edge.to}`
        : [edge.from, edge.to].sort().join("<>");
    getOrCreate(pairGroups, pairKey, () => []).push(edgeKey);
  }

  // Assign each edge's ports (tail + head) an ideal angle around each node.
  // Sibling edges get small tiebreakers with opposite signs at source vs dest
  // to keep them on the same spatial side and avoid crossings.
  type Port = { edgeKey: string; end: "tail" | "head"; idealAngle: number };
  const nodePorts = new Map<string, Port[]>();
  for (const [edgeKey, edge] of Object.entries(state.edges)) {
    const group = pairGroups.get(
      edge.from === edge.to
        ? `${edge.from}=>${edge.to}`
        : [edge.from, edge.to].sort().join("<>"),
    )!;
    const tiebreak = group.length > 1 ? group.indexOf(edgeKey) * 0.01 : 0;

    const fromPorts = getOrCreate(nodePorts, edge.from, () => []);
    const toPorts = getOrCreate(nodePorts, edge.to, () => []);

    if (edge.from === edge.to) {
      fromPorts.push(
        { edgeKey, end: "tail", idealAngle: -90 - 17 + tiebreak },
        { edgeKey, end: "head", idealAngle: -90 + 17 + tiebreak },
      );
    } else {
      const fromCenter = Vec2(state.nodes[edge.from]);
      const toCenter = Vec2(state.nodes[edge.to]);
      fromPorts.push({
        edgeKey,
        end: "tail",
        idealAngle: fromCenter.angleToDeg(toCenter) - tiebreak,
      });
      toPorts.push({
        edgeKey,
        end: "head",
        idealAngle: toCenter.angleToDeg(fromCenter) + tiebreak,
      });
    }
  }

  // Sort ports by ideal angle, then spread them with a minimum angular gap
  const minGap = 30; // degrees
  const assignedAngles = new Map<string, number>();
  for (const [, ports] of nodePorts) {
    ports.sort((a, b) => a.idealAngle - b.idealAngle);
    const angles = ports.map((p) => p.idealAngle);
    for (let iter = 0; iter < 10; iter++) {
      for (let i = 0; i < angles.length; i++) {
        const next = (i + 1) % angles.length;
        let gap = angles[next] - angles[i];
        if (next === 0) gap += 360;
        if (gap < minGap) {
          const push = (minGap - gap) / 2;
          angles[i] -= push;
          angles[next] += push;
        }
      }
    }
    for (let i = 0; i < ports.length; i++) {
      assignedAngles.set(`${ports[i].edgeKey}-${ports[i].end}`, angles[i]);
    }
  }

  return (
    <g>
      {Object.entries(state.edges).map(([key, edge]) => {
        const fromCenter = Vec2(state.nodes[edge.from]);
        const toCenter = Vec2(state.nodes[edge.to]);

        const fromDir = Vec2.polarDeg(1, assignedAngles.get(`${key}-tail`)!);
        const toDir = Vec2.polarDeg(1, assignedAngles.get(`${key}-head`)!);
        const fromArrow = fromCenter.add(fromDir.withLen(NODE_R + 5));
        const toArrow = toCenter.add(toDir.withLen(NODE_R + 5));

        const edgeDist = fromArrow.dist(toArrow);
        const handleLen = edge.from === edge.to ? 40 : edgeDist * 0.4;
        const cp1 = fromArrow.add(fromDir.withLen(handleLen));
        const cp2 = toArrow.add(toDir.withLen(handleLen));

        const tailPos = fromArrow.towards(cp1, 5);
        // Scale arrowhead down when nodes are close (but not for self-loops)
        const edgeLen = fromArrow.dist(toArrow);
        const headLen =
          edge.from === edge.to
            ? arrowHeadLength
            : Math.max(8, Math.min(arrowHeadLength, edgeLen * 0.4));
        // End path at the arrowhead's butt so the stroke exits the base cleanly
        const arrowDir = toArrow.sub(cp2).norm();
        const arrowButt = toArrow.sub(arrowDir.mul(headLen));
        // Shift cp2 back by the same amount so the curve shape is preserved
        const cp2Adj = cp2.sub(arrowDir.mul(headLen));

        return (
          <g id={`edge-${key}`}>
            <path
              d={path("M", tailPos, "C", cp1, cp2Adj, arrowButt)}
              fill="none"
              stroke="black"
              strokeWidth={2}
            />
            {arrowhead({
              tip: toArrow,
              direction: arrowDir,
              headLength: headLen,
              id: `head-${key}`,
              fill: "black",
              dragologyOnDrag: () =>
                d.between(
                  produceAmb(state, (draft) => {
                    draft.edges[key].to = amb(Object.keys(state.nodes));
                  }),
                ),
              dragologyZIndex: 1,
            })}
            <circle
              id={`tail-${key}`}
              transform={translate(tailPos)}
              r={5}
              fill="black"
              dragologyOnDrag={() =>
                d.between(
                  produceAmb(state, (draft) => {
                    draft.edges[key].from = amb(Object.keys(state.nodes));
                  }),
                )
              }
              dragologyZIndex={1}
            />
          </g>
        );
      })}

      {Object.entries(state.nodes).map(([key, node]) => (
        <circle
          id={`node-${key}`}
          transform={translate(node.x, node.y)}
          r={NODE_R}
          fill="black"
          dragologyOnDrag={() =>
            d.vary(state, [param("nodes", key, "x"), param("nodes", key, "y")])
          }
        />
      ))}
    </g>
  );
};

export default demo(
  () => (
    <DemoDraggable
      draggable={draggable}
      initialState={initialState}
      width={350}
      height={350}
    />
  ),
  { tags: ["d.between", "d.vary"] },
);
