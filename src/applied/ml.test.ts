import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { defaults } from "./schema";
import { finiteDifference, surfaceGeometry } from "./math";
import { definition, loss, lossGradient } from "./models/ml";
describe("Two-parameter loss with an honest fixed intercept", () => {
  it("matches independently summed residual and exact-solution fixtures", () => {
    const p = defaults("ml");
    expect(loss(p)).toBe(87 / 4);
    expect(lossGradient(p)).toEqual([-10.5, -7.5]);
    expect(loss({ ...p, x: 2, y: 3 })).toBe(0);
    expect(lossGradient({ ...p, x: 2, y: 3 })).toEqual([0, 0]);
  });
  it("matches central differences and predicts both descent and overshoot", () => {
    const p = defaults("ml");
    for (const x of [-1, 0, 2, 5])
      for (const y of [-1, 1, 3, 6]) {
        const q = { ...p, x, y },
          g = finiteDifference((a, b) => loss({ ...p, x: a, y: b }), x, y);
        g.forEach((v, i) => expect(v).toBeCloseTo(lossGradient(q)[i], 7));
      }
    expect(loss(definition.step!({ ...p, alpha: 0.1 }))).toBeLessThan(loss(p));
    expect(loss(definition.step!({ ...p, alpha: 0.6 }))).toBeCloseTo(
      39.0975,
      9,
    );
  });
  it("keeps feature-space points separate from a loss surface", () => {
    const p = defaults("ml"),
      lossGeo = surfaceGeometry(definition, p),
      data = surfaceGeometry(definition, { ...p, view: 1 });
    expect(lossGeo.points).toHaveLength(625);
    expect(data.spheres).toHaveLength(4);
    expect(data.labels[2]).toContain("Meals/day");
    expect(data.draggable).toBe(false);
    expect(data.lines).toHaveLength(4);
  });
  it("reproduces the exact squared loss in standalone Python", () => {
    const p = { ...defaults("ml"), x: 1.2, y: 2.4 };
    expect(
      Number(
        execFileSync("python3", ["-c", definition.python(p)], {
          encoding: "utf8",
        }),
      ),
    ).toBeCloseTo(loss(p), 10);
  });
});
