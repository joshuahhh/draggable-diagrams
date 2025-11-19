import _ from "lodash";
import { Manipulable } from "./manipulable";
import { group, keyed, translate } from "./shape";
import { Vec2 } from "./vec2";

type GraphState = {
  nodes: { [key: string]: { x: number; y: number } };
  edges: { [key: string]: { from: string; to: string } };
};

export const manipulableGraph: Manipulable<GraphState> = {
  sourceFile: "manipulable-tiles.ts",

  render(state) {
    const NODE_R = 20;
    return group(`nodes-and-edges`, [
      ...Object.entries(state.nodes).map(([key, node]) =>
        translate(
          Vec2(node.x, node.y),
          keyed(`node-${key}`, true, {
            type: "circle" as const,
            center: Vec2(0),
            radius: NODE_R,
            fillStyle: "black",
          }),
        ),
      ),
      ...Object.entries(state.edges).flatMap(([key, edge]) => {
        const fromCenter = Vec2(state.nodes[edge.from]);
        const toCenter = Vec2(state.nodes[edge.to]);
        const fromArrow = fromCenter.towards(toCenter, NODE_R + 5);
        const toArrow = toCenter.towards(fromCenter, NODE_R + 5);
        // draw a triangular arrowhead
        const arrowHeadAngle = Math.PI / 8;
        const arrowHeadLength = 20;
        const backFromTip = toArrow.sub(fromArrow).norm().mul(-arrowHeadLength);

        // is the opposite edge present?
        const oppositeEdgeKey = _.findKey(
          state.edges,
          (e) => e.from === edge.to && e.to === edge.from,
        );
        let offset = Vec2(0);
        if (oppositeEdgeKey) {
          // offset arrow perpendicular to its direction
          const dir = toArrow.sub(fromArrow).norm();
          offset = dir.rotate(Math.PI / 2).mul(8);
        }

        // just draw the edge as an arrow, nothing draggable
        return translate(
          offset,
          group([
            {
              type: "line" as const,
              from: fromArrow,
              to: toArrow.towards(fromArrow, arrowHeadLength / 2),
              strokeStyle: "black",
              lineWidth: 2,
            },
            translate(
              toArrow,
              keyed(`head-${key}`, true, {
                type: "polygon" as const,
                points: [
                  Vec2(0),
                  backFromTip.rotate(arrowHeadAngle),
                  backFromTip.rotate(-arrowHeadAngle),
                ],
                fillStyle: "black",
              }),
            ),
            // TODO: hover effect
            translate(
              fromArrow.towards(toArrow, 5),
              keyed(`tail-${key}`, true, {
                type: "circle" as const,
                center: Vec2(0),
                radius: 5,
                fillStyle: "black",
              }),
            ),
          ]),
        );
      }),
    ]);
  },

  accessibleFrom(state, draggableKey) {
    const newStates = [];
    if (draggableKey.startsWith("head-")) {
      const edgeKey = draggableKey.slice("head-".length);
      const edge = state.edges[edgeKey];
      // construct all new graphs where the "edgeKey" edge has a different node as "to" (but not the "from" node)
      for (const newToNodeKey of Object.keys(state.nodes)) {
        if (newToNodeKey === edge.from || newToNodeKey === edge.to) continue;
        if (
          _.findKey(
            state.edges,
            (e) => e.from === edge.from && e.to === newToNodeKey,
          )
        )
          continue;
        newStates.push({
          ...state,
          edges: {
            ...state.edges,
            [edgeKey]: { from: edge.from, to: newToNodeKey },
          },
        });
      }
    } else if (draggableKey.startsWith("tail-")) {
      const edgeKey = draggableKey.slice("tail-".length);
      const edge = state.edges[edgeKey];
      // construct all new graphs where the "edgeKey" edge has a different node as "from" (but not the "to" node)
      for (const newFromNodeKey of Object.keys(state.nodes)) {
        if (newFromNodeKey === edge.to || newFromNodeKey === edge.from)
          continue;
        if (
          _.findKey(
            state.edges,
            (e) => e.from === newFromNodeKey && e.to === edge.to,
          )
        )
          continue;
        newStates.push({
          ...state,
          edges: {
            ...state.edges,
            [edgeKey]: { from: newFromNodeKey, to: edge.to },
          },
        });
      }
    } else if (draggableKey.startsWith("node-")) {
      const nodeKey = draggableKey.slice("node-".length);
      const node = state.nodes[nodeKey];
      return {
        initParams: [node.x, node.y],
        stateFromParams: (x: number, y: number) => ({
          ...state,
          nodes: {
            ...state.nodes,
            [nodeKey]: { x, y },
          },
        }),
      };
    }
    return newStates;
  },
};

export const stateGraph: GraphState = {
  nodes: {
    "1": { x: 0, y: 0 },
    "2": { x: 100, y: 0 },
    "3": { x: 100, y: 100 },
    "4": { x: 0, y: 100 },
  },
  edges: {
    "1": { from: "1", to: "2" },
    "2": { from: "2", to: "3" },
    "3": { from: "3", to: "4" },
    "4": { from: "4", to: "1" },
  },
};
