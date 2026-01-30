import { closest, vary, withDistance } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { translate } from "../svgx/helpers";

// Variant of orbiting-planet where the planet can also float freely.
// Uses withBackground(closest(vary per star), vary(free x,y)).

export namespace OrbitingPlanetWithBackground {
  const STARS = [
    { x: 100, y: 150, color: "#e8b730", label: "A" },
    { x: 300, y: 100, color: "#e05050", label: "B" },
    { x: 250, y: 280, color: "#4080e0", label: "C" },
  ];

  const ORBIT_RADIUS = 60;
  const STAR_RADIUS = 14;
  const PLANET_RADIUS = 8;

  export type State =
    | { mode: "orbiting"; currentStar: number; angle: number }
    | { mode: "free"; x: number; y: number };

  export const state1: State = {
    mode: "orbiting",
    currentStar: 0,
    angle: 0,
  };

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    const planetX =
      state.mode === "orbiting"
        ? STARS[state.currentStar].x + ORBIT_RADIUS * Math.cos(state.angle)
        : state.x;
    const planetY =
      state.mode === "orbiting"
        ? STARS[state.currentStar].y + ORBIT_RADIUS * Math.sin(state.angle)
        : state.y;

    return (
      <g>
        {/* Orbit circles */}
        {STARS.map((s) => (
          <circle
            cx={s.x}
            cy={s.y}
            r={ORBIT_RADIUS}
            fill="none"
            stroke="#c0c0c0"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}

        {/* Stars */}
        {STARS.map((s) => (
          <g transform={translate(s.x, s.y)}>
            <circle r={STAR_RADIUS} fill={s.color} />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fontWeight="bold"
              fill="white"
            >
              {s.label}
            </text>
          </g>
        ))}

        {/* Planet */}
        <g
          id="planet"
          transform={translate(planetX, planetY)}
          data-z-index={1}
          data-on-drag={drag(() => {
            const angle = state.mode === "orbiting" ? state.angle : 0;
            return closest([
              ...STARS.map((_, starIdx) =>
                vary<State>({ mode: "orbiting", currentStar: starIdx, angle }, [
                  "angle",
                ])
              ),
              withDistance(
                vary<State>(
                  { mode: "free", x: planetX, y: planetY },
                  ["x"],
                  ["y"]
                ),
                () => 200
              ),
            ]);
            // return withBackground(
            //   closest(
            //     STARS.map((_, starIdx) =>
            //       vary<State>(
            //         { mode: "orbiting", currentStar: starIdx, angle },
            //         ["angle"]
            //       )
            //     )
            //   ),
            //   vary<State>(
            //     { mode: "free", x: planetX, y: planetY },
            //     ["x"],
            //     ["y"]
            //   )
            // );
          })}
        >
          <circle
            r={PLANET_RADIUS}
            fill={state.mode === "free" ? "#888" : "#333"}
            stroke="#666"
            strokeWidth={1}
          />
        </g>
      </g>
    );
  };
}
