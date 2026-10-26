import { design, type Observation } from "./data";
export interface Preprocessing {
  means: number[];
  scales: number[];
  targetMean: number;
  targetScale: number;
}
export interface Model {
  weights: number[];
  prep: Preprocessing;
  classification: boolean;
  leak: boolean;
  lambda: number;
  iterations: number;
  losses: number[];
  status: "ready" | "unstable";
}
export function prepare(
  rows: Observation[],
  classification = false,
  leak = false,
): Model {
  if (!rows.length) throw Error("Training data is empty.");
  const x = rows.map((r) => design(r, leak)),
    p = x[0].length;
  const means = Array.from(
    { length: p },
    (_, i) => x.reduce((s, v) => s + v[i], 0) / x.length,
  );
  const scales = means.map(
    (mean, i) =>
      Math.sqrt(x.reduce((s, v) => s + (v[i] - mean) ** 2, 0) / x.length) || 1,
  );
  const targetMean = classification
    ? 0
    : rows.reduce((s, r) => s + r.y, 0) / rows.length;
  const targetScale = classification
    ? 1
    : Math.sqrt(
        rows.reduce((s, r) => s + (r.y - targetMean) ** 2, 0) / rows.length,
      ) || 1;
  return {
    weights: Array(p + 1).fill(0),
    prep: { means, scales, targetMean, targetScale },
    classification,
    leak,
    lambda: 0,
    iterations: 0,
    losses: [],
    status: "ready",
  };
}
export const sigmoid = (z: number) =>
  z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
export function encoded(model: Model, row: Observation) {
  return [
    1,
    ...design(row, model.leak).map(
      (v, i) => (v - model.prep.means[i]) / model.prep.scales[i],
    ),
  ];
}
export function rawScore(model: Model, row: Observation) {
  return encoded(model, row).reduce((s, v, i) => s + v * model.weights[i], 0);
}
export function predict(model: Model, row: Observation) {
  const z = rawScore(model, row);
  return model.classification
    ? sigmoid(z)
    : z * model.prep.targetScale + model.prep.targetMean;
}
export function objective(model: Model, rows: Observation[]) {
  const loss =
    rows.reduce((s, r) => {
      const z = rawScore(model, r);
      return (
        s +
        (model.classification
          ? Math.max(z, 0) - z * r.y + Math.log1p(Math.exp(-Math.abs(z)))
          : 0.5 *
            (z - (r.y - model.prep.targetMean) / model.prep.targetScale) ** 2)
      );
    }, 0) / rows.length;
  return (
    loss +
    0.5 * model.lambda * model.weights.slice(1).reduce((s, w) => s + w * w, 0)
  );
}
export function gradient(model: Model, rows: Observation[]) {
  const g = Array(model.weights.length).fill(0) as number[];
  rows.forEach((r) => {
    const x = encoded(model, r),
      z = rawScore(model, r),
      residual = model.classification
        ? sigmoid(z) - r.y
        : z - (r.y - model.prep.targetMean) / model.prep.targetScale;
    x.forEach((v, i) => (g[i] += (v * residual) / rows.length));
  });
  return g.map((v, i) => v + (i ? model.lambda * model.weights[i] : 0));
}
export function trainSteps(
  model: Model,
  rows: Observation[],
  steps: number,
  rate = 0.1,
  lambda = 0,
): Model {
  if (
    !Number.isInteger(steps) ||
    steps < 1 ||
    steps > 1000 ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    rate > 1 ||
    !Number.isFinite(lambda) ||
    lambda < 0 ||
    lambda > 10
  )
    throw Error("Training controls are outside the supported range.");
  let next = {
    ...model,
    weights: [...model.weights],
    losses: [...model.losses],
    lambda,
  };
  for (let k = 0; k < steps; k++) {
    const g = gradient(next, rows),
      weights = next.weights.map((w, i) => w - rate * g[i]);
    if (weights.some((w) => !Number.isFinite(w) || Math.abs(w) > 1e5))
      return { ...next, status: "unstable" };
    next = { ...next, weights, iterations: next.iterations + 1 };
    const loss = objective(next, rows);
    if (!Number.isFinite(loss)) return { ...next, status: "unstable" };
    next.losses = [...next.losses.slice(-199), loss];
  }
  return next;
}
export function fit(
  rows: Observation[],
  classification = false,
  leak = false,
  lambda = 0,
) {
  return trainSteps(
    prepare(rows, classification, leak),
    rows,
    600,
    0.15,
    lambda,
  );
}
export function originalCoefficients(model: Model) {
  if (model.classification) return null;
  const slopes = model.weights
    .slice(1)
    .map((w, i) => (w * model.prep.targetScale) / model.prep.scales[i]);
  return {
    intercept:
      model.prep.targetMean +
      model.weights[0] * model.prep.targetScale -
      slopes.reduce((s, w, i) => s + w * model.prep.means[i], 0),
    slopes,
  };
}
export interface Stump {
  feature: number;
  cut: number;
  left: number;
  right: number;
}
export function fitStump(rows: Observation[], classification = false): Stump {
  if (!rows.length) throw Error("Training data is empty.");
  let best: Stump = { feature: 0, cut: 0, left: 0, right: 0 },
    bestLoss = Infinity;
  for (let feature = 0; feature < rows[0].x.length; feature++)
    for (let j = 1; j < 10; j++) {
      const values = rows.map((r) => r.x[feature]).sort((a, b) => a - b),
        cut = values[Math.floor((j * values.length) / 10)];
      const left = rows.filter((r) => r.x[feature] <= cut),
        right = rows.filter((r) => r.x[feature] > cut);
      if (!left.length || !right.length) continue;
      const mean = (x: Observation[]) =>
          x.reduce((s, r) => s + r.y, 0) / x.length,
        l = mean(left),
        r = mean(right);
      const loss = [
        ...left.map((v) => (v.y - l) ** 2),
        ...right.map((v) => (v.y - r) ** 2),
      ].reduce((a, b) => a + b, 0);
      if (loss < bestLoss) {
        bestLoss = loss;
        best = {
          feature,
          cut,
          left: classification ? Math.max(0.001, Math.min(0.999, l)) : l,
          right: classification ? Math.max(0.001, Math.min(0.999, r)) : r,
        };
      }
    }
  return best;
}
export const predictStump = (s: Stump, r: Observation) =>
  r.x[s.feature] <= s.cut ? s.left : s.right;
