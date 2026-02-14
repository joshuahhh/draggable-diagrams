import { DragSpec, DragSpecData } from "./DragSpec";
import { assertNever } from "./utils";

export function DragSpecTreeView<T>({
  spec,
  activePath,
  colorMap,
}: {
  spec: DragSpec<T>;
  activePath: string | null;
  colorMap?: Map<string, string>;
}) {
  return (
    <div className="text-xs font-mono">
      <SpecNode
        spec={spec}
        activePath={activePath}
        path=""
        colorMap={colorMap ?? null}
      />
    </div>
  );
}

const ACTIVE_BG = "rgba(250, 204, 21, 0.25)";
const ACTIVE_BORDER = "rgb(250, 204, 21)";
const INACTIVE_BG = "rgba(148, 163, 184, 0.08)";
const INACTIVE_BORDER = "rgb(203, 213, 225)";

/**
 * `activePath` is the full, unmodified active path from the root.
 * `path` is the accumulated path of the current node, built top-down.
 * Each node checks whether `activePath` matches or extends its own `path`.
 */
function SpecNode<T>({
  spec,
  activePath,
  path,
  colorMap,
}: {
  spec: DragSpecData<T>;
  activePath: string | null;
  path: string;
  colorMap: Map<string, string> | null;
}) {
  if (spec.type === "just") {
    const fullPath = path + "just";
    const active = activePath === fullPath;
    return <Box label="just" active={active} color={colorMap?.get(fullPath)} />;
  } else if (spec.type === "floating") {
    const fullPath = path + "floating";
    const active = activePath === fullPath;
    return (
      <Box label="floating" active={active} color={colorMap?.get(fullPath)} />
    );
  } else if (spec.type === "vary") {
    const fullPath = path + "vary";
    const active = activePath === fullPath;
    const paramNames = spec.paramPaths.map((p) => {
      const last = p[p.length - 1];
      return typeof last === "string" ? last : String(last);
    });
    const constraintSrc = spec.constraint
      ? truncate(spec.constraint.toString(), 60)
      : null;
    return (
      <Box
        label={`vary [${paramNames.join(", ")}]`}
        active={active}
        color={colorMap?.get(fullPath)}
      >
        {constraintSrc && (
          <div
            style={{
              fontSize: 9,
              color: "rgb(120, 113, 108)",
              background: "rgba(0,0,0,0.04)",
              borderRadius: 3,
              padding: "2px 4px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            constraint: {constraintSrc}
          </div>
        )}
      </Box>
    );
  } else if (spec.type === "closest") {
    return (
      <Box label="closest">
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          {spec.specs.map((child, i) => (
            <div
              key={i}
              style={{ display: "flex", flexDirection: "column", gap: 1 }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "rgb(148, 163, 184)",
                  paddingLeft: 2,
                }}
              >
                {i}
              </div>
              <SpecNode
                spec={child}
                activePath={activePath}
                path={path + `closest/${i}/`}
                colorMap={colorMap}
              />
            </div>
          ))}
        </div>
      </Box>
    );
  } else if (spec.type === "with-background") {
    return (
      <Box label={`withBackground (r=${spec.radius})`}>
        <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
          <Slot label="fg">
            <SpecNode
              spec={spec.foreground}
              activePath={activePath}
              path={path + "fg/"}
              colorMap={colorMap}
            />
          </Slot>
          <Slot label="bg">
            <SpecNode
              spec={spec.background}
              activePath={activePath}
              path={path + "bg/"}
              colorMap={colorMap}
            />
          </Slot>
        </div>
      </Box>
    );
  } else if (spec.type === "and-then") {
    return (
      <Box label="andThen">
        <SpecNode
          spec={spec.spec}
          activePath={activePath}
          path={path}
          colorMap={colorMap}
        />
      </Box>
    );
  } else if (spec.type === "with-distance") {
    return (
      <Box label="withDistance">
        <SpecNode
          spec={spec.spec}
          activePath={activePath}
          path={path}
          colorMap={colorMap}
        />
      </Box>
    );
  } else if (spec.type === "with-snap-radius") {
    // activePath may be "with-snap-radius/..." or "with-snap-radius[snapped]/..."
    // Strip either prefix for the child to match correctly
    let childActivePath = activePath;
    const snapped = activePath?.startsWith("with-snap-radius[snapped]/");
    if (snapped) {
      childActivePath = activePath!.slice("with-snap-radius[snapped]/".length);
    } else if (activePath?.startsWith("with-snap-radius/")) {
      childActivePath = activePath.slice("with-snap-radius/".length);
    }
    const options = [
      spec.transition && "transition",
      spec.chain && "chain",
    ].filter(Boolean);
    let label = `withSnapRadius (${spec.radius}${
      options.length ? `, ${options.join(", ")}` : ""
    })`;
    if (spec.transition) {
      label += snapped ? " [snapped]" : " [not snapped]";
    }
    return (
      <Box label={label}>
        <SpecNode
          spec={spec.spec}
          activePath={childActivePath}
          path={path}
          colorMap={colorMap}
        />
      </Box>
    );
  } else if (spec.type === "between") {
    const fullPath = path + "between";
    const active = activePath === fullPath;
    return (
      <Box
        label={`between [${spec.states.length}]`}
        active={active}
        color={colorMap?.get(fullPath)}
      />
    );
  } else if (spec.type === "with-drop-transition") {
    let childActivePath = activePath;
    if (activePath?.startsWith("with-drop-transition/")) {
      childActivePath = activePath.slice("with-drop-transition/".length);
    }
    const t = spec.transition;
    const transitionDesc = t
      ? `${typeof t.easing === "function" ? "fn" : t.easing} ${t.duration}ms`
      : "none";
    return (
      <Box label={`withDropTransition (${transitionDesc})`}>
        <SpecNode
          spec={spec.spec}
          activePath={childActivePath}
          path={path}
          colorMap={colorMap}
        />
      </Box>
    );
  } else if (spec.type === "switch-to-state-and-follow") {
    const fullPath = path + "switch-to-state-and-follow";
    const active = activePath === fullPath;
    return (
      <Box
        label={`switchToStateAndFollow → ${spec.draggedId}`}
        active={active}
        color={colorMap?.get(fullPath)}
      />
    );
  } else if (spec.type === "drop-target") {
    const fullPath = path + "drop-target";
    const active = activePath === fullPath;
    return (
      <Box
        label={`dropTarget → ${spec.targetId}`}
        active={active}
        color={colorMap?.get(fullPath)}
      />
    );
  } else {
    assertNever(spec);
  }
}

function Box({
  label,
  active,
  color,
  children,
}: {
  label: string;
  active?: boolean;
  color?: string;
  children?: React.ReactNode;
}) {
  const bg = color
    ? colorToAlpha(color, 0.15)
    : active
      ? ACTIVE_BG
      : INACTIVE_BG;
  const border = color ? color : active ? ACTIVE_BORDER : INACTIVE_BORDER;
  const borderWidth = active && !color ? 2 : 1;

  return (
    <div
      style={{
        background: bg,
        border: `${borderWidth}px solid ${border}`,
        borderRadius: 6,
        padding: "4px 6px",
        transition: "background 150ms, border-color 150ms",
        ...(active && color
          ? { outline: `2px solid black`, outlineOffset: 1 }
          : {}),
      }}
    >
      <div
        style={{
          color: active && !color ? "rgb(161, 98, 7)" : "rgb(100, 116, 139)",
          fontWeight: active ? 600 : 400,
          marginBottom: children ? 3 : 0,
          fontSize: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Slot({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <div style={{ fontSize: 9, color: "rgb(148, 163, 184)", paddingLeft: 2 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + "\u2026";
}

/** Convert "rgb(r, g, b)" to "rgba(r, g, b, a)" */
function colorToAlpha(rgb: string, alpha: number): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgb;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}
