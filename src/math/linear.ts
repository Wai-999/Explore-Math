export type Vec3 = [number, number, number];
/** Row-major storage; column vectors; right-handed XYZ; AB applies B first. */
export type Mat3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const dot = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + x * b[i], 0);
export const norm = (a: number[]) => Math.hypot(...a);
export const add = (a: Vec3, b: Vec3): Vec3 =>
  a.map((v, i) => v + b[i]) as Vec3;
export const scale = (a: Vec3, s: number): Vec3 => a.map((v) => v * s) as Vec3;
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function transform(m: Mat3, v: Vec3): Vec3 {
  return [dot(m.slice(0, 3), v), dot(m.slice(3, 6), v), dot(m.slice(6, 9), v)];
}
export function multiply(a: Mat3, b: Mat3): Mat3 {
  return Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3),
      col = i % 3;
    return (
      a[row * 3] * b[col] +
      a[row * 3 + 1] * b[3 + col] +
      a[row * 3 + 2] * b[6 + col]
    );
  }) as Mat3;
}
export function determinant(m: Mat3) {
  const [a, b, c, d, e, f, g, h, i] = m;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}
export function inverse(m: Mat3): Mat3 | null {
  const det = determinant(m);
  const magnitude = Math.max(...m.map(Math.abs));
  if (
    !Number.isFinite(det) ||
    magnitude === 0 ||
    Math.abs(det) < 1e-8 * magnitude ** 3
  )
    return null;
  const [a, b, c, d, e, f, g, h, i] = m;
  return [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ].map((x) => x / det) as Mat3;
}
export function rotation(axis: "x" | "y" | "z", degrees: number): Mat3 {
  const t = (degrees * Math.PI) / 180,
    c = Math.cos(t),
    s = Math.sin(t);
  if (axis === "x") return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === "y") return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
export function rank(m: Mat3) {
  const a = [m.slice(0, 3), m.slice(3, 6), m.slice(6, 9)];
  let r = 0;
  for (let c = 0; c < 3; c++) {
    let pivot = r;
    for (let j = r + 1; j < 3; j++)
      if (Math.abs(a[j][c]) > Math.abs(a[pivot][c])) pivot = j;
    if (Math.abs(a[pivot][c]) <= 1e-8 * Math.max(...m.map(Math.abs))) continue;
    [a[r], a[pivot]] = [a[pivot], a[r]];
    for (let j = r + 1; j < 3; j++) {
      const f = a[j][c] / a[r][c];
      for (let k = c; k < 3; k++) a[j][k] -= f * a[r][k];
    }
    r++;
    if (r === 3) break;
  }
  return r;
}
export function projection(a: Vec3, onto: Vec3): Vec3 | null {
  const d = dot(onto, onto);
  return d < 1e-12 ? null : scale(onto, dot(a, onto) / d);
}
export function gramSchmidt(a: Vec3, b: Vec3): [Vec3, Vec3] | null {
  if (norm(a) < 1e-8) return null;
  const p = projection(b, a);
  if (!p) return null;
  const residual = add(b, scale(p, -1));
  if (norm(residual) < 1e-8) return null;
  return [scale(a, 1 / norm(a)), scale(residual, 1 / norm(residual))];
}
/** Real eigenpairs for a 2×2 block; explicitly returns complex/degenerate status. */
export function eigen2(a: number, b: number, c: number, d: number) {
  const disc = (a - d) ** 2 + 4 * b * c;
  if (disc < -1e-10) return { status: "complex" as const, pairs: [] };
  const values = [
    (a + d + Math.sqrt(Math.max(0, disc))) / 2,
    (a + d - Math.sqrt(Math.max(0, disc))) / 2,
  ];
  const pairs = values.map((value) => {
    let v: Vec3 =
      Math.abs(b) > 1e-8
        ? [b, value - a, 0]
        : Math.abs(c) > 1e-8
          ? [value - d, c, 0]
          : Math.abs(value - a) < 1e-8
            ? [1, 0, 0]
            : [0, 1, 0];
    v = scale(v, 1 / norm(v));
    return { value, vector: v };
  });
  return { status: "real" as const, pairs };
}
export function linearModel(m: Mat3) {
  const det = determinant(m),
    inv = inverse(m),
    r = rank(m);
  const columns = [0, 1, 2].map((c) => [m[c], m[c + 3], m[c + 6]] as Vec3);
  return {
    matrix: m,
    det,
    rank: r,
    columns,
    point: transform(m, [1, 1, 1]),
    inverse: inv,
    conditionBound: inv ? norm(m) * norm(inv) : Infinity,
    orientation: det === 0 ? "Collapsed" : det < 0 ? "Reversed" : "Preserved",
    eigen:
      Math.abs(m[6]) + Math.abs(m[7]) + Math.abs(m[2]) + Math.abs(m[5]) < 1e-8
        ? eigen2(m[0], m[1], m[3], m[4])
        : null,
    projection: projection(columns[1], columns[0]),
    dot: dot(columns[0], columns[1]),
    cross: cross(columns[0], columns[1]),
    orthonormal: gramSchmidt(columns[0], columns[1]),
  };
}
export function boundedNumber(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
export function validMatrix(value: unknown): value is Mat3 {
  return (
    Array.isArray(value) &&
    value.length === 9 &&
    value.every((v) => boundedNumber(v, -3, 3))
  );
}
export const fmt = (n: number, digits = 3) =>
  Number.isFinite(n) ? Number(n.toFixed(digits)).toString() : "undefined";
export const tuple = (v: number[]) => `(${v.map((x) => fmt(x)).join(", ")})`;
