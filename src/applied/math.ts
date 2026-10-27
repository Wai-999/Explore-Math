import { rules, validParams } from "./schema";
import {
  f,
  type Definition,
  type Geometry,
  type Matrix2,
  type Pair,
  type Params,
} from "./types";
import type { Vec3 } from "../math/linear";
export const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x));
export const dot2 = (a: Pair, b: Pair) => a[0] * b[0] + a[1] * b[1];
export const finiteDifference = (
  fn: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 1e-4,
): Pair => [
  (fn(x + h, y) - fn(x - h, y)) / (2 * h),
  (fn(x, y + h) - fn(x, y - h)) / (2 * h),
];
export function clip(poly: Pair[], a: number, b: number, c: number): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      u = a * p[0] + b * p[1] - c,
      v = a * q[0] + b * q[1] - c;
    if (u <= 1e-9) out.push(p);
    if ((u < 0 && v > 0) || (u > 0 && v < 0)) {
      const t = u / (u - v);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}
export function inside(poly: Pair[], p: Pair) {
  return (
    poly.length >= 3 &&
    Math.abs(
      poly.reduce((s, a, i) => {
        const b = poly[(i + 1) % poly.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
    ) > 1e-8 &&
    poly.every((a, i) => {
      const b = poly[(i + 1) % poly.length];
      return (
        (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-7
      );
    })
  );
}
/** Exact edge quadratics + interior stationary candidates; no general nonlinear optimizer claim. */
export function quadraticMaximum(
  poly: Pair[],
  fn: (x: number, y: number) => number,
  g: (x: number, y: number) => Pair,
  h: Matrix2,
) {
  const candidates: Pair[] = [...poly];
  if (!poly.length) throw Error("Empty feasible region");
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      d: Pair = [b[0] - a[0], b[1] - a[1]],
      curv = dot2(d, [dot2(h[0], d), dot2(h[1], d)]);
    if (Math.abs(curv) > 1e-12) {
      const t = -dot2(g(...a), d) / curv;
      if (t > 0 && t < 1) candidates.push([a[0] + t * d[0], a[1] + t * d[1]]);
    }
  }
  const c: Pair = [
      poly.reduce((s, p) => s + p[0], 0) / poly.length,
      poly.reduce((s, p) => s + p[1], 0) / poly.length,
    ],
    v = g(...c),
    det = h[0][0] * h[1][1] - h[0][1] * h[1][0];
  if (Math.abs(det) > 1e-12) {
    const p: Pair = [
      c[0] - (h[1][1] * v[0] - h[0][1] * v[1]) / det,
      c[1] - (-h[1][0] * v[0] + h[0][0] * v[1]) / det,
    ];
    if (inside(poly, p)) candidates.push(p);
  }
  const best = candidates.reduce((a, b) => (fn(...b) > fn(...a) ? b : a));
  return { point: best, value: fn(...best), candidates };
}
export function surfaceGeometry(d: Definition, p: Params): Geometry {
  if (!validParams(d.id, p)) throw Error("Invalid finite model inputs");
  if (d.geometry) return d.geometry(p);
  const [xr, yr] = rules[d.id],
    size = 25,
    raw: number[] = [];
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++)
      raw.push(
        d.scalar(
          p,
          xr.min + ((xr.max - xr.min) * i) / (size - 1),
          yr.min + ((yr.max - yr.min) * j) / (size - 1),
        ),
      );
  if (!raw.every(Number.isFinite))
    throw Error("Surface has a nonfinite output");
  const min = Math.min(...raw),
    max = Math.max(...raw),
    span = Math.max(1e-8, max - min);
  const to = (x: number, y: number, z: number): Vec3 => [
    (5 * (x - xr.min)) / (xr.max - xr.min) - 2.5,
    (5 * (y - yr.min)) / (yr.max - yr.min) - 2.5,
    (2.2 * (z - min)) / span,
  ];
  const points: Vec3[] = [],
    valid: boolean[] = [];
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = xr.min + ((xr.max - xr.min) * i) / (size - 1),
        y = yr.min + ((yr.max - yr.min) * j) / (size - 1);
      points.push(to(x, y, raw[j * size + i]));
      valid.push(d.feasible?.({ ...p, x, y }) ?? true);
    }
  const m = d.analyze(p),
    marker = to(p.x, p.y, m.value),
    lines = d.lines?.(p, to) || [];
  let gradient: Geometry["gradient"];
  if (m.gradient) {
    const [gx, gy] = m.gradient,
      n = Math.hypot(gx, gy);
    if (n > 1e-9) {
      const x = p.x + (0.06 * (xr.max - xr.min) * gx) / n,
        y = p.y + (0.06 * (yr.max - yr.min) * gy) / n;
      if (x >= xr.min && x <= xr.max && y >= yr.min && y <= yr.max)
        gradient = [marker, to(x, y, d.scalar(p, x, y))];
    }
  }
  return {
    points,
    size,
    valid,
    marker,
    gradient,
    lines,
    spheres: [],
    labels: [xr.label, yr.label, d.output],
    range: [min, max],
    draggable: true,
  };
}
export function unproject(d: Definition, x: number, y: number): Pair {
  const [a, b] = rules[d.id];
  return [
    a.min + ((x + 2.5) * (a.max - a.min)) / 5,
    b.min + ((y + 2.5) * (b.max - b.min)) / 5,
  ];
}
export const evidenceKey = (d: Definition, seed: number, level: number) =>
  d.id + ":" + level + ":" + JSON.stringify(d.mission(seed, level).params);
export function csv(p: Params, metrics: [string, string][]): string {
  const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
  return [
    ["field", "value"],
    ...Object.entries(p).map(([k, v]) => [k, f(v, 8)]),
    ...metrics,
  ]
    .map((row) => row.map(quote).join(","))
    .join("\n");
}
export function gradeMission(
  d: Definition,
  p: Params,
  seed: number,
  level: number,
  rule: string,
) {
  if (!validParams(d.id, p))
    return {
      correct: false,
      feedback: "Invalid, nonfinite or out-of-domain input cannot pass.",
    };
  const mission = d.mission(seed, level),
    editable = [
      "x",
      "y",
      ...(d.id === "ml" ? ["alpha"] : []),
      ...(d.id === "gis" ? ["route"] : []),
    ];
  if (
    Object.keys(mission.params).some(
      (k) => !editable.includes(k) && p[k] !== mission.params[k],
    )
  )
    return {
      correct: false,
      feedback:
        "Mission assumptions differ from the frozen scenario. Load its seeded case again.",
    };
  const result = mission.grade(p);
  return {
    ...result,
    correct: result.correct && rule === mission.correctRule,
    feedback:
      rule !== mission.correctRule
        ? "Check the principle as well as the numeric decision. " +
          result.feedback
        : result.feedback,
  };
}
