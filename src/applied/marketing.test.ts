import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { defaults } from "./schema";
import { finiteDifference } from "./math";
import {
  definition,
  marketingValues,
  marketingOptimum,
  randomizedLift,
} from "./models/marketing";
describe("Marketing response and identification", () => {
  it("separates baseline, increment and net value with exact fixtures", () => {
    const p = defaults("marketing");
    expect(marketingValues({ ...p, x: 0, y: 0 })).toMatchObject({
      total: 20,
      increment: 0,
      net: 0,
    });
    const m = marketingValues({ ...p, x: 10, y: 0 });
    expect(m.increment).toBeCloseTo(7.7754533795, 9);
    expect(m.net).toBeCloseTo(28.8772668977, 9);
    expect(marketingValues({ ...p, baseline: 80 }).net).toBe(
      marketingValues(p).net,
    );
  });
  it("checks analytic gradients, monotonicity and diminishing marginals", () => {
    const p = defaults("marketing");
    let previous = Infinity;
    for (let x = 0; x <= 100; x += 5) {
      const m = marketingValues({ ...p, x }),
        g = finiteDifference(
          (a, b) => marketingValues({ ...p, x: a, y: b }).net,
          x,
          p.y,
        );
      expect(m.gradient[0]).toBeCloseTo(g[0], 7);
      expect(m.gradient[1]).toBeCloseTo(g[1], 7);
      expect(m.marginals[0]).toBeGreaterThan(0);
      expect(m.marginals[0]).toBeLessThanOrEqual(previous);
      expect(marketingValues({ ...p, x: x + 1 }).increment).toBeGreaterThan(
        m.increment,
      );
      previous = m.marginals[0];
    }
  });
  it("validates full-budget optimum against an independent grid including endpoints", () => {
    for (const budget of [40, 100, 160])
      for (const a of [5, 30, 60]) {
        const p = { ...defaults("marketing"), budget, a, minimum: 10 };
        const opt = marketingOptimum(p, true);
        expect(opt.point[0] + opt.point[1]).toBeCloseTo(budget, 10);
        let best = -Infinity;
        for (let i = 0; i <= 1000; i++) {
          const x = 10 + (90 * i) / 1000,
            y = budget - x;
          if (y < 10 || y > 100) continue;
          best = Math.max(best, marketingValues({ ...p, x, y }).net);
        }
        const actual = marketingValues({
          ...p,
          x: opt.point[0],
          y: opt.point[1],
        }).net;
        expect(actual).toBeGreaterThanOrEqual(best - 1e-8);
        expect(actual - best).toBeLessThan(0.1);
      }
  });
  it("checks at-most/minimum/cap candidates against a separate two-dimensional grid", () => {
    for (const budget of [40, 100, 160])
      for (const margin of [1, 5, 15]) {
        const p = { ...defaults("marketing"), budget, margin, minimum: 10 },
          o = marketingOptimum(p);
        expect(o.point[0]).toBeGreaterThanOrEqual(10);
        expect(o.point[1]).toBeGreaterThanOrEqual(10);
        expect(o.point[0] + o.point[1]).toBeLessThanOrEqual(budget + 1e-7);
        let best = -Infinity;
        for (let x = 10; x <= 100; x += 1)
          for (let y = 10; y <= 100; y += 1)
            if (x + y <= budget)
              best = Math.max(best, marketingValues({ ...p, x, y }).net);
        const actual = marketingValues({
          ...p,
          x: o.point[0],
          y: o.point[1],
        }).net;
        expect(actual).toBeGreaterThanOrEqual(best - 1e-7);
        expect(actual - best).toBeLessThan(0.5);
      }
  });
  it("does not convert last-click credit into randomized lift or certainty", () => {
    const a = randomizedLift(105, 1000, 100, 1000),
      b = randomizedLift(120, 1000, 80, 1000);
    expect(a.lift).toBeCloseTo(0.005, 12);
    expect(a.interval[0]).toBeLessThan(0);
    expect(a.interval[1]).toBeGreaterThan(0);
    expect(b.lift).toBeCloseTo(0.04, 12);
    expect(b.interval[0]).toBeGreaterThan(0);
    expect(() => randomizedLift(1, 0, 2, 10)).toThrow();
    expect(() => randomizedLift(11, 10, 0, 10)).toThrow();
  });
  it("reproduces net value in executable standalone Python", () => {
    const p = defaults("marketing");
    expect(
      Number(
        execFileSync("python3", ["-c", definition.python(p)], {
          encoding: "utf8",
        }),
      ),
    ).toBeCloseTo(marketingValues(p).net, 9);
  });
});
