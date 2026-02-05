import { produce } from "immer";
import { closest, lessThan, vary } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { Vec2 } from "../math/vec2";
import { translate } from "../svgx/helpers";

export namespace MultiCirclePoints {
  export type Circle = {
    id: string;
    x: number;
    y: number;
    radius: number;
    color: string;
  };

  export type Point = {
    id: string;
    circleId: string;
    // Position relative to circle center
    dx: number;
    dy: number;
  };

  export type State = {
    circles: Circle[];
    points: Point[];
  };

  export const state1: State = {
    circles: [
      { id: "c1", x: 100, y: 150, radius: 70, color: "#e57373" },
      { id: "c2", x: 250, y: 120, radius: 60, color: "#64b5f6" },
      { id: "c3", x: 200, y: 250, radius: 80, color: "#81c784" },
    ],
    points: [
      { id: "p1", circleId: "c1", dx: 20, dy: -10 },
      { id: "p2", circleId: "c1", dx: -30, dy: 20 },
      { id: "p3", circleId: "c2", dx: 0, dy: 15 },
      { id: "p4", circleId: "c3", dx: 25, dy: -25 },
    ],
  };

  const getCircle = (state: State, circleId: string) =>
    state.circles.find((c) => c.id === circleId)!;

  const getCircleIdx = (state: State, circleId: string) =>
    state.circles.findIndex((c) => c.id === circleId);

  const getPointAbsolutePos = (state: State, point: Point): Vec2 => {
    const circle = getCircle(state, point.circleId);
    return Vec2(circle.x + point.dx, circle.y + point.dy);
  };

  export const manipulable: Manipulable<State> = ({
    state,
    drag,
    draggedId,
  }) => {
    return (
      <g>
        {/* Render circles */}
        {state.circles.map((circle, circleIdx) => {
          const isCircleDragged = draggedId === circle.id;
          return (
            <g key={circle.id}>
              {/* Circle boundary */}
              <circle
                id={circle.id}
                transform={translate(Vec2(circle.x, circle.y))}
                r={circle.radius}
                fill={circle.color + "20"}
                stroke={circle.color}
                strokeWidth={isCircleDragged ? 3 : 2}
                strokeDasharray={isCircleDragged ? undefined : "6 4"}
                data-z-index={isCircleDragged ? 2 : 1}
                data-on-drag={drag(
                  vary(
                    state,
                    ["circles", circleIdx, "x"],
                    ["circles", circleIdx, "y"]
                  )
                )}
              />
            </g>
          );
        })}

        {/* Render points */}
        {state.points.map((point, pointIdx) => {
          const circle = getCircle(state, point.circleId);
          const absPos = getPointAbsolutePos(state, point);
          const isPointDragged = draggedId === point.id;

          // For each circle, create a vary spec for the point in that circle
          const varySpecs = state.circles.map((targetCircle) => {
            const targetCircleIdx = getCircleIdx(state, targetCircle.id);

            // Create state with point moved to target circle (at center initially)
            const stateInCircle = produce(state, (draft) => {
              draft.points[pointIdx].circleId = targetCircle.id;
              // If moving to a different circle, start at center
              if (targetCircle.id !== point.circleId) {
                draft.points[pointIdx].dx = 0;
                draft.points[pointIdx].dy = 0;
              }
            });

            return vary(
              stateInCircle,
              ["points", pointIdx, "dx"],
              ["points", pointIdx, "dy"],
              {
                constraint: (s) => {
                  const p = s.points[pointIdx];
                  const c = s.circles[targetCircleIdx];
                  return lessThan(p.dx ** 2 + p.dy ** 2, (c.radius - 10) ** 2);
                },
                constrainByParams: true,
              }
            );
          });

          return (
            <circle
              key={point.id}
              id={point.id}
              transform={translate(absPos)}
              r={10}
              fill={circle.color}
              stroke="white"
              strokeWidth={2}
              data-z-index={isPointDragged ? 10 : 3}
              data-on-drag={drag(closest(varySpecs))}
            />
          );
        })}
      </g>
    );
  };
}
