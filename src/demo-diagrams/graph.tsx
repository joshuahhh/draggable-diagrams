import _ from "lodash";
import { arrowhead } from "../arrows";
import { numsAtPaths, span } from "../DragSpec";
import { Manipulable, translate } from "../manipulable";
import { Vec2 } from "../math/vec2";

export namespace Graph {
  export type State = {
    nodes: { [key: string]: { x: number; y: number } };
    edges: { [key: string]: { from: string; to: string } };
  };

  export const state1: State = {
    nodes: {
      "1": { x: 20, y: 20 },
      "2": { x: 120, y: 20 },
      "3": { x: 120, y: 120 },
      "4": { x: 20, y: 120 },
    },
    edges: {
      "1": { from: "1", to: "2" },
      "2": { from: "2", to: "3" },
      "3": { from: "3", to: "4" },
      "4": { from: "4", to: "1" },
    },
  };

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    const NODE_R = 20;

    return (
      <g>
        {/* Render edges first so they're behind nodes */}
        {Object.entries(state.edges).map(([key, edge]) => {
          const fromCenter = Vec2(state.nodes[edge.from]);
          const toCenter = Vec2(state.nodes[edge.to]);
          const fromArrow = fromCenter.towards(toCenter, NODE_R + 5);
          const toArrow = toCenter.towards(fromCenter, NODE_R + 5);

          const arrowHeadLength = 20;

          // Is the opposite edge present?
          const oppositeEdgeKey = _.findKey(
            state.edges,
            (e) => e.from === edge.to && e.to === edge.from
          );
          let offset = Vec2(0);
          if (oppositeEdgeKey) {
            // Offset arrow perpendicular to its direction
            const dir = toArrow.sub(fromArrow).norm();
            offset = dir.rotateDeg(90).mul(8);
          }

          const tailPos = fromArrow.towards(toArrow, 5).add(offset);
          const arrowPos = toArrow.add(offset);
          const lineEnd = toArrow
            .towards(fromArrow, arrowHeadLength / 2)
            .add(offset);

          const direction = toArrow.sub(fromArrow);

          return (
            <g id={`edge-${key}`}>
              <line
                x1={fromArrow.x + offset.x}
                y1={fromArrow.y + offset.y}
                x2={lineEnd.x}
                y2={lineEnd.y}
                stroke="black"
                strokeWidth={2}
              />
              {arrowhead({
                tip: arrowPos,
                direction,
                headLength: arrowHeadLength,
                id: `head-${key}`,
                fill: "black",
                "data-on-drag": drag(() => {
                  // Construct all new graphs where the "edgeKey" edge has a different node as "to"
                  const newStates = [state];
                  for (const newToNodeKey of Object.keys(state.nodes)) {
                    if (newToNodeKey === edge.from || newToNodeKey === edge.to)
                      continue;
                    if (
                      _.findKey(
                        state.edges,
                        (e) => e.from === edge.from && e.to === newToNodeKey
                      )
                    )
                      continue;
                    newStates.push({
                      ...state,
                      edges: {
                        ...state.edges,
                        [key]: { from: edge.from, to: newToNodeKey },
                      },
                    });
                  }
                  return span(newStates);
                }),
                "data-z-index": 1,
              })}
              <circle
                id={`tail-${key}`}
                transform={translate(tailPos)}
                cx={0}
                cy={0}
                r={5}
                fill="black"
                data-on-drag={drag(() => {
                  // Construct all new graphs where the "edgeKey" edge has a different node as "from"
                  const newStates = [];
                  for (const newFromNodeKey of Object.keys(state.nodes)) {
                    if (
                      newFromNodeKey === edge.to ||
                      newFromNodeKey === edge.from
                    )
                      continue;
                    if (
                      _.findKey(
                        state.edges,
                        (e) => e.from === newFromNodeKey && e.to === edge.to
                      )
                    )
                      continue;
                    newStates.push({
                      ...state,
                      edges: {
                        ...state.edges,
                        [key]: { from: newFromNodeKey, to: edge.to },
                      },
                    });
                  }
                  return span(newStates);
                })}
                data-z-index={1}
              />
            </g>
          );
        })}

        {/* Render nodes */}
        {Object.entries(state.nodes).map(([key, node]) => (
          <circle
            id={`node-${key}`}
            transform={translate(node.x, node.y)}
            cx={0}
            cy={0}
            r={NODE_R}
            fill="black"
            data-on-drag={drag(
              numsAtPaths([
                ["nodes", key, "x"],
                ["nodes", key, "y"],
              ])
            )}
          />
        ))}
      </g>
    );
  };
}
