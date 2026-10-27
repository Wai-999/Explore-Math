import { useId } from "react";
import type { Geometry } from "./types";
const project = ([x, y, z]: number[]) => [
  320 + 50 * x - 42 * y,
  265 + 18 * x + 22 * y - 60 * z,
];
export function AppliedFallback({ geometry: g }: { geometry: Geometry }) {
  const id = useId().replace(/[^a-z0-9_-]/gi, "");
  const cells = [];
  for (let j = 0; j < g.size - 1; j++)
    for (let i = 0; i < g.size - 1; i++) {
      const a = j * g.size + i,
        ids = [a, a + 1, a + g.size + 1, a + g.size];
      cells.push(
        <polygon
          key={a}
          points={ids.map((k) => project(g.points[k]).join(",")).join(" ")}
          fill={g.valid[a] ? "var(--accent)" : "var(--muted)"}
          fillOpacity={g.valid[a] ? 0.12 : 0.04}
          stroke="currentColor"
          strokeOpacity=".14"
          strokeWidth=".5"
        />,
      );
    }
  const marker = project(g.marker);
  return (
    <svg
      className="geometry-view applied-fallback"
      viewBox="0 0 640 410"
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>{g.labels.join(" / ")} · projected model</title>
      <desc id={`${id}-desc`}>
        Isometric projection of the same computed 3D geometry. Surface height is
        rescaled for display; physical values and units are in the table.
        Numeric controls provide equivalent input. Dashed lines identify
        constraints; solid route and arm lines show computed positions.
      </desc>
      {cells}
      {g.lines.map((line, i) => (
        <polyline
          key={i}
          points={line.points.map((p) => project(p).join(",")).join(" ")}
          fill="none"
          stroke={line.color}
          strokeWidth={line.label.includes("arm") ? 5 : 2.5}
          strokeDasharray={
            line.label.includes("constraint") ? "6 4" : undefined
          }
        >
          <title>{line.label}</title>
        </polyline>
      ))}
      {g.spheres.map((s, i) => {
        const q = project(s.point);
        return (
          <circle
            key={i}
            cx={q[0]}
            cy={q[1]}
            r={Math.max(3, s.radius * 45)}
            fill={s.color}
            fillOpacity=".4"
          >
            <title>{s.label}</title>
          </circle>
        );
      })}
      {g.gradient && (
        <line
          x1={project(g.gradient[0])[0]}
          y1={project(g.gradient[0])[1]}
          x2={project(g.gradient[1])[0]}
          y2={project(g.gradient[1])[1]}
          stroke="#edb58c"
          strokeWidth="4"
        >
          <title>
            Analytic gradient direction; length scaled for visibility
          </title>
        </line>
      )}
      <circle
        cx={marker[0]}
        cy={marker[1]}
        r="6"
        fill="var(--accent)"
        stroke="var(--text)"
        strokeWidth="2"
      />
      <text x="18" y="26" fill="currentColor" fontSize="15">
        {g.labels[0]} · {g.labels[1]}
      </text>
      <text x="18" y="393" fill="currentColor" fontSize="15">
        Height: {g.labels[2]} · numeric inputs below
      </text>
    </svg>
  );
}
