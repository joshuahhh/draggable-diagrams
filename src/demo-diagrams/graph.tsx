import _ from "lodash";
import { amb, produceAmb, require } from "../amb";
import { arrowhead } from "../arrows";
import { span, vary } from "../DragSpec";
import { Manipulable } from "../manipulable";
import { Vec2 } from "../math/vec2";
import { translate } from "../svgx/helpers";
import { uPairs } from "../utils";

export namespace Graph {
  export type State = {
    nodes: { [key: string]: Vec2 };
    edges: { [key: string]: { from: string; to: string } };
  };

  export const state1: State = {
    nodes: {
      "1": Vec2(20, 20),
      "2": Vec2(120, 20),
      "3": Vec2(120, 120),
      "4": Vec2(20, 120),
    },
    edges: {
      "1": { from: "1", to: "2" },
      "2": { from: "2", to: "3" },
      "3": { from: "3", to: "4" },
      "4": { from: "4", to: "1" },
    },
  };

  function stateIsValid(state: State) {
    return (
      // No self-loops
      Object.values(state.edges).every((e) => e.from !== e.to) &&
      // No duplicate edges
      uPairs(Object.values(state.edges)).every(
        ([e1, e2]) => !(e1.from === e2.from && e1.to === e2.to)
      )
    );
  }

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    const NODE_R = 20;

    return (
      <g>
        {/* Render edges first so they're behind nodes */}
        {Object.entries(state.edges).map(([key, edge]) => {
          const fromCenter = state.nodes[edge.from];
          const toCenter = state.nodes[edge.to];
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
                {...fromArrow.add(offset).xy1()}
                {...lineEnd.xy2()}
                stroke="black"
                strokeWidth={2}
              />
              {arrowhead({
                tip: arrowPos,
                direction,
                headLength: arrowHeadLength,
                id: `head-${key}`,
                fill: "black",
                "data-on-drag": drag(() =>
                  span(
                    produceAmb(state, (draft) => {
                      draft.edges[key].to = amb(Object.keys(state.nodes));
                      require(stateIsValid(draft));
                    })
                  )
                ),
                "data-z-index": 1,
              })}
              <circle
                id={`tail-${key}`}
                transform={translate(tailPos)}
                r={5}
                fill="black"
                data-on-drag={drag(() =>
                  span(
                    produceAmb(state, (draft) => {
                      draft.edges[key].from = amb(Object.keys(state.nodes));
                      require(stateIsValid(draft));
                    })
                  )
                )}
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
            r={NODE_R}
            fill="black"
            data-on-drag={drag(vary(["nodes", key, "x"], ["nodes", key, "y"]))}
          />
        ))}
      </g>
    );
  };
}
