import { describe, it, expect } from "vitest";
import {
  makeDataset,
  partition,
  rollingOrigins,
  splitAudit,
  type ProjectId,
} from "./data";
import {
  fit,
  gradient,
  objective,
  predict,
  prepare,
  trainSteps,
  fitStump,
  predictStump,
  sigmoid,
} from "./model";
import {
  classificationMetrics,
  regressionMetrics,
  residualRadius,
} from "./metrics";
import {
  canFreeze,
  freezeSession,
  freshSession,
  mutateSession,
  testSession,
  validSession,
} from "./session";
import { INITIAL, parseLearning } from "../persistence/storage";
import pythonOracle from "../../public/workshops/fixtures.json";
describe("cross-language numerical oracle", () => {
  it.each(["energy", "maintenance", "demand"] as ProjectId[])(
    "%s agrees with the executed Python implementation",
    (id) => {
      const data = makeDataset(id),
        oracle = pythonOracle[id];
      data.rows[0].x.forEach((v, i) =>
        expect(v).toBeCloseTo(oracle.first.x[i], 11),
      );
      expect(data.rows[0].y).toBeCloseTo(oracle.first.y, 10);
      const model = fit(
        partition(data, "train"),
        data.classification,
        false,
        0.1,
      );
      model.weights.forEach((v, i) =>
        expect(v).toBeCloseTo(oracle.weights[i], 8),
      );
      const val = partition(data, "validation"),
        p = val.map((r) => predict(model, r));
      if (id === "maintenance")
        expect(
          classificationMetrics(
            val.map((r) => r.y),
            p,
          ).logLoss,
        ).toBeCloseTo(pythonOracle.maintenance.metrics.log_loss, 8);
      else
        expect(
          regressionMetrics(
            val.map((r) => r.y),
            p,
          ).mae,
        ).toBeCloseTo(
          (id === "energy" ? pythonOracle.energy : pythonOracle.demand).metrics
            .mae,
          8,
        );
    },
  );
});
describe("prediction-time data contracts", () => {
  it.each(["energy", "maintenance", "demand"] as ProjectId[])(
    "%s is deterministic, bounded, uniquely keyed and disjoint",
    (id) => {
      const d = makeDataset(id),
        again = makeDataset(id);
      expect(d).toEqual(again);
      expect(d.rows).not.toEqual(makeDataset(id, 59).rows);
      expect(new Set(d.rows.map((r) => r.id)).size).toBe(d.rows.length);
      expect(
        d.rows.every((r) => r.x.every(Number.isFinite) && Number.isFinite(r.y)),
      ).toBe(true);
      const ids = partition(d, "train").map((r) => r.id);
      expect(partition(d, "test").some((r) => ids.includes(r.id))).toBe(false);
    },
  );
  it("separates all snapshots of unseen machines", () => {
    expect(splitAudit(makeDataset("maintenance")).groupOverlap).toBe(0);
    expect(splitAudit(makeDataset("maintenance")).counts).toEqual([
      112, 40, 40,
    ]);
  });
  it("preserves chronology in forecasting and every rolling origin", () => {
    const d = makeDataset("demand");
    expect(splitAudit(d).chronological).toBe(true);
    for (const f of rollingOrigins(d)) {
      expect(Math.max(...f.train.map((r) => r.time))).toBeLessThan(
        Math.min(...f.validation.map((r) => r.time)),
      );
      expect(Math.max(...f.validation.map((r) => r.time))).toBeLessThan(78);
    }
  });
  it.each(["energy", "maintenance", "demand"] as ProjectId[])(
    "a final regime change leaves %s development evidence identical",
    (id) => {
      const a = makeDataset(id, 42),
        b = makeDataset(id, 42, true);
      expect(partition(a, "train")).toEqual(partition(b, "train"));
      expect(partition(a, "validation")).toEqual(partition(b, "validation"));
      expect(partition(a, "test")).not.toEqual(partition(b, "test"));
    },
  );
});
describe("training is separated from evaluation", () => {
  it("fits preprocessing only to the provided training rows", () => {
    const d = makeDataset("energy"),
      train = partition(d, "train"),
      model = prepare(train);
    const actual = train.reduce((s, r) => s + r.x[0], 0) / train.length;
    expect(model.prep.means[0]).toBeCloseTo(actual, 12);
    const changed = makeDataset("energy");
    partition(changed, "test").forEach((r) => (r.x[0] = 1e9));
    expect(prepare(partition(changed, "train")).prep).toEqual(model.prep);
  });
  it.each([false, true])(
    "analytic objective gradient matches finite differences; classification=%s",
    (classification) => {
      const data = makeDataset(classification ? "maintenance" : "energy"),
        rows = partition(data, "train"),
        m = prepare(rows, classification);
      m.lambda = 0.2;
      m.weights = m.weights.map((_, i) => 0.1 * (i + 1));
      const g = gradient(m, rows),
        h = 1e-5;
      g.forEach((v, i) => {
        const plus = { ...m, weights: [...m.weights] },
          minus = { ...m, weights: [...m.weights] };
        plus.weights[i] += h;
        minus.weights[i] -= h;
        expect(
          (objective(plus, rows) - objective(minus, rows)) / (2 * h),
        ).toBeCloseTo(v, 6);
      });
    },
  );
  it.each(["energy", "maintenance", "demand"] as ProjectId[])(
    "training reduces %s objective without test access",
    (id) => {
      const d = makeDataset(id),
        train = partition(d, "train"),
        m = prepare(train, d.classification),
        trained = trainSteps(m, train, 300, 0.1, 0.01);
      expect(objective(trained, train)).toBeLessThan(
        objective({ ...m, lambda: 0.01 }, train),
      );
      expect(trained.losses.every(Number.isFinite)).toBe(true);
    },
  );
  it("ridge reduces coefficient norm and ignores the intercept penalty", () => {
    const train = partition(makeDataset("energy"), "train"),
      a = fit(train, false, false, 0),
      b = fit(train, false, false, 1);
    expect(b.weights.slice(1).reduce((s, w) => s + w * w, 0)).toBeLessThan(
      a.weights.slice(1).reduce((s, w) => s + w * w, 0),
    );
    const p = { ...a, lambda: 1 };
    expect(gradient(p, train)[0]).toBeCloseTo(gradient(a, train)[0], 12);
  });
  it("a future target makes optimistic scores but cannot be frozen", () => {
    const d = makeDataset("energy"),
      m = fit(partition(d, "train"), false, true);
    const val = partition(d, "validation"),
      scores = regressionMetrics(
        val.map((r) => r.y),
        val.map((r) => predict(m, r)),
      );
    const clean = fit(partition(d, "train"));
    const honest = regressionMetrics(
      val.map((r) => r.y),
      val.map((r) => predict(clean, r)),
    ).mae;
    expect(scores.mae).toBeLessThan(honest * 0.5);
    expect(
      canFreeze({
        ...freshSession(),
        leak: true,
        model: m,
        hypothesis: "Future data creates an invalid shortcut.",
      }),
    ).toBe(false);
  });
  it("a one-split tree is fitted from training labels only", () => {
    const d = makeDataset("energy"),
      train = partition(d, "train"),
      s = fitStump(train);
    expect(s.left).toBeGreaterThan(0);
    expect(
      Number.isFinite(predictStump(s, partition(d, "validation")[0])),
    ).toBe(true);
    expect(() => fitStump([])).toThrow();
  });
  it("stable sigmoid handles extreme finite logits", () => {
    expect(sigmoid(-1000)).toBe(0);
    expect(sigmoid(1000)).toBe(1);
    expect(sigmoid(0)).toBe(0.5);
  });
});
describe("metrics have checked units, ties, and denominators", () => {
  it("matches an independent hand-worked regression example", () => {
    expect(regressionMetrics([100, 120], [90, 130])).toEqual({
      mae: 10,
      rmse: 10,
      bias: 0,
      r2: 0,
    });
    expect(regressionMetrics([1, 1], [1, 1]).r2).toBeNull();
    expect(() => regressionMetrics([], [])).toThrow();
  });
  it("matches TP=3,FP=2,FN=1,TN=4 cost and recall example", () => {
    const a = [1, 1, 1, 0, 0, 1, 0, 0, 0, 0],
      p = [0.8, 0.8, 0.8, 0.8, 0.8, 0.1, 0.1, 0.1, 0.1, 0.1],
      m = classificationMetrics(a, p, 0.5);
    expect([m.tp, m.fp, m.fn, m.tn]).toEqual([3, 2, 1, 4]);
    expect(m.precision).toBe(0.6);
    expect(m.recall).toBe(0.75);
    expect(m.cost).toBe(12);
  });
  it("reports undefined precision/AUC and handles equal-probability AP correctly", () => {
    expect(classificationMetrics([0, 0], [0.1, 0.1]).precision).toBeNull();
    expect(classificationMetrics([0, 0], [0.1, 0.1]).auc).toBeNull();
    const tied = classificationMetrics([1, 0], [0.5, 0.5]);
    expect(tied.auc).toBe(0.5);
    expect(tied.averagePrecision).toBe(0.5);
    expect(() => classificationMetrics([1], [1.2])).toThrow();
  });
  it("threshold affects decisions but not probability quality", () => {
    const a = [1, 0, 1, 0],
      p = [0.6, 0.2, 0.4, 0.1],
      lo = classificationMetrics(a, p, 0.3),
      hi = classificationMetrics(a, p, 0.7);
    expect(lo.recall).toBeGreaterThan(hi.recall!);
    expect(lo.logLoss).toBe(hi.logLoss);
    expect(lo.brier).toBe(hi.brier);
  });
  it("uses a defined empirical residual quantile", () => {
    expect(residualRadius([0, 0, 0, 0], [1, 2, 3, 4], 0.5)).toBe(2);
    expect(() => residualRadius([], [])).toThrow();
  });
});
describe("final test protocol and validated migration", () => {
  const trained = () => ({
    ...freshSession(),
    model: fit(partition(makeDataset("energy"), "train")),
    hypothesis: "Planned production should improve on the mean baseline.",
  });
  it("blocks early and repeated test access; freezes preprocessing and policy", () => {
    expect(() => testSession(freshSession())).toThrow();
    const frozen = freezeSession(trained()),
      tested = testSession(frozen);
    expect(() => mutateSession(tested, { threshold: 0.1 })).toThrow();
    expect(() => mutateSession(tested, { model: null })).toThrow();
    expect(() => testSession(tested)).toThrow();
    expect(
      mutateSession(tested, { interpretation: "New notes are allowed." })
        .tested,
    ).toBe(true);
    expect(validSession(tested)).toBe(true);
  });
  it("migrates v1 without losing original evidence or inventing studio progress", () => {
    const old = {
      version: 1,
      theme: "light",
      depth: "advanced",
      solved: [],
      bookmarks: ["transform-space"],
      attempts: { satellite: 2 },
    };
    const next = parseLearning(JSON.stringify(old));
    expect(next.version).toBe(2);
    expect(next.bookmarks).toEqual(old.bookmarks);
    expect(next.attempts).toEqual(old.attempts);
    expect(next.studio).toEqual({});
  });
  it("round-trips a frozen session and rejects corrupt model arrays", () => {
    const backup = {
      ...INITIAL,
      studio: { energy: testSession(freezeSession(trained())) },
    };
    expect(parseLearning(JSON.stringify(backup))).toEqual(backup);
    const broken = JSON.parse(JSON.stringify(backup));
    broken.studio.energy.model.weights = [1];
    expect(() => parseLearning(JSON.stringify(broken))).toThrow();
  });
});
