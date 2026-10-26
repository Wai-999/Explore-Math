import { partition, type Dataset, type ProjectId } from "./data";
import { fitStump, type Stump } from "./model";
import { validSession, type StudioSession } from "./session";
import { classificationMetrics, regressionMetrics } from "./metrics";

export const featureKeys: Record<ProjectId, string[]> = {
  energy: ["temperature", "planned_production"],
  maintenance: ["vibration", "heat"],
  demand: ["previous_week", "calendar_season", "approved_promotion"],
};
export interface FrozenArtifact {
  schemaVersion: 1;
  softwareVersion: string;
  dataVersion: "synthetic-v1";
  project: ProjectId;
  seed: number;
  units: string;
  clock: "elapsed hours";
  horizonHours: number;
  threshold: number;
  features: { key: string; label: string; min: number; max: number }[];
  predictor:
    | {
        kind: "linear" | "logistic";
        weights: number[];
        means: number[];
        scales: number[];
        targetMean: number;
        targetScale: number;
      }
    | ({ kind: "stump" } & Stump);
}
export interface BatchRow {
  id: string;
  predictionTime: number;
  features: Record<string, { value: number; availableAt: number }>;
}
export interface ScoredRow {
  id: string;
  predictionTime: number;
  prediction: number;
  alert: boolean | null;
  outsideTrainingRange: string[];
}
export interface ScoredBatch {
  artifact: FrozenArtifact;
  rows: ScoredRow[];
}
export interface DelayedLabel {
  id: string;
  actual: number;
  availableAt: number;
}
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const finite = (x: unknown, min = -1e9, max = 1e9): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
function fail(message: string): never {
  throw Error(message);
}
const identifier = (x: unknown): x is string =>
  typeof x === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(x);

export function readArtifact(value: unknown): FrozenArtifact {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !["energy", "maintenance", "demand"].includes(String(value.project))
  )
    fail("Unsupported model artifact or project.");
  const a = value as unknown as FrozenArtifact;
  const keys = featureKeys[a.project];
  if (
    typeof a.softwareVersion !== "string" ||
    !a.softwareVersion.length ||
    a.softwareVersion.length > 80 ||
    a.dataVersion !== "synthetic-v1" ||
    !Number.isSafeInteger(a.seed) ||
    a.seed < 0 ||
    a.clock !== "elapsed hours" ||
    !finite(a.threshold, 0, 1) ||
    a.horizonHours !==
      { energy: 24, maintenance: 48, demand: 168 }[a.project] ||
    typeof a.units !== "string" ||
    a.units.length > 150 ||
    !Array.isArray(a.features) ||
    a.features.length !== keys.length
  )
    fail("Invalid model metadata or input schema.");
  a.features.forEach((f, i) => {
    if (
      !object(f) ||
      f.key !== keys[i] ||
      typeof f.label !== "string" ||
      f.label.length > 150 ||
      !finite(f.min) ||
      !finite(f.max) ||
      f.min > f.max
    )
      fail("Invalid feature schema or training range.");
  });
  const p = a.predictor;
  if (!p || typeof p !== "object") fail("Missing fitted predictor.");
  if (p.kind === "stump") {
    if (
      !Number.isInteger(p.feature) ||
      p.feature < 0 ||
      p.feature >= keys.length ||
      ![p.cut, p.left, p.right].every((x) => finite(x)) ||
      (a.project === "maintenance" &&
        ![p.left, p.right].every((x) => finite(x, 0, 1)))
    )
      fail("Invalid fitted tree.");
  } else if (p.kind === (a.project === "maintenance" ? "logistic" : "linear")) {
    if (
      !Array.isArray(p.weights) ||
      p.weights.length !== keys.length + 1 ||
      !p.weights.every((x) => finite(x, -1e5, 1e5)) ||
      !Array.isArray(p.means) ||
      p.means.length !== keys.length ||
      !p.means.every((x) => finite(x)) ||
      !Array.isArray(p.scales) ||
      p.scales.length !== keys.length ||
      !p.scales.every((x) => finite(x, 1e-12)) ||
      !finite(p.targetMean) ||
      !finite(p.targetScale, 1e-12) ||
      (p.kind === "logistic" && (p.targetMean !== 0 || p.targetScale !== 1))
    )
      fail("Invalid fitted scaling or coefficients.");
  } else fail("Unsupported predictor for this project.");
  return structuredClone(a);
}

export function exportArtifact(
  data: Dataset,
  session: StudioSession,
): FrozenArtifact {
  if (
    !validSession(session) ||
    !session.tested ||
    !session.frozen ||
    !session.model ||
    session.leak ||
    session.model.classification !== data.classification ||
    session.seed !== data.seed
  )
    fail("Finish the frozen evaluation before exporting this fitted model.");
  const train = partition(data, "train"),
    m = session.model;
  const a: FrozenArtifact = {
    schemaVersion: 1,
    softwareVersion: "0.2.0-rc.2",
    dataVersion: "synthetic-v1",
    project: data.project,
    seed: data.seed,
    units: data.units,
    clock: "elapsed hours",
    horizonHours: { energy: 24, maintenance: 48, demand: 168 }[data.project],
    threshold: session.threshold,
    features: featureKeys[data.project].map((key, i) => ({
      key,
      label: data.features[i],
      min: Math.min(...train.map((r) => r.x[i])),
      max: Math.max(...train.map((r) => r.x[i])),
    })),
    predictor:
      session.method === "stump"
        ? { kind: "stump", ...fitStump(train, data.classification) }
        : {
            kind: data.classification ? "logistic" : "linear",
            weights: [...m.weights],
            means: [...m.prep.means],
            scales: [...m.prep.scales],
            targetMean: m.prep.targetMean,
            targetScale: m.prep.targetScale,
          },
  };
  return readArtifact(a);
}

export function exampleBatch(a: FrozenArtifact): BatchRow[] {
  return [0.4, 0.6].map((fraction, i) => ({
    id: `batch-${i + 1}`,
    predictionTime: 0,
    features: Object.fromEntries(
      a.features.map((f) => [
        f.key,
        {
          value:
            f.key === "approved_promotion"
              ? i
              : f.min + fraction * (f.max - f.min),
          availableAt: 0,
        },
      ]),
    ),
  }));
}

export function scoreBatch(
  artifact: FrozenArtifact,
  input: unknown,
): ScoredBatch {
  const a = readArtifact(artifact),
    classification = a.project === "maintenance";
  if (!Array.isArray(input) || input.length < 1 || input.length > 250)
    fail("Provide 1–250 batch rows.");
  const seen = new Set<string>();
  const rows = input.map((r): ScoredRow => {
    if (
      !object(r) ||
      !identifier(r.id) ||
      seen.has(r.id) ||
      !finite(r.predictionTime) ||
      !object(r.features)
    )
      fail("Each row needs a unique ID, finite predictionTime, and features.");
    seen.add(r.id);
    const features = r.features,
      predictionTime = r.predictionTime;
    if (
      Object.keys(features).length !== a.features.length ||
      Object.keys(features).some(
        (key) => !a.features.some((f) => f.key === key),
      )
    )
      fail(
        `${r.id}: use exactly the declared features; do not include the target.`,
      );
    const x = a.features.map((f) => {
      const v = features[f.key];
      if (!object(v) || !finite(v.value) || !finite(v.availableAt))
        fail(`${r.id}: ${f.key} needs a finite value and availableAt.`);
      if (v.availableAt > predictionTime)
        fail(`${r.id}: ${f.key} arrives after the prediction cutoff.`);
      if (f.key === "approved_promotion" && v.value !== 0 && v.value !== 1)
        fail("approved_promotion must be 0 or 1.");
      if (f.key === "previous_week" && v.value < 0)
        fail("previous_week cannot be negative.");
      if (f.key === "calendar_season" && (v.value < -1 || v.value > 1))
        fail("calendar_season must be between -1 and 1.");
      return v.value;
    });
    const p = a.predictor;
    const z =
      p.kind === "stump"
        ? x[p.feature] <= p.cut
          ? p.left
          : p.right
        : p.weights[0] +
          x.reduce(
            (s, v, i) =>
              s + (p.weights[i + 1] * (v - p.means[i])) / p.scales[i],
            0,
          );
    const prediction =
      p.kind === "stump"
        ? z
        : p.kind === "logistic"
          ? z >= 0
            ? 1 / (1 + Math.exp(-z))
            : Math.exp(z) / (1 + Math.exp(z))
          : z * p.targetScale + p.targetMean;
    if (!Number.isFinite(prediction))
      fail("Prediction overflow; investigate input units and the model.");
    return {
      id: r.id,
      predictionTime: r.predictionTime,
      prediction,
      alert: classification ? prediction >= a.threshold : null,
      outsideTrainingRange: a.features
        .filter((f, i) => x[i] < f.min || x[i] > f.max)
        .map((f) => f.key),
    };
  });
  return { artifact: a, rows };
}

export function monitorBatch(
  batch: ScoredBatch,
  labels: unknown,
  asOf: number,
) {
  const a = readArtifact(batch.artifact),
    classification = a.project === "maintenance";
  if (!finite(asOf) || !Array.isArray(labels) || labels.length > 250)
    fail("Provide at most 250 labels and a finite review time.");
  if (
    !Array.isArray(batch.rows) ||
    !batch.rows.length ||
    batch.rows.length > 250
  )
    fail("Missing scored batch.");
  const predictions = new Map<string, ScoredRow>();
  batch.rows.forEach((r) => {
    if (
      !object(r) ||
      !identifier(r.id) ||
      predictions.has(r.id) ||
      !finite(r.predictionTime) ||
      !finite(
        r.prediction,
        classification ? 0 : -1e100,
        classification ? 1 : 1e100,
      ) ||
      !Array.isArray(r.outsideTrainingRange) ||
      r.outsideTrainingRange.some(
        (k) => typeof k !== "string" || !a.features.some((f) => f.key === k),
      )
    )
      fail("Invalid scored rows.");
    predictions.set(r.id, r);
  });
  const seen = new Set<string>(),
    y: number[] = [],
    p: number[] = [];
  labels.forEach((l) => {
    if (
      !object(l) ||
      !identifier(l.id) ||
      seen.has(l.id) ||
      !predictions.has(l.id) ||
      !finite(l.actual, 0) ||
      !finite(l.availableAt) ||
      (classification && l.actual !== 0 && l.actual !== 1)
    )
      fail(
        "Labels need unique matching IDs, valid outcomes, and availability times.",
      );
    seen.add(l.id);
    const r = predictions.get(l.id)!;
    if (l.availableAt < r.predictionTime + a.horizonHours)
      fail("A label cannot mature before its forecast window ends.");
    if (r.predictionTime <= asOf && l.availableAt <= asOf) {
      y.push(l.actual);
      p.push(r.prediction);
    }
  });
  const issued = batch.rows.filter((r) => r.predictionTime <= asOf);
  return {
    issued: issued.length,
    labeled: y.length,
    pending: issued.length - y.length,
    outsideTrainingRange: issued.filter(
      (r) => r.outsideTrainingRange.length > 0,
    ).length,
    metrics: !y.length
      ? null
      : classification
        ? classificationMetrics(y, p, a.threshold)
        : regressionMetrics(y, p),
  };
}
