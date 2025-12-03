import { SVGProps } from "react";
import { path, translate } from "./manipulable";
import { Vec2, Vec2able } from "./math/vec2";

/**
 * Creates a triangular arrowhead polygon.
 *
 * Mandatory props:
 * - tip: Position of the arrowhead tip
 * - direction: Direction vector the arrow points (will be normalized)
 *
 * Optional props with defaults:
 * - headAngle: Angle between the two sides of the arrowhead (default: Math.PI / 8)
 * - headLength: Length from tip to base of arrowhead (default: 20)
 *
 * Any other SVG polygon props are passed through.
 */
export function arrowhead({
  tip,
  direction,
  headAngle = Math.PI / 8,
  headLength = 20,
  ...polygonProps
}: Omit<SVGProps<SVGPolygonElement>, "points" | "transform" | "direction"> & {
  /** Position of the arrowhead tip */
  tip: Vec2able;
  /** Direction vector the arrow points (will be normalized) */
  direction: Vec2able;
  /** Angle between the two sides of the arrowhead (default: Math.PI / 8) */
  headAngle?: number;
  /** Length from tip to base of arrowhead (default: 20) */
  headLength?: number;
}) {
  const tipVec = Vec2(tip);

  // Vector pointing backwards from tip along the arrow direction
  const backFromTip = Vec2(direction).norm().mul(-headLength);

  return (
    <polygon
      transform={translate(tipVec)}
      points={path(
        Vec2(0),
        backFromTip.rotate(headAngle),
        backFromTip.rotate(-headAngle)
      )}
      {...polygonProps}
    />
  );
}
