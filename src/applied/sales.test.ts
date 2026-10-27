import type { Params } from "./types";
import { describe, it, expect, vi, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { definition, salesValues, optimizeSales } from "./models/sales";
import {
  defaults,
  emptyApplied,
  fresh,
  readProject,
  validApplied,
  validParams,
  type WorldProject,
} from "./schema";
import { finiteDifference, gradeMission, surfaceGeometry } from "./math";
import {
  INITIAL,
  STORAGE_KEY,
  APPLIED_BACKUP_KEY,
  parseLearning,
  persistLearning,
} from "../persistence/storage";
afterEach(() => vi.unstubAllGlobals());
describe("Sales complete vertical slice", () => {
  it("matches two hand-calculated segment, revenue and margin examples", () => {
    let p = { ...defaults("sales"), x: 20, y: 0 };
    let m = salesValues(p);
    expect(m.raw).toEqual([40, 40]);
    expect(m.q).toBe(40);
    expect(m.revenue).toBe(800);
    expect(m.profit).toBe(480);
    p = { ...p, x: 10, y: 2 };
    m = salesValues(p);
    expect(m.q).toBe(66);
    expect(m.profit).toBe(122);
  });
  it("uses matrix-weighted clipping and checks interior derivatives independently", () => {
    for (const x of [7, 14, 24])
      for (const y of [0.5, 2, 5])
        for (const mix of [0.2, 0.6, 0.9]) {
          const p = { ...defaults("sales"), x, y, mix, cap: 150 };
          const m = salesValues(p),
            g = finiteDifference(
              (a, b) => salesValues({ ...p, x: a, y: b }).profit,
              x,
              y,
            );
          expect(m.gradient[0]).toBeCloseTo(g[0], 7);
          expect(m.gradient[1]).toBeCloseTo(g[1], 7);
          expect(m.q).toBeCloseTo(
            mix * Math.max(0, 100 - 3 * x + 4 * y) +
              (1 - mix) * Math.max(0, 60 - x + 2 * y),
            12,
          );
        }
  });
  it("reports zero-demand elasticity and capacity kinks without fake smooth derivatives", () => {
    const p = { ...defaults("sales"), x: 40, y: 0, mix: 1 };
    expect(salesValues(p).q).toBe(0);
    expect(salesValues(p).elasticity).toBeNull();
    const cap = { ...defaults("sales"), x: 20, y: 0, cap: 40 };
    expect(definition.analyze(cap).gradient).toBeNull();
    expect(definition.analyze({ ...cap, y: 8, budget: 5 }).feasible).toBe(
      false,
    );
    expect(salesValues({ ...cap, x: 1 }).served).toBeLessThanOrEqual(40);
  });
  it("finds bounded piecewise optima at least as good as an independent dense grid", () => {
    for (const mix of [0, 0.25, 0.5, 0.9, 1])
      for (const cap of [20, 60, 150]) {
        const p: Params = { ...defaults("sales"), mix, cap, budget: 25 };
        const best = optimizeSales(p);
        expect(best.point[0]).toBeGreaterThanOrEqual(-1e-8);
        expect(best.point[0]).toBeLessThanOrEqual(40 + 1e-8);
        expect(best.point[1] * p.h).toBeLessThanOrEqual(p.budget + 1e-7);
        let grid = -Infinity;
        for (let i = 0; i <= 800; i++)
          for (let j = 0; j <= 100; j++)
            grid = Math.max(
              grid,
              salesValues({ ...p, x: i / 20, y: j / 20 }).profit,
            );
        expect(
          best.value,
          JSON.stringify({ mix, cap, best }),
        ).toBeGreaterThanOrEqual(grid - 1e-6);
        expect(best.value - grid).toBeLessThan(2);
      }
  });
  it("separates revenue and profit prices and validates seeded mission inputs", () => {
    const p = { ...defaults("sales"), y: 0, budget: 5 };
    expect(optimizeSales(p, true).point[0]).not.toBe(optimizeSales(p).point[0]);
    for (const seed of [1, 17, 34, 71]) {
      const mission = definition.mission(seed, 1),
        price =
          (60 + 40 * mission.params.mix) / (2 * (1 + 2 * mission.params.mix));
      const answer = { ...mission.params, x: price, y: 0 };
      expect(
        gradeMission(definition, answer, seed, 1, "principle").correct,
      ).toBe(true);
      expect(
        gradeMission(definition, { ...answer, k: 19 }, seed, 1, "principle")
          .correct,
      ).toBe(false);
      expect(
        gradeMission(definition, { ...answer, x: NaN }, seed, 1, "principle")
          .correct,
      ).toBe(false);
      expect(gradeMission(definition, answer, seed, 1, "volume").correct).toBe(
        false,
      );
    }
  });
  it("samples geometry and exact marker from the same mathematical model", () => {
    const p = defaults("sales"),
      g = surfaceGeometry(definition, p);
    expect(g.points).toHaveLength(625);
    expect(g.points.flat().every(Number.isFinite)).toBe(true);
    const actual = g.range[0] + (g.marker[2] * (g.range[1] - g.range[0])) / 2.2;
    expect(actual).toBeCloseTo(definition.analyze(p).value, 9);
  });
  it("executes generated Python on its fixed inputs", () => {
    const p = defaults("sales");
    expect(
      Number(
        execFileSync("python3", ["-c", definition.python(p)], {
          encoding: "utf8",
        }).trim(),
      ),
    ).toBeCloseTo(salesValues(p).profit, 9);
  });
  it("roundtrips strict projects, rejects sparse/future/oversized/nonfinite records", () => {
    const p: WorldProject = {
      kind: "applied-world-project",
      assumptions: definition.assumptions,
      version: 1,
      world: "sales",
      id: "fixture",
      title: "My plan",
      createdAt: "2026-10-26T12:00:00Z",
      record: fresh("sales"),
    };
    expect(readProject(JSON.stringify(p))).toEqual(p);
    expect(() => readProject(JSON.stringify({ ...p, version: 99 }))).toThrow();
    expect(() =>
      readProject(JSON.stringify({ ...p, extra: "eval()" })),
    ).toThrow();
    expect(() => readProject(" ".repeat(128001))).toThrow();
    expect(validParams("sales", { ...p.record.params, x: Infinity })).toBe(
      false,
    );
    expect(validApplied({ ...emptyApplied(), projects: new Array(1) })).toBe(
      false,
    );
  });
  it("backs up the entire prior v2 before adding applied records, including quota failure", () => {
    const old = { ...structuredClone(INITIAL) };
    delete old.applied;
    const raw = JSON.stringify(old);
    const data = new Map([[STORAGE_KEY, raw]]);
    let fail = true;
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) || null,
      setItem: (k: string, v: string) => {
        if (k === APPLIED_BACKUP_KEY && fail) throw Error("quota");
        data.set(k, v);
      },
    });
    const next = {
      ...parseLearning(raw),
      applied: { ...emptyApplied(), sessions: { sales: fresh("sales") } },
    };
    expect(() => persistLearning(next)).toThrow("quota");
    expect(data.get(STORAGE_KEY)).toBe(raw);
    fail = false;
    persistLearning(next);
    expect(data.get(APPLIED_BACKUP_KEY)).toBe(raw);
    expect(
      parseLearning(data.get(STORAGE_KEY)!).applied?.sessions.sales,
    ).toBeDefined();
    expect(parseLearning(raw).solved).toEqual(old.solved);
  });
});
