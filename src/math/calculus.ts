export type SurfaceKind = "bowl" | "valleys";
export type Point2 = [number, number];
export function energy(kind: SurfaceKind, [x, y]: Point2) {
  return kind === "bowl"
    ? (x * x + 2 * y * y) / 2
    : (x * x - 1) ** 2 / 4 + (y * y) / 2;
}
export function gradient(kind: SurfaceKind, [x, y]: Point2): Point2 {
  return kind === "bowl" ? [x, 2 * y] : [x * (x * x - 1), y];
}
export function numericalGradient(
  kind: SurfaceKind,
  p: Point2,
  h = 0.001,
): Point2 {
  return [0, 1].map((i) => {
    const a = [...p] as Point2,
      b = [...p] as Point2;
    a[i] += h;
    b[i] -= h;
    return (energy(kind, a) - energy(kind, b)) / (2 * h);
  }) as Point2;
}
export function tangentHeight(kind: SurfaceKind, p: Point2, q: Point2) {
  const g = gradient(kind, p);
  return energy(kind, p) + g[0] * (q[0] - p[0]) + g[1] * (q[1] - p[1]);
}
export function descent(
  kind: SurfaceKind,
  p: Point2,
  step: number,
): { point: Point2; status: "ok" | "boundary"; before: number; after: number } {
  const g = gradient(kind, p),
    next: Point2 = [p[0] - step * g[0], p[1] - step * g[1]];
  if (next.some((n) => !Number.isFinite(n) || Math.abs(n) > 2.5))
    return {
      point: p,
      status: "boundary",
      before: energy(kind, p),
      after: energy(kind, p),
    };
  return {
    point: next,
    status: "ok",
    before: energy(kind, p),
    after: energy(kind, next),
  };
}
export const curve = (x: number) => x * x;
export const derivative = (x: number) => 2 * x;
export function secant(x: number, h: number) {
  return (curve(x + h) - curve(x)) / h;
}
export type Rule = "left" | "right" | "midpoint" | "trapezoid";
export function integrate(a: number, b: number, n: number, rule: Rule) {
  if (
    !Number.isInteger(n) ||
    n < 1 ||
    n > 1000 ||
    ![a, b].every(Number.isFinite)
  )
    throw Error("Use 1–1000 finite intervals.");
  const dx = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = a + i * dx;
    sum +=
      (rule === "left"
        ? curve(x)
        : rule === "right"
          ? curve(x + dx)
          : rule === "midpoint"
            ? curve(x + dx / 2)
            : (curve(x) + curve(x + dx)) / 2) * dx;
  }
  return sum;
}
export function calculusModel(kind: SurfaceKind, p: Point2) {
  const g = gradient(kind, p),
    numeric = numericalGradient(kind, p);
  return {
    kind,
    point: p,
    value: energy(kind, p),
    gradient: g,
    numeric,
    error: Math.hypot(g[0] - numeric[0], g[1] - numeric[1]),
  };
}
