export function regressionMetrics(actual: number[], predicted: number[]) {
  if (
    !actual.length ||
    actual.length !== predicted.length ||
    [...actual, ...predicted].some((x) => !Number.isFinite(x))
  )
    throw Error("Finite paired predictions are required.");
  const errors = actual.map((y, i) => predicted[i] - y),
    mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ss = actual.reduce((s, y) => s + (y - mean) ** 2, 0),
    sse = errors.reduce((s, e) => s + e * e, 0);
  return {
    mae: errors.reduce((s, e) => s + Math.abs(e), 0) / actual.length,
    rmse: Math.sqrt(sse / actual.length),
    bias: errors.reduce((a, b) => a + b, 0) / actual.length,
    r2: ss > 0 ? 1 - sse / ss : null,
  };
}
export function classificationMetrics(
  actual: number[],
  probability: number[],
  threshold = 0.5,
  missCost = 10,
  falseAlarmCost = 1,
) {
  if (
    !actual.length ||
    actual.length !== probability.length ||
    actual.some((y) => y !== 0 && y !== 1) ||
    probability.some((p) => !Number.isFinite(p) || p < 0 || p > 1) ||
    threshold < 0 ||
    threshold > 1
  )
    throw Error("Binary labels and valid probabilities are required.");
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0;
  actual.forEach((y, i) => {
    if (probability[i] >= threshold) {
      if (y) tp++;
      else fp++;
    } else if (y) fn++;
    else tn++;
  });
  const positives = tp + fn,
    negatives = tn + fp;
  const sorted = actual
    .map((y, i) => ({ y, p: probability[i] }))
    .sort((a, b) => b.p - a.p);
  let cumTP = 0,
    cumFP = 0,
    ap = 0,
    lastRecall = 0;
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j < sorted.length && sorted[j].p === sorted[i].p) {
      if (sorted[j].y) cumTP++;
      else cumFP++;
      j++;
    }
    const recall = positives ? cumTP / positives : 0;
    ap += ((recall - lastRecall) * cumTP) / (cumTP + cumFP);
    lastRecall = recall;
    i = j;
  }
  let favorable = 0;
  for (const positive of sorted.filter((r) => r.y))
    for (const negative of sorted.filter((r) => !r.y))
      favorable +=
        positive.p > negative.p ? 1 : positive.p === negative.p ? 0.5 : 0;
  const bins = Array.from({ length: 5 }, (_, i) => {
    const ids = probability
      .map((p, j) => ({ p, j }))
      .filter(({ p }) => Math.min(4, Math.floor(p * 5)) === i);
    return {
      low: i / 5,
      n: ids.length,
      mean: ids.length ? ids.reduce((s, v) => s + v.p, 0) / ids.length : null,
      observed: ids.length
        ? ids.reduce((s, v) => s + actual[v.j], 0) / ids.length
        : null,
    };
  });
  return {
    tp,
    tn,
    fp,
    fn,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: positives ? tp / positives : null,
    specificity: negatives ? tn / negatives : null,
    accuracy: (tp + tn) / actual.length,
    brier:
      actual.reduce((s, y, i) => s + (probability[i] - y) ** 2, 0) /
      actual.length,
    logLoss:
      -actual.reduce((s, y, i) => {
        const p = Math.max(1e-12, Math.min(1 - 1e-12, probability[i]));
        return s + y * Math.log(p) + (1 - y) * Math.log(1 - p);
      }, 0) / actual.length,
    averagePrecision: positives ? ap : null,
    auc: positives && negatives ? favorable / (positives * negatives) : null,
    cost: fn * missCost + fp * falseAlarmCost,
    reviewCount: tp + fp,
    bins,
  };
}
/** Empirical validation residual interval; descriptive, not a coverage guarantee. */
export function residualRadius(
  actual: number[],
  predicted: number[],
  coverage = 0.9,
) {
  if (
    !actual.length ||
    actual.length !== predicted.length ||
    coverage <= 0 ||
    coverage >= 1
  )
    throw Error(
      "A nonempty residual sample and coverage in (0,1) are required.",
    );
  const e = actual
    .map((v, i) => Math.abs(v - predicted[i]))
    .sort((a, b) => a - b);
  return e[Math.min(e.length - 1, Math.ceil(e.length * coverage) - 1)];
}
