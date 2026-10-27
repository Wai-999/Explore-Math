import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { defaults } from "./schema";
import { finiteDifference } from "./math";
import {
  definition,
  profit,
  profitGradient,
  financeOptimum,
} from "./models/finance";
describe("Constrained two-decision profit model", () => {
  it("matches hand-calculated worked fixtures and negative-definite curvature", () => {
    const p = defaults("finance");
    expect(profit({ ...p, x: 20, y: 10 })).toBe(248);
    expect(profit({ ...p, x: 40, y: 20 })).toBe(412);
    expect(profitGradient({ ...p, x: 20, y: 10 })).toEqual([11, 0.6]);
    const h = definition.analyze(p).hessian!;
    expect(h[0][0] * h[1][1] - h[0][1] * h[1][0]).toBeCloseTo(0.006, 12);
  });
  it("checks partial derivatives independently at diverse points", () => {
    const p = defaults("finance");
    for (const x of [0, 20, 40, 70])
      for (const y of [1, 20, 50]) {
        const q = { ...p, x, y },
          g = finiteDifference((a, b) => profit({ ...p, x: a, y: b }), x, y);
        g.forEach((v, i) => expect(v).toBeCloseTo(profitGradient(q)[i], 7));
      }
  });
  it("compares all boundary candidates with a separate grid and an exact fixture", () => {
    const base = defaults("finance"),
      o = financeOptimum(base);
    expect(o.point[0]).toBeCloseTo(305 / 6, 10);
    expect(o.point[1]).toBeCloseTo(175 / 3, 10);
    expect(o.value).toBeCloseTo(1585 / 3, 9);
    for (const budget of [80, 147, 220])
      for (const demand of [20, 24, 30]) {
        const p = { ...base, budget, demand },
          best = financeOptimum(p);
        expect(2 * best.point[0] + best.point[1]).toBeLessThanOrEqual(
          budget + 1e-7,
        );
        let grid = -Infinity;
        for (let i = 0; i <= 160; i++)
          for (let j = 0; j <= 120; j++) {
            const x = i / 2,
              y = j / 2;
            if (2 * x + y <= budget)
              grid = Math.max(grid, profit({ ...p, x, y }));
          }
        expect(best.value).toBeGreaterThanOrEqual(grid - 1e-7);
        expect(best.value - grid).toBeLessThan(0.1);
      }
  });
  it("rejects infeasible high-resource states and executes a reproducible calculation", () => {
    const p = defaults("finance");
    expect(
      definition.analyze({ ...p, x: 80, y: 60, budget: 100 }).feasible,
    ).toBe(false);
    expect(
      Number(
        execFileSync("python3", ["-c", definition.python(p)], {
          encoding: "utf8",
        }),
      ),
    ).toBeCloseTo(profit(p), 10);
  });
});
