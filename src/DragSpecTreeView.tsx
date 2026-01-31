import { DragSpec } from "./DragSpec2";
import { assertNever } from "./utils";

export function DragSpecTreeView<T>({
  spec,
  activePath,
}: {
  spec: DragSpec<T>;
  activePath: string | null;
}) {
  return (
    <div className="text-xs font-mono">
      <SpecNode spec={spec} activePath={activePath} />
    </div>
  );
}

const ACTIVE_BG = "rgba(250, 204, 21, 0.25)";
const ACTIVE_BORDER = "rgb(250, 204, 21)";
const INACTIVE_BG = "rgba(148, 163, 184, 0.08)";
const INACTIVE_BORDER = "rgb(203, 213, 225)";

/**
 * Each node knows its own path prefix and checks if activePath starts with it.
 *
 * Path rules:
 *   floating        → "floating"
 *   vary            → "vary"
 *   closest         → "closest/{i}/{childPath}"
 *   with-background → "fg/{childPath}" or "bg/{childPath}"
 *   and-then        → passthrough (child gets same activePath)
 *   with-distance   → passthrough (child gets same activePath)
 */
function SpecNode<T>({
  spec,
  activePath,
}: {
  spec: DragSpec<T>;
  activePath: string | null;
}) {
  if (spec.type === "floating") {
    const active = activePath === "floating";
    return <Box label="floating" active={active} />;
  } else if (spec.type === "vary") {
    const active = activePath === "vary";
    const paramNames = spec.paramPaths.map((p) => {
      const last = p[p.length - 1];
      return typeof last === "string" ? last : String(last);
    });
    return <Box label={`vary [${paramNames.join(", ")}]`} active={active} />;
  } else if (spec.type === "closest") {
    // activePath: "closest/{idx}/{rest}"
    let activeIdx: number | null = null;
    let childPath: string | null = null;
    if (activePath !== null && activePath.startsWith("closest/")) {
      const rest = activePath.slice("closest/".length);
      const slash = rest.indexOf("/");
      if (slash !== -1) {
        activeIdx = parseInt(rest.slice(0, slash), 10);
        childPath = rest.slice(slash + 1);
      }
    }
    const active = activeIdx !== null;
    return (
      <Box label="closest" active={active}>
        <div style={{ display: "flex", flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
          {spec.specs.map((child, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <div style={{ fontSize: 9, color: "rgb(148, 163, 184)", paddingLeft: 2 }}>
                {i}
              </div>
              <SpecNode spec={child} activePath={i === activeIdx ? childPath : null} />
            </div>
          ))}
        </div>
      </Box>
    );
  } else if (spec.type === "with-background") {
    let fgPath: string | null = null;
    let bgPath: string | null = null;
    if (activePath !== null) {
      if (activePath.startsWith("fg/")) fgPath = activePath.slice("fg/".length);
      else if (activePath.startsWith("bg/")) bgPath = activePath.slice("bg/".length);
    }
    const active = fgPath !== null || bgPath !== null;
    return (
      <Box label="withBackground" active={active}>
        <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
          <Slot label="fg">
            <SpecNode spec={spec.foreground} activePath={fgPath} />
          </Slot>
          <Slot label="bg">
            <SpecNode spec={spec.background} activePath={bgPath} />
          </Slot>
        </div>
      </Box>
    );
  } else if (spec.type === "and-then") {
    const childActive = activePath !== null;
    return (
      <Box label="andThen" active={childActive}>
        <SpecNode spec={spec.spec} activePath={activePath} />
      </Box>
    );
  } else if (spec.type === "with-distance") {
    const childActive = activePath !== null;
    return (
      <Box label="withDistance" active={childActive}>
        <SpecNode spec={spec.spec} activePath={activePath} />
      </Box>
    );
  } else {
    assertNever(spec);
  }
}

function Box({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children?: React.ReactNode;
}) {
  const isLeaf = !children;
  const highlighted = active && isLeaf;
  return (
    <div
      style={{
        background: highlighted ? ACTIVE_BG : INACTIVE_BG,
        border: `${highlighted ? 2 : 1}px solid ${highlighted ? ACTIVE_BORDER : INACTIVE_BORDER}`,
        borderRadius: 6,
        padding: "4px 6px",
        transition: "background 150ms, border-color 150ms",
      }}
    >
      <div
        style={{
          color: highlighted ? "rgb(161, 98, 7)" : "rgb(100, 116, 139)",
          fontWeight: highlighted ? 600 : 400,
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

function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <div style={{ fontSize: 9, color: "rgb(148, 163, 184)", paddingLeft: 2 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
