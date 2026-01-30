import { closest, vary } from "../DragSpec2";
import { Manipulable } from "../manipulable2";
import { translate } from "../svgx/helpers";

// New v2-only demo: a planet that can orbit around different stars.
// Demonstrates closest(stars.map(() => vary(...))).

export namespace OrbitingPlanet {
  const STARS = [
    { x: 100, y: 150, color: "#e8b730", label: "A" },
    { x: 300, y: 100, color: "#e05050", label: "B" },
    { x: 250, y: 280, color: "#4080e0", label: "C" },
  ];

  const ORBIT_RADIUS = 60;
  const STAR_RADIUS = 14;
  const PLANET_RADIUS = 8;

  export type State = {
    currentStar: number;
    angle: number;
  };

  export const state1: State = {
    currentStar: 0,
    angle: 0,
  };

  export const manipulable: Manipulable<State> = ({ state, drag }) => {
    const star = STARS[state.currentStar];
    const planetX = star.x + ORBIT_RADIUS * Math.cos(state.angle);
    const planetY = star.y + ORBIT_RADIUS * Math.sin(state.angle);

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
          data-on-drag={drag(() =>
            closest(
              STARS.map((_, starIdx) =>
                vary({ currentStar: starIdx, angle: state.angle }, ["angle"])
              )
            )
          )}
        >
          <circle r={PLANET_RADIUS} fill="#333" stroke="#666" strokeWidth={1} />
        </g>
      </g>
    );
  };
}
