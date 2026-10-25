import { multiply, rotation, transform } from "./linear";
export function robot(
  yaw: number,
  tilt: number,
  order: "yaw-first" | "tilt-first",
) {
  const y = rotation("z", yaw),
    t = rotation("x", tilt);
  const matrix = order === "yaw-first" ? multiply(t, y) : multiply(y, t);
  return { matrix, direction: transform(matrix, [1, 0, 0]) };
}
export function business(q: number, demand = 120) {
  const price = demand - 0.8 * q,
    revenue = price * q,
    cost = 100 + 20 * q;
  const optimum = Math.max(0, Math.min(100, (demand - 20) / 1.6));
  return {
    q,
    price,
    revenue,
    cost,
    profit: revenue - cost,
    marginal: demand - 20 - 1.6 * q,
    optimum,
  };
}
export const TRAIN: [[number, number], ...[number, number][]] = [
  [-2, -2.4],
  [-1, -1],
  [0, 1.2],
  [1, 2.6],
  [2, 4.6],
];
export const TEST: [number, number][] = [
  [-1.5, -1.6],
  [0.5, 2.1],
  [1.5, 3.8],
];
export function mse(
  data: [number, number][],
  slope: number,
  intercept: number,
) {
  return (
    data.reduce((s, [x, y]) => s + (slope * x + intercept - y) ** 2, 0) /
    data.length
  );
}
export function leastSquares(data: [number, number][]) {
  const n = data.length,
    mx = data.reduce((s, p) => s + p[0], 0) / n,
    my = data.reduce((s, p) => s + p[1], 0) / n;
  const den = data.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  if (den < 1e-12) return null;
  const slope = data.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / den;
  return { slope, intercept: my - slope * mx };
}
export function regression(slope: number, intercept: number) {
  const fit = leastSquares(TRAIN)!;
  return {
    slope,
    intercept,
    train: mse(TRAIN, slope, intercept),
    test: mse(TEST, slope, intercept),
    fit,
    residuals: TRAIN.map(([x, y]) => ({
      x,
      y,
      predicted: slope * x + intercept,
      residual: y - slope * x - intercept,
    })),
  };
}
