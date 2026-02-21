import { AnnotatedSpec, SpecDebugInfo } from "./DragBehavior";
import { DragSpec, DragSpecData } from "./DragSpec";
import { drawLayered } from "./svgx/layers";
import { Transition } from "./transition";
import { assertNever } from "./utils";

export function DragSpecTreeView<T>({
  spec,
  activePath,
  colorMap,
  annotatedSpec,
  svgWidth,
  svgHeight,
}: {
  spec: DragSpec<T>;
  activePath: string | null;
  colorMap?: Map<string, string>;
  annotatedSpec?: AnnotatedSpec<T>;
  svgWidth?: number;
  svgHeight?: number;
}) {
  return (
    <div className="text-xs font-mono">
      <SpecNode
        spec={spec}
        activePath={activePath}
        path=""
        colorMap={colorMap ?? null}
        annotated={annotatedSpec ?? null}
        svgWidth={svgWidth ?? 0}
        svgHeight={svgHeight ?? 0}
      />
    </div>
  );
}

const ACTIVE_BG = "rgba(250, 204, 21, 0.25)";
const ACTIVE_BORDER = "rgb(250, 204, 21)";
const INACTIVE_BG = "rgba(148, 163, 184, 0.08)";
const INACTIVE_BORDER = "rgb(203, 213, 225)";

type NodeProps<T> = {
  spec: DragSpecData<T>;
  activePath: string | null;
  path: string;
  colorMap: Map<string, string> | null;
  annotated: AnnotatedSpec<T> | null;
  svgWidth: number;
  svgHeight: number;
};

/**
 * `activePath` is the full, unmodified active path from the root.
 * `path` is the accumulated path of the current node, built top-down.
 * Each node checks whether `activePath` matches or extends its own `path`.
 */
function SpecNode<T>(props: NodeProps<T>) {
  const { spec, activePath, path, colorMap, annotated, svgWidth, svgHeight } =
    props;
  const debug = annotated?.debug ?? null;

  /** Helper: get annotated child by index */
  const child = (i: number): AnnotatedSpec<T> | null =>
    annotated?.children[i] ?? null;

  if (spec.type === "fixed") {
    const fullPath = path + "fixed";
    const active = activePath === fullPath;
    return (
      <Box label="fixed" active={active} color={colorMap?.get(fullPath)}>
        <StateThumbnails
          debug={debug}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
      </Box>
    );
  } else if (spec.type === "with-floating") {
    const prefix = path + "with-floating/";
    return (
      <Box label="withFloating" color={colorMap?.get(path + "with-floating")}>
        <OutputThumbnail
          debug={debug}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
        <SpecNode
          spec={spec.spec}
          activePath={activePath}
          path={prefix}
          colorMap={colorMap}
          annotated={child(0)}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
      </Box>
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
        <StateThumbnails
          debug={debug}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
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
          {spec.specs.map((childSpec, i) => (
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
                spec={childSpec}
                activePath={activePath}
                path={path + `closest/${i}/`}
                colorMap={colorMap}
                annotated={child(i)}
                svgWidth={svgWidth}
                svgHeight={svgHeight}
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
              annotated={child(0)}
              svgWidth={svgWidth}
              svgHeight={svgHeight}
            />
          </Slot>
          <Slot label="bg">
            <SpecNode
              spec={spec.background}
              activePath={activePath}
              path={path + "bg/"}
              colorMap={colorMap}
              annotated={child(1)}
              svgWidth={svgWidth}
              svgHeight={svgHeight}
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
          annotated={child(0)}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
      </Box>
    );
  } else if (spec.type === "during") {
    return (
      <Box label="during">
        <OutputThumbnail
          debug={debug}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
        <SpecNode
          spec={spec.spec}
          activePath={activePath}
          path={path}
          colorMap={colorMap}
          annotated={child(0)}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
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
          annotated={child(0)}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
      </Box>
    );
  } else if (spec.type === "with-snap-radius") {
    const snappedPrefix = path + "with-snap-radius[snapped]/";
    const normalPrefix = path + "with-snap-radius/";
    const snapped = activePath?.startsWith(snappedPrefix);
    const childPrefix = snapped ? snappedPrefix : normalPrefix;
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
        <OutputThumbnail
          debug={debug}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
        <SpecNode
          spec={spec.spec}
          activePath={activePath}
          path={childPrefix}
          colorMap={colorMap}
          annotated={child(0)}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
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
      >
        <OutputThumbnail
          debug={debug}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
        <Slot label="states">
          <StateThumbnails
            debug={debug}
            svgWidth={svgWidth}
            svgHeight={svgHeight}
          />
        </Slot>
      </Box>
    );
  } else if (spec.type === "with-drop-transition") {
    const prefix = path + "with-drop-transition/";
    return (
      <Box
        label={`withDropTransition (${describeTransition(spec.transition)})`}
      >
        <SpecNode
          spec={spec.spec}
          activePath={activePath}
          path={prefix}
          colorMap={colorMap}
          annotated={child(0)}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
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
      >
        <StateThumbnails
          debug={debug}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
      </Box>
    );
  } else if (spec.type === "with-branch-transition") {
    const prefix = path + "with-branch-transition/";
    return (
      <Box
        label={`withBranchTransition (${describeTransition(spec.transition)})`}
      >
        <SpecNode
          spec={spec.spec}
          activePath={activePath}
          path={prefix}
          colorMap={colorMap}
          annotated={child(0)}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
      </Box>
    );
  } else if (spec.type === "drop-target") {
    const fullPath = path + "drop-target";
    const active = activePath === fullPath;
    return (
      <Box
        label={`dropTarget → ${spec.targetId}`}
        active={active}
        color={colorMap?.get(fullPath)}
      >
        <StateThumbnails
          debug={debug}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
      </Box>
    );
  } else if (spec.type === "with-chaining") {
    const prefix = path + "with-chaining/";
    return (
      <Box label="withChaining">
        <SpecNode
          spec={spec.spec}
          activePath={activePath}
          path={prefix}
          colorMap={colorMap}
          annotated={child(0)}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
        />
      </Box>
    );
  } else {
    assertNever(spec);
  }
}

// # Thumbnail rendering

const THUMB_HEIGHT = 40;

function StateThumbnails<T>({
  debug,
  svgWidth,
  svgHeight,
}: {
  debug: SpecDebugInfo<T> | null;
  svgWidth: number;
  svgHeight: number;
}) {
  if (!debug?.renderedStates || svgWidth === 0 || svgHeight === 0) return null;
  const thumbW = Math.round(THUMB_HEIGHT * (svgWidth / svgHeight));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 3,
        flexWrap: "wrap",
        marginTop: 2,
      }}
    >
      {debug.renderedStates.map((rs, i) => (
        <svg
          key={i}
          width={thumbW}
          height={THUMB_HEIGHT}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            border: "1px solid rgb(203, 213, 225)",
            borderRadius: 3,
            background: "white",
            ...(debug.closestIndex === i
              ? { outline: `2px solid ${ACTIVE_BORDER}`, outlineOffset: -1 }
              : {}),
          }}
        >
          {drawLayered(rs.layered)}
        </svg>
      ))}
    </div>
  );
}

function OutputThumbnail({
  debug,
  svgWidth,
  svgHeight,
}: {
  debug: SpecDebugInfo<unknown> | null;
  svgWidth: number;
  svgHeight: number;
}) {
  if (!debug?.outputRendered || svgWidth === 0 || svgHeight === 0) return null;
  const thumbW = Math.round(THUMB_HEIGHT * (svgWidth / svgHeight));
  return (
    <div style={{ marginTop: 2, marginBottom: 4 }}>
      <svg
        width={thumbW}
        height={THUMB_HEIGHT}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{
          border: "1px solid rgb(203, 213, 225)",
          borderRadius: 3,
          background: "white",
        }}
      >
        {drawLayered(debug.outputRendered)}
      </svg>
    </div>
  );
}

// # Shared UI components

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

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 6,
        padding: "4px 6px",
        transition: "background 150ms, border-color 150ms",
        ...(active
          ? color
            ? { outline: `2px solid black`, outlineOffset: 1 }
            : { outline: `2px solid ${ACTIVE_BORDER}`, outlineOffset: -1 }
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

/** Format a Transition for display. */
function describeTransition(t: Transition | false): string {
  if (!t) return "none";
  return `${typeof t.easing === "function" ? "fn" : t.easing} ${t.duration}ms`;
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
