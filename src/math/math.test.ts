import { describe, expect, it } from "vitest";
import {
  add,
  cross,
  determinant,
  dot,
  eigen2,
  gramSchmidt,
  IDENTITY,
  inverse,
  linearModel,
  multiply,
  norm,
  projection,
  rank,
  rotation,
  scale,
  transform,
  validMatrix,
  type Mat3,
} from "./linear";
import {
  calculusModel,
  descent,
  energy,
  gradient,
  integrate,
  numericalGradient,
  secant,
  tangentHeight,
} from "./calculus";
import {
  business,
  leastSquares,
  mse,
  regression,
  robot,
  TRAIN,
  TEST,
} from "./applications";
import { gradeMatrix, satelliteChallenge } from "../assessment/challenges";
import { INITIAL, parseLearning } from "../persistence/storage";
import { lessons, sources } from "../content/lessons";
const closeVec = (a: number[], b: number[]) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
describe("right-handed column-vector linear algebra", () => {
  it.each(["x", "y", "z"] as const)(
    "rotation about %s preserves norm, volume, inverse",
    (axis) => {
      const r = rotation(axis, 37);
      expect(norm(transform(r, [1, -2, 3]))).toBeCloseTo(Math.sqrt(14), 12);
      expect(determinant(r)).toBeCloseTo(1, 12);
      closeVec(transform(inverse(r)!, transform(r, [1, -2, 3])), [1, -2, 3]);
    },
  );
  it("reflection reverses orientation; singularity loses a dimension", () => {
    expect(determinant([-1, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(-1);
    const a: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 0];
    expect(determinant(a)).toBe(0);
    expect(inverse(a)).toBeNull();
    expect(rank(a)).toBe(2);
    expect(linearModel(a).orientation).toBe("Collapsed");
  });
  it("rank handles permutations and complete collapse", () => {
    expect(rank([0, 1, 0, 0, 0, 1, 1, 0, 0])).toBe(3);
    expect(rank([0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    expect(rank([1, 2, 3, 2, 4, 6, 3, 6, 9])).toBe(1);
  });
  it("det(AB) = det(A)det(B)", () => {
    const a: Mat3 = [1, 2, 0, 0, 3, 1, 1, 0, 2],
      b: Mat3 = [2, 0, 1, 1, -1, 0, 0, 1, 3];
    expect(determinant(multiply(a, b))).toBeCloseTo(
      determinant(a) * determinant(b),
      12,
    );
  });
  it("has a visible noncommuting example", () => {
    const a = robot(45, 60, "yaw-first").direction,
      b = robot(45, 60, "tilt-first").direction;
    expect(norm(add(a, scale(b, -1)))).toBeGreaterThan(0.5);
    closeVec(a, [Math.SQRT1_2, Math.SQRT1_2 / 2, Math.sqrt(6) / 4]);
  });
  it("column convention puts transformed basis in columns", () => {
    const a: Mat3 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    closeVec(transform(a, [1, 0, 0]), [1, 4, 7]);
    closeVec(transform(a, [1, 1, 1]), [6, 15, 24]);
  });
  it("rejects NaN, infinity, extreme, and malformed matrix states", () => {
    expect(validMatrix(IDENTITY)).toBe(true);
    for (const v of [
      [...IDENTITY, 0],
      [NaN, ...IDENTITY.slice(1)],
      [Infinity, ...IDENTITY.slice(1)],
      [4, ...IDENTITY.slice(1)],
      null,
    ])
      expect(validMatrix(v)).toBe(false);
  });
  it("declines near singular inverses without fabricating a solution", () => {
    const m: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1e-10];
    expect(inverse(m)).toBeNull();
    expect(linearModel(m).conditionBound).toBe(Infinity);
  });
  it("real eigenpairs satisfy Av = λv", () => {
    const e = eigen2(2, 1, 1, 2);
    expect(e.status).toBe("real");
    for (const { value, vector } of e.pairs)
      closeVec(
        transform([2, 1, 0, 1, 2, 0, 0, 0, 1], vector),
        scale(vector, value),
      );
  });
  it("does not invent real eigenvectors for a planar quarter turn", () => {
    expect(eigen2(0, -1, 1, 0).status).toBe("complex");
    expect(eigen2(0, -1, 1, 0).pairs).toEqual([]);
  });
  it("projects with orthogonal residual and catches degenerate bases", () => {
    const a: [number, number, number] = [1, 1, 0],
      b: [number, number, number] = [3, 1, 2],
      p = projection(b, a)!;
    expect(dot(add(b, scale(p, -1)), a)).toBeCloseTo(0, 12);
    const basis = gramSchmidt(a, b)!;
    expect(dot(...basis)).toBeCloseTo(0, 12);
    basis.forEach((v) => expect(norm(v)).toBeCloseTo(1, 12));
    expect(gramSchmidt(a, scale(a, 2))).toBeNull();
    expect(projection(a, [0, 0, 0])).toBeNull();
    closeVec(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  });
});
describe("calculus and numerical approximations", () => {
  it.each(["bowl", "valleys"] as const)(
    "finite differences agree with %s gradient",
    (kind) => {
      for (const p of [
        [1.2, -0.7],
        [0, 0],
        [-2, 1],
      ] as [number, number][]) {
        const a = gradient(kind, p),
          n = numericalGradient(kind, p, 1e-5);
        a.forEach((v, i) => expect(v).toBeCloseTo(n[i], 7));
      }
    },
  );
  it("tangent plane agrees at its base and has correct slopes", () => {
    expect(tangentHeight("bowl", [1, 2], [1, 2])).toBe(4.5);
    expect(tangentHeight("bowl", [1, 2], [2, 3])).toBe(9.5);
  });
  it("reports a defined finite-step error", () => {
    const m = calculusModel("valleys", [1, 1]);
    expect(m.error).toBeCloseTo(1e-6, 9);
  });
  it("secant converges to analytic derivative", () => {
    expect(Math.abs(secant(1, 0.001) - 2)).toBeLessThan(
      Math.abs(secant(1, 0.1) - 2),
    );
    expect(secant(1, 0.001)).toBeCloseTo(2.001, 9);
  });
  it.each(["left", "right", "midpoint", "trapezoid"] as const)(
    "%s sums approach 8/3",
    (rule) => {
      expect(Math.abs(integrate(0, 2, 100, rule) - 8 / 3)).toBeLessThan(
        Math.abs(integrate(0, 2, 4, rule) - 8 / 3),
      );
      expect(integrate(2, 0, 100, rule)).toBeLessThan(0);
    },
  );
  it("rejects invalid quadrature counts", () => {
    for (const n of [0, -1, 1.5, 1001, Infinity])
      expect(() => integrate(0, 2, n, "left")).toThrow();
  });
  it("safe convex descent decreases energy; large step can increase it", () => {
    expect(descent("bowl", [1, 1], 0.25).after).toBeLessThan(
      energy("bowl", [1, 1]),
    );
    expect(descent("bowl", [0, 1], 1.2).after).toBeGreaterThan(
      energy("bowl", [0, 1]),
    );
  });
  it("does not silently clamp a boundary or move a stationary saddle", () => {
    expect(descent("valleys", [2.5, 2.5], 1.2).status).toBe("boundary");
    expect(descent("valleys", [0, 0], 0.25).point).toEqual([0, 0]);
    expect(energy("valleys", [1, 0])).toBeLessThan(energy("valleys", [0, 0]));
  });
});
describe("decisions are based on mathematical outcomes", () => {
  it("profit optimum has zero marginal and beats neighbors", () => {
    for (const demand of [100, 120, 140]) {
      const b = business(business(0, demand).optimum, demand);
      expect(b.marginal).toBeCloseTo(0, 10);
      expect(b.profit).toBeGreaterThan(business(b.q - 1, demand).profit);
      expect(b.profit).toBeGreaterThan(business(b.q + 1, demand).profit);
    }
  });
  it("least squares residuals are perpendicular to constant and x columns", () => {
    const fit = leastSquares(TRAIN)!,
      m = regression(fit.slope, fit.intercept);
    expect(m.residuals.reduce((s, r) => s + r.residual, 0)).toBeCloseTo(0, 10);
    expect(m.residuals.reduce((s, r) => s + r.x * r.residual, 0)).toBeCloseTo(
      0,
      10,
    );
    expect(m.train).toBeLessThan(0.03);
    expect(m.test).toBe(mse(TEST, fit.slope, fit.intercept));
    expect(
      leastSquares([
        [1, 2],
        [1, 3],
      ]),
    ).toBeNull();
  });
  it("target is seeded and grading checks the entire matrix, not just determinant", () => {
    expect(satelliteChallenge(42)).toEqual(satelliteChallenge(42));
    const c = satelliteChallenge(42);
    expect(gradeMatrix(rotation("z", c.angle), c.angle)).toBe(true);
    expect(gradeMatrix([1, 0.7, 0, 0, 1, 0, 0, 0, 1], c.angle)).toBe(false);
  });
});
describe("content and saved learning integrity", () => {
  it("every lesson reference exists and learning contracts have depth", () => {
    for (const l of Object.values(lessons)) {
      for (const s of l.sourceRefs)
        expect(sources.some((x) => x.id === s)).toBe(true);
      for (const level of [
        "intuition",
        "foundations",
        "advanced",
        "research",
      ] as const)
        expect(l[level].length).toBeGreaterThan(80);
      expect(l.objectives.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("round-trips valid backups and rejects incompatible/corrupt evidence", () => {
    expect(parseLearning(JSON.stringify(INITIAL))).toEqual(INITIAL);
    for (const bad of [
      "{}",
      "null",
      '{"version":99}',
      JSON.stringify({
        ...INITIAL,
        solved: [{ id: "x", at: "yesterday", attempts: 1, seed: 1 }],
      }),
      JSON.stringify({ ...INITIAL, bookmarks: [12] }),
    ])
      expect(() => parseLearning(bad)).toThrow();
  });
});
