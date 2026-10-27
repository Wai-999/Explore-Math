import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { defaults } from "./schema";
import { finiteDifference, gradeMission } from "./math";
import { arm, definition, pathSafety } from "./models/robotics";
describe("Rigid-link transforms, Jacobian and certified path", () => {
  it("matches matrix composition against independent trigonometric fixtures", () => {
    const p = defaults("robotics"),
      a = arm({ ...p, x: 0, y: 0 });
    expect(a.tip[0]).toBeCloseTo(2.4, 12);
    expect(a.tip[1]).toBe(0);
    a.J.flat().forEach((v, i) =>
      expect(v).toBeCloseTo([0, 0, 2.4, 1.1][i], 12),
    );
    expect(a.det).toBe(0);
    const b = arm({ ...p, x: 30, y: -30 });
    expect(b.tip[0]).toBeCloseTo((1.3 * Math.sqrt(3)) / 2 + 1.1, 12);
    expect(b.tip[1]).toBeCloseTo(0.65, 12);
    expect(b.det).toBeCloseTo(-0.715, 12);
  });
  it("matches Jacobian to finite differences after degree/radian conversion", () => {
    for (const x of [-80, 10, 45, 100])
      for (const y of [-70, 20, 85]) {
        const p = { ...defaults("robotics"), x, y },
          a = arm(p);
        for (let row = 0; row < 2; row++) {
          const g = finiteDifference(
            (u, v) => arm({ ...p, x: u, y: v }).tip[row],
            x,
            y,
          );
          expect((g[0] * 180) / Math.PI).toBeCloseTo(a.J[row][0], 7);
          expect((g[1] * 180) / Math.PI).toBeCloseTo(a.J[row][1], 7);
        }
        const q = finiteDifference((u, v) => definition.scalar(p, u, v), x, y);
        q.forEach((v, i) =>
          expect(v).toBeCloseTo(definition.analyze(p).gradient![i], 7),
        );
      }
  });
  it("rejects a colliding path and verifies seeded targets and singularity cases", () => {
    expect(pathSafety({ ...defaults("robotics"), x: 90, y: 0 }).certified).toBe(
      false,
    );
    for (const seed of [1, 17, 34, 60]) {
      const m = definition.mission(seed, 1),
        answer = { ...m.params, x: 35 + (seed % 16), y: -70 + (seed % 21) };
      expect(
        gradeMission(definition, answer, seed, 1, "principle").correct,
      ).toBe(true);
    }
    const m = definition.mission(17, 3);
    expect(
      gradeMission(definition, { ...m.params, x: 0, y: 0 }, 17, 3, "principle")
        .correct,
    ).toBe(true);
  });
  it("reproduces the squared target error in standard-library Python", () => {
    const p = defaults("robotics");
    expect(
      Number(
        execFileSync("python3", ["-c", definition.python(p)], {
          encoding: "utf8",
        }),
      ),
    ).toBeCloseTo(arm(p).error ** 2, 10);
  });
});
