import { useId, useRef, useState } from "react";
import { transform, type Mat3, type Vec3 } from "../math/linear";
import {
  curve,
  energy,
  gradient,
  type Point2,
  type SurfaceKind,
} from "../math/calculus";
import { business, TRAIN } from "../math/applications";
export type SceneProps =
  | {
      kind: "linear";
      matrix: Mat3;
      onMatrix?: (m: Mat3) => void;
      highlight?: string;
    }
  | {
      kind: "calculus";
      surface: SurfaceKind;
      point: Point2;
      path: Point2[];
      highlight?: string;
    }
  | { kind: "robot"; matrix: Mat3 }
  | { kind: "business"; quantity: number; demand: number }
  | { kind: "regression"; slope: number; intercept: number };
const corners: Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
const edges = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];
export const project = ([x, y, z]: Vec3) => [
  310 + 65 * x - 49 * y,
  240 + 26 * x + 30 * y - 78 * z,
];
export function GeometryView(props: SceneProps) {
  const svg = useRef<SVGSVGElement>(null);
  const markerId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [drag, setDrag] = useState<number | null>(null);
  const matrix =
    props.kind === "linear" || props.kind === "robot" ? props.matrix : null;
  if (matrix) {
    const highlight = props.kind === "linear" ? props.highlight : undefined;
    const pts = corners.map((p) => project(transform(matrix, p))),
      original = corners.map(project);
    const face = (indices: number[]) =>
      indices.map((i) => pts[i].join(",")).join(" ");
    return (
      <svg
        ref={svg}
        className="geometry-view"
        viewBox="0 0 640 410"
        role="img"
        aria-label="Isometric projection of the original dashed cube and transformed solid cube. Numeric coordinates are available below."
        onPointerMove={(e) => {
          if (
            drag === null ||
            props.kind !== "linear" ||
            !props.onMatrix ||
            !svg.current
          )
            return;
          const p = svg.current.createSVGPoint();
          p.x = e.clientX;
          p.y = e.clientY;
          const ctm = svg.current.getScreenCTM();
          if (!ctm) return;
          const v = p.matrixTransform(ctm.inverse());
          const z = matrix[6 + drag],
            xx = v.x - 310,
            yy = v.y - 240 + 78 * z;
          const y = (yy - (26 * xx) / 65) / (30 + (26 * 49) / 65),
            x = (xx + 49 * y) / 65;
          const m = [...matrix] as Mat3;
          m[drag] = Math.max(-3, Math.min(3, Math.round(x * 100) / 100));
          m[3 + drag] = Math.max(-3, Math.min(3, Math.round(y * 100) / 100));
          props.onMatrix(m);
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <defs>
          <pattern
            id="grid"
            width="45"
            height="45"
            patternUnits="userSpaceOnUse"
            patternTransform="matrix(1 .4 -1 .55 320 260)"
          >
            <path
              d="M 45 0 L 0 0 0 45"
              fill="none"
              stroke="currentColor"
              strokeWidth=".6"
            />
          </pattern>
          <linearGradient id="cube-fill" x2="1" y2="1">
            <stop stopColor="#bce993" stopOpacity=".45" />
            <stop offset="1" stopColor="#51b4a8" stopOpacity=".08" />
          </linearGradient>
        </defs>
        <rect
          x="25"
          y="65"
          width="590"
          height="325"
          fill="url(#grid)"
          opacity=".24"
        />
        {[
          [[-3, 0, 0], [3, 0, 0], "x"],
          [[0, -3, 0], [0, 3, 0], "y"],
          [[0, 0, 0], [0, 0, 2.8], "z"],
        ].map((a, i) => {
          const p = project(a[0] as Vec3),
            q = project(a[1] as Vec3);
          return (
            <g key={i} className="svg-axis">
              <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />
              <text x={q[0] + 8} y={q[1]}>
                {String(a[2])}
              </text>
            </g>
          );
        })}
        {edges.map(([a, b], i) => (
          <line
            key={"o" + i}
            x1={original[a][0]}
            y1={original[a][1]}
            x2={original[b][0]}
            y2={original[b][1]}
            stroke="currentColor"
            opacity=".4"
            strokeDasharray="5 6"
          />
        ))}
        {[
          [0, 1, 2, 3],
          [0, 1, 5, 4],
          [1, 2, 6, 5],
          [4, 5, 6, 7],
        ].map((f, i) => (
          <polygon
            key={i}
            points={face(f)}
            fill="url(#cube-fill)"
            opacity={
              highlight === "volume"
                ? 0.95
                : highlight === "area" && i !== 0
                  ? 0.2
                  : 1
            }
          />
        ))}
        {highlight === "area" && (
          <polygon
            data-testid="highlighted-area-face"
            points={face([0, 1, 2, 3])}
            fill="#80d8cd"
            fillOpacity=".25"
            stroke="#80d8cd"
            strokeWidth="3"
          />
        )}
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={pts[a][0]}
            y1={pts[a][1]}
            x2={pts[b][0]}
            y2={pts[b][1]}
            stroke="#bded92"
            strokeWidth={highlight === "volume" ? 3.3 : 1.7}
          />
        ))}
        {[0, 1, 2].map((c) => {
          const p = project([matrix[c], matrix[c + 3], matrix[c + 6]]);
          return (
            <g key={c}>
              <line
                x1="310"
                y1="240"
                x2={p[0]}
                y2={p[1]}
                stroke={["#d2ec9a", "#79d3c9", "#c8b6ec"][c]}
                strokeWidth={highlight === "columns" ? 6 : 3}
              />
              <circle
                data-testid={"vector-handle-" + c}
                cx={p[0]}
                cy={p[1]}
                r={props.kind === "linear" && props.onMatrix ? 9 : 5}
                fill={["#d2ec9a", "#79d3c9", "#c8b6ec"][c]}
                stroke="#173234"
                strokeWidth="3"
                style={{ cursor: props.kind === "linear" ? "grab" : undefined }}
                onPointerDown={(e) => {
                  if (props.kind !== "linear" || !props.onMatrix) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag(c);
                }}
              />
              <text x={p[0] + 13} y={p[1] - 10} className="basis-label">
                b{c + 1}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }
  if (props.kind === "calculus") {
    const to = ([x, y]: Point2) => [320 + x * 85, 205 + y * 60];
    const p = to(props.point);
    const slice =
      props.highlight === "x-slice"
        ? {
            from: to([-2.5, props.point[1]]),
            to: to([2.5, props.point[1]]),
            label: `Projected x-slice: y=${props.point[1].toFixed(2)}`,
          }
        : props.highlight === "y-slice"
          ? {
              from: to([props.point[0], -2.5]),
              to: to([props.point[0], 2.5]),
              label: `Projected y-slice: x=${props.point[0].toFixed(2)}`,
            }
          : null;
    return (
      <svg
        className="geometry-view"
        viewBox="0 0 640 410"
        role="img"
        aria-label={
          props.surface === "bowl"
            ? "Top-down contour view of the energy landscape with the current particle and descent path. Contours are equal energy."
            : "Schematic top-down view of the two-valley landscape. Contours are illustrative; use the numeric energy and slice table for exact values."
        }
      >
        <defs>
          <marker
            id={`${markerId}-gradient`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10z" fill="var(--accent)" />
          </marker>
          <pattern
            id="contour-grid"
            width="85"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M85 0H0V60"
              stroke="currentColor"
              fill="none"
              opacity=".12"
            />
          </pattern>
        </defs>
        <rect
          x="107"
          y="55"
          width="426"
          height="300"
          fill="url(#contour-grid)"
        />
        {props.surface === "bowl"
          ? [0.2, 0.5, 1, 2, 3, 4].map((v) => (
              <ellipse
                key={v}
                cx="320"
                cy="205"
                rx={Math.sqrt(2 * v) * 85}
                ry={Math.sqrt(v) * 60}
                fill="none"
                stroke="#7cbfa7"
                opacity=".6"
              />
            ))
          : [-1, 1].flatMap((x) =>
              [0.2, 0.5, 0.8, 1.2].map((r) => (
                <ellipse
                  key={x + ":" + r}
                  cx={320 + x * 85}
                  cy="205"
                  rx={r * 60}
                  ry={r * 85}
                  fill="none"
                  stroke="#7cbfa7"
                  opacity=".5"
                />
              )),
            )}
        {props.surface === "valleys" && (
          <text x="20" y="30" className="plot-note">
            Schematic contours; use numbers for exact energies.
          </text>
        )}
        {slice && (
          <g data-testid="projected-surface-slice">
            <line
              x1={slice.from[0]}
              y1={slice.from[1]}
              x2={slice.to[0]}
              y2={slice.to[1]}
              stroke={props.highlight === "x-slice" ? "#80d8cd" : "#cbb5eb"}
              strokeWidth="4"
              strokeDasharray="8 5"
            />
            <text x="25" y="390" className="basis-label">
              {slice.label} · xy-plane projection; heights are in the table.
            </text>
          </g>
        )}
        {props.highlight === "gradient" &&
          (() => {
            const g = gradient(props.surface, props.point),
              end = to([
                props.point[0] - 0.4 * g[0],
                props.point[1] - 0.4 * g[1],
              ]);
            return (
              <g>
                <line
                  x1={p[0]}
                  y1={p[1]}
                  x2={end[0]}
                  y2={end[1]}
                  stroke="var(--accent)"
                  strokeWidth="4"
                  markerEnd={
                    Math.hypot(...g) > 1e-10
                      ? `url(#${markerId}-gradient)`
                      : undefined
                  }
                />
                <text x="25" y="390" className="basis-label">
                  −0.4∇E in the parameter xy plane; scaled descent direction.
                </text>
              </g>
            );
          })()}
        {props.highlight === "origin" && (
          <g>
            <circle
              cx="320"
              cy="205"
              r="13"
              fill="none"
              stroke="#f2c994"
              strokeWidth="3"
            />
            <text x="330" y="230" className="basis-label">
              origin: E(0,0)={energy(props.surface, [0, 0]).toFixed(3)}
            </text>
          </g>
        )}
        <path
          d={props.path
            .map((v, i) => (i ? "L" : "M") + to(v).join(" "))
            .join(" ")}
          fill="none"
          stroke="#d5ed9c"
          strokeWidth="3"
        />
        <circle cx={p[0]} cy={p[1]} r="9" fill="#d5ed9c" />
        <text x={p[0] + 15} y={p[1] - 10} className="basis-label">
          E = {energy(props.surface, props.point).toFixed(3)}
        </text>
        <text x="530" y="208" className="basis-label">
          x
        </text>
        <text x="324" y="55" className="basis-label">
          y
        </text>
      </svg>
    );
  }
  if (props.kind === "business") {
    const { quantity: q, demand } = props;
    const x = (q: number) => 70 + q * 5,
      y = (profit: number) => 325 - profit / 15;
    const points = Array.from(
      { length: 101 },
      (_, q) => `${x(q)},${y(business(q, demand).profit)}`,
    ).join(" ");
    return (
      <svg
        className="geometry-view plot"
        viewBox="0 0 640 410"
        role="img"
        aria-label="Profit in dollars per day versus production units per day. The dot is the selected quantity."
      >
        <path d="M70 45V325H590" className="plot-axis" />
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1="55" y2="325" className="plot-grid" />
            <text x={x(v)} y="350">
              {v}
            </text>
          </g>
        ))}
        {[0, 1000, 2000, 3000, 4000].map((v) => (
          <g key={v}>
            <line x1="70" x2="570" y1={y(v)} y2={y(v)} className="plot-grid" />
            <text x="14" y={y(v) + 4}>
              {v}
            </text>
          </g>
        ))}
        <polyline
          points={points}
          fill="none"
          stroke="#bded92"
          strokeWidth="3"
        />
        <line
          x1={x(q)}
          x2={x(q)}
          y1="325"
          y2={y(business(q, demand).profit)}
          stroke="#bded92"
          strokeDasharray="5 5"
        />
        <circle
          cx={x(q)}
          cy={y(business(q, demand).profit)}
          r="8"
          fill="#bded92"
        />
        <text x="250" y="390">
          Production (units / day)
        </text>
        <text x="70" y="30">
          Profit ($ / day)
        </text>
      </svg>
    );
  }
  if (props.kind === "regression")
    return (
      <svg
        className="geometry-view plot"
        viewBox="0 0 640 410"
        role="img"
        aria-label="Synthetic training observations, fitted line, and vertical residual lines."
      >
        <path d="M60 30V340H590" className="plot-axis" />
        {[-2, -1, 0, 1, 2].map((x) => (
          <g key={x}>
            <line
              x1={320 + x * 100}
              x2={320 + x * 100}
              y1="30"
              y2="340"
              className="plot-grid"
            />
            <text x={320 + x * 100} y="365">
              {x}
            </text>
          </g>
        ))}
        {[-2, 0, 2, 4, 6].map((y) => (
          <g key={y}>
            <text x="20" y={260 - y * 32}>
              {y}
            </text>
            <line
              x1="60"
              x2="590"
              y1={260 - y * 32}
              y2={260 - y * 32}
              className="plot-grid"
            />
          </g>
        ))}
        <line
          x1="70"
          x2="570"
          y1={260 - (-2.5 * props.slope + props.intercept) * 32}
          y2={260 - (2.5 * props.slope + props.intercept) * 32}
          stroke="#c3ec97"
          strokeWidth="3"
        />
        {TRAIN.map(([x, y]) => (
          <g key={x}>
            <line
              x1={320 + x * 100}
              x2={320 + x * 100}
              y1={260 - y * 32}
              y2={260 - (x * props.slope + props.intercept) * 32}
              stroke="#d2b9f2"
              strokeDasharray="4 3"
              strokeWidth="2"
            />
            <circle cx={320 + x * 100} cy={260 - y * 32} r="7" fill="#84d8ce" />
          </g>
        ))}
        <text x="300" y="395">
          Input x (unitless)
        </text>
        <text x="65" y="20">
          Output y (unitless)
        </text>
      </svg>
    );
  return null;
}
export function CurveView({
  x,
  h,
  n,
  rule,
}: {
  x: number;
  h: number;
  n: number;
  rule: "left" | "right" | "midpoint" | "trapezoid";
}) {
  const px = (x: number) => 70 + x * 120,
    py = (y: number) => 340 - y * 55;
  return (
    <svg
      className="geometry-view plot"
      viewBox="0 0 640 410"
      role="img"
      aria-label="Graph of x squared, tangent, secant, and integral approximation from 0 to 2."
    >
      <path d="M70 30V340H590" className="plot-axis" />
      {Array.from({ length: n }, (_, i) => {
        const a = (2 * i) / n,
          b = (2 * (i + 1)) / n;
        const ya = curve(
            rule === "left"
              ? a
              : rule === "right"
                ? b
                : rule === "midpoint"
                  ? (a + b) / 2
                  : a,
          ),
          yb = rule === "trapezoid" ? curve(b) : ya;
        return (
          <polygon
            key={i}
            points={`${px(a)},340 ${px(a)},${py(ya)} ${px(b)},${py(yb)} ${px(b)},340`}
            fill="#81cbb4"
            fillOpacity=".16"
            stroke="#81cbb4"
            strokeOpacity=".45"
          />
        );
      })}
      <polyline
        points={Array.from({ length: 81 }, (_, i) => {
          const t = i / 30;
          return `${px(t)},${py(curve(t))}`;
        }).join(" ")}
        fill="none"
        stroke="#c3ec97"
        strokeWidth="3"
      />
      <line
        x1={px(x - 0.5)}
        y1={py(curve(x) - x)}
        x2={px(x + 0.5)}
        y2={py(curve(x) + x)}
        stroke="#cbb5eb"
        strokeWidth="2"
      />
      <line
        x1={px(x)}
        y1={py(curve(x))}
        x2={px(x + h)}
        y2={py(curve(x + h))}
        stroke="#80d8cd"
        strokeWidth="3"
      />
      <circle cx={px(x)} cy={py(curve(x))} r="6" fill="#c3ec97" />
      {[0, 1, 2, 3, 4].map((v) => (
        <text key={v} x="35" y={py(v) + 4}>
          {v}
        </text>
      ))}
      {[0, 1, 2, 3, 4].map((v) => (
        <text key={v} x={px(v)} y="367">
          {v}
        </text>
      ))}
      <text x="580" y="340">
        x
      </text>
      <text x="70" y="22">
        f(x) = x²
      </text>
      <text x="280" y="395">
        All variables unitless
      </text>
    </svg>
  );
}
