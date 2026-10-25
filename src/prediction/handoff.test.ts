import { describe, it, expect } from "vitest";
import { makeDataset, partition, type ProjectId } from "./data";
import { fit, predict, fitStump, predictStump } from "./model";
import { freshSession, freezeSession, testSession } from "./session";
import {
  exampleBatch,
  exportArtifact,
  monitorBatch,
  readArtifact,
  scoreBatch,
} from "./handoff";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
function setup(
  id: ProjectId = "energy",
  method: "gradient" | "stump" = "gradient",
) {
  const data = makeDataset(id),
    training = partition(data, "train");
  const model = fit(training, data.classification);
  const session = testSession(
    freezeSession({
      ...freshSession(),
      model,
      method,
      hypothesis: "Known inputs should improve the development baseline.",
    }),
  );
  return { data, model, session, artifact: exportArtifact(data, session) };
}
describe("frozen-model batch handoff", () => {
  it.each(["energy", "maintenance", "demand"] as ProjectId[])(
    "%s exports training-only preprocessing and scores without refitting",
    (id) => {
      const { data, model, artifact } = setup(id);
      const validation = partition(data, "validation");
      const input = validation.slice(0, 2).map((r) => ({
        id: r.id,
        predictionTime: 0,
        features: Object.fromEntries(
          artifact.features.map((f, i) => [
            f.key,
            { value: r.x[i], availableAt: 0 },
          ]),
        ),
      }));
      const before = JSON.stringify(artifact);
      const scored = scoreBatch(artifact, input);
      scored.rows.forEach((r, i) =>
        expect(r.prediction).toBeCloseTo(predict(model, validation[i]), 12),
      );
      expect(JSON.stringify(artifact)).toBe(before);
      expect(artifact.features[0].max).toBe(
        Math.max(...partition(data, "train").map((r) => r.x[0])),
      );
    },
  );
  it.each(["energy", "maintenance", "demand"] as ProjectId[])(
    "%s exports the selected fitted tree",
    (id) => {
      const { data, artifact } = setup(id, "stump"),
        input = exampleBatch(artifact);
      const stump = fitStump(partition(data, "train"), data.classification);
      expect(scoreBatch(artifact, input).rows[0].prediction).toBe(
        predictStump(stump, {
          ...data.rows[0],
          x: artifact.features.map((f) => input[0].features[f.key].value),
        }),
      );
    },
  );
  it("refuses development models and invalid or incompatible frozen artifacts", () => {
    const { data, session, artifact } = setup();
    expect(() => exportArtifact(data, { ...session, tested: false })).toThrow(
      /evaluation/,
    );
    for (const bad of [
      null,
      { ...artifact, schemaVersion: 2 },
      { ...artifact, project: "maintenance" },
      { ...artifact, predictor: { ...artifact.predictor, scales: [0, 1] } },
      { ...artifact, features: [] },
    ])
      expect(() => readArtifact(bad)).toThrow();
  });
  it("rejects unavailable features, missing inputs, target proxies, strings, and duplicate IDs atomically", () => {
    const { artifact } = setup(),
      input = exampleBatch(artifact);
    const late = structuredClone(input);
    late[1].features.temperature.availableAt = 1;
    const missing = structuredClone(input);
    delete missing[0].features.temperature;
    const target = structuredClone(input);
    target[0].features.next_outcome = { value: 100, availableAt: 0 };
    const string = structuredClone(input);
    (string[0].features.temperature as unknown as { value: unknown }).value =
      "1";
    for (const bad of [
      [],
      null,
      late,
      missing,
      target,
      string,
      [input[0], input[0]],
    ])
      expect(() => scoreBatch(artifact, bad)).toThrow();
  });
  it("flags valid extrapolation without claiming performance deterioration", () => {
    const { artifact } = setup(),
      input = exampleBatch(artifact);
    input[0].features.temperature.value = artifact.features[0].max + 10;
    const scored = scoreBatch(artifact, input),
      report = monitorBatch(scored, [], 0);
    expect(report.outsideTrainingRange).toBe(1);
    expect(report.metrics).toBeNull();
    expect(report.pending).toBe(2);
  });
  it("waits for each label, avoids future-issued predictions, and matches hand-calculated errors", () => {
    const { artifact } = setup(),
      scored = scoreBatch(artifact, exampleBatch(artifact));
    scored.rows[1].predictionTime = 12;
    const labels = scored.rows.map((r, i) => ({
      id: r.id,
      actual: r.prediction + (i ? -8 : 4),
      availableAt: i ? 60 : 48,
    }));
    expect(monitorBatch(scored, labels, 0)).toMatchObject({
      issued: 1,
      labeled: 0,
      pending: 1,
      metrics: null,
    });
    expect(monitorBatch(scored, labels, 48)).toMatchObject({
      issued: 2,
      labeled: 1,
      pending: 1,
      metrics: { mae: 4, bias: -4 },
    });
    expect(monitorBatch(scored, labels, 60)).toMatchObject({
      labeled: 2,
      pending: 0,
      metrics: { mae: 6, bias: 2, rmse: Math.sqrt(40) },
    });
  });
  it("rejects premature, duplicated, unmatched, nonbinary, or nonfinite labels", () => {
    const { artifact } = setup("maintenance"),
      scored = scoreBatch(artifact, exampleBatch(artifact));
    const label = { id: "batch-1", actual: 1, availableAt: 72 };
    for (const bad of [
      [{ ...label, availableAt: 47 }],
      [label, label],
      [{ ...label, id: "unknown" }],
      [{ ...label, actual: 2 }],
      [{ ...label, actual: NaN }],
    ])
      expect(() => monitorBatch(scored, bad, 100)).toThrow();
    expect(() => monitorBatch(scored, [], Infinity)).toThrow();
  });
  it("validates domain constraints independently of training-range warnings", () => {
    const { artifact } = setup("demand"),
      input = exampleBatch(artifact);
    for (const [key, value] of [
      ["approved_promotion", 2],
      ["calendar_season", 2],
      ["previous_week", -1],
    ] as const) {
      const bad = structuredClone(input);
      bad[0].features[key].value = value;
      expect(() => scoreBatch(artifact, bad)).toThrow();
    }
  });
  it.each(["energy", "maintenance", "demand"] as ProjectId[])(
    "%s downloaded artifact agrees with the standalone Python scorer",
    (id) => {
      const { artifact } = setup(id),
        input = exampleBatch(artifact),
        expected = scoreBatch(artifact, input);
      const dir = mkdtempSync(join(tmpdir(), "prediction-handoff-"));
      try {
        writeFileSync(join(dir, "model.json"), JSON.stringify(artifact));
        writeFileSync(join(dir, "batch.json"), JSON.stringify(input));
        execFileSync("python3", [
          "public/workshops/serve.py",
          "score",
          join(dir, "model.json"),
          join(dir, "batch.json"),
          join(dir, "predictions.json"),
        ]);
        const actual = JSON.parse(
          readFileSync(join(dir, "predictions.json"), "utf8"),
        );
        actual.rows.forEach(
          (r: { prediction: number; alert: boolean | null }, i: number) => {
            expect(r.prediction).toBeCloseTo(expected.rows[i].prediction, 10);
            expect(r.alert).toBe(expected.rows[i].alert);
          },
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
