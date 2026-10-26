import { describe, expect, it } from "vitest";
import {
  conceptIds,
  defaults,
  gradientModel,
  gradePractice,
  makePractice,
  matrixModel,
  slopeModel,
  validState,
  vectorModel,
} from "./model";
import {
  IDENTITY,
  add,
  cross,
  determinant,
  dot,
  inverse,
  multiply,
  norm,
  projection,
  rotation,
  scale,
  transform,
  type Mat3,
  type Vec3,
} from "../math/linear";
import { energy } from "../math/calculus";
import {
  claimFor,
  concepts,
  derivationFor,
  examplesFor,
} from "../content/concepts";

const closeVector = (actual: number[], expected: number[], digits = 10) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) =>
    expect(value).toBeCloseTo(expected[index], digits),
  );
};
const difference = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

/** An elimination-based reference, independent of the app's cofactor determinant. */
function eliminationDeterminant(matrix: Mat3) {
  const rows = [matrix.slice(0, 3), matrix.slice(3, 6), matrix.slice(6, 9)];
  let result = 1;
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++)
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column]))
        pivot = row;
    if (Math.abs(rows[pivot][column]) < 1e-12) return 0;
    if (pivot !== column) {
      [rows[pivot], rows[column]] = [rows[column], rows[pivot]];
      result = -result;
    }
    const value = rows[column][column];
    result *= value;
    for (let row = column + 1; row < 3; row++) {
      const factor = rows[row][column] / value;
      for (let k = column + 1; k < 3; k++)
        rows[row][k] -= factor * rows[column][k];
    }
  }
  return result;
}

function parseCoordinates(text: string) {
  return text.split(",").map((value) => Number(value.trim()));
}

describe("R1 semantic state boundaries", () => {
  it.each(conceptIds)("%s accepts its default without mutating it", (id) => {
    const before = JSON.stringify(defaults[id]);
    expect(validState(id, defaults[id])).toBe(true);
    expect(JSON.stringify(defaults[id])).toBe(before);
  });
  it.each(conceptIds)(
    "%s rejects nonfinite, sparse, truncated, wrong-mode and malformed input",
    (id) => {
      const base = defaults[id];
      for (const input of [
        null,
        [],
        {},
        { ...base, mode: "unknown" },
        { ...base, values: [] },
        { ...base, values: Array(base.values.length) },
      ])
        expect(validState(id, input)).toBe(false);
      for (const value of [NaN, Infinity, -Infinity, "1", null, undefined]) {
        const values: unknown[] = [...base.values];
        values[0] = value;
        expect(validState(id, { ...base, values })).toBe(false);
      }
    },
  );
  it("rejects unsupported physical/control ranges instead of silently clamping", () => {
    expect(() => vectorModel([0, 0, 11, 0, 0, 0, 1, 1])).toThrow();
    expect(() => matrixModel([4, 0, 0, 1, 1, 1, 1, 1])).toThrow();
    for (const values of [
      [3, 0.5, 0.2],
      [1, 2, 0.2],
      [1, 0.5, 0],
    ])
      expect(() => slopeModel({ values, mode: "square" })).toThrow();
    for (const values of [
      [3, 0, 0.1],
      [0, 0, 0],
      [0, 0, 1.21],
    ])
      expect(() => gradientModel({ values, mode: "bowl" })).toThrow();
  });
});

describe("R1 vector addition, rescue, projection and orientation", () => {
  it("matches two independently calculated rescue scenarios, including signs and units", () => {
    const first = vectorModel([1, 2, 4, 4, 2, -1, 7, 5]);
    expect(first.required).toEqual([4, 4, 0]);
    expect(first.landing).toEqual([7, 5, 0]);
    expect(first.error).toBe(0);
    const second = vectorModel([-2, 1, 6, -4, -1, 2, 3, -1]);
    expect(second.required).toEqual([6, -4, 0]);
    expect(second.landing).toEqual([3, -1, 0]);
    expect(second.error).toBe(0);
  });
  it("preserves commutativity, associativity, distribution and basis reconstruction on varied signed vectors", () => {
    for (let i = 0; i < 80; i++) {
      const a: Vec3 = [(i % 7) - 3, (i % 5) - 2, (i % 3) - 1];
      const b: Vec3 = [(i % 4) - 2, (i % 9) - 4, (i % 6) - 3];
      const c: Vec3 = [i % 2, 2 - (i % 5), (i % 8) - 4];
      expect(add(a, b)).toEqual(add(b, a));
      expect(add(add(a, b), c)).toEqual(add(a, add(b, c)));
      closeVector(scale(add(a, b), -2), add(scale(a, -2), scale(b, -2)));
      expect(
        add(
          add(scale([1, 0, 0], a[0]), scale([0, 1, 0], a[1])),
          scale([0, 0, 1], a[2]),
        ),
      ).toEqual(a);
    }
    expect(add([2, -3, 1], [-2, 3, -1])).toEqual([0, 0, 0]);
    expect(norm([0, 0, 0])).toBe(0);
  });
  it("matches exact projection fixtures and an orthogonal residual", () => {
    const first = vectorModel([0, 0, 3, 4, 2, 0, 0, 0]);
    expect(first.projected).toEqual([3, 0, 0]);
    expect(first.residual).toEqual([0, 4, 0]);
    expect(first.orthogonality).toBe(0);
    const b: Vec3 = [1, 2, -2],
      a: Vec3 = [2, -1, 3];
    const p = projection(a, b)!;
    closeVector(p, [-2 / 3, -4 / 3, 4 / 3]);
    closeVector(difference(a, p), [8 / 3, 1 / 3, 5 / 3]);
    expect(dot(difference(a, p), b)).toBeCloseTo(0, 12);
    for (let i = 1; i < 40; i++) {
      const u: Vec3 = [i % 5, -2, (i % 3) - 1],
        direction: Vec3 = [i % 4, 1, (i % 7) - 3];
      const projected = projection(u, direction)!;
      expect(dot(difference(u, projected), direction)).toBeCloseTo(0, 10);
      expect(norm(cross(projected, direction))).toBeCloseTo(0, 10);
    }
  });
  it("keeps zero/tiny projection directions explicitly undefined", () => {
    expect(projection([3, 4, 0], [0, 0, 0])).toBeNull();
    expect(projection([3, 4, 0], [1e-7, 0, 0])).toBeNull();
    const result = vectorModel([0, 0, 3, 4, 0, 0, 0, 0]);
    expect(result.projected).toBeNull();
    expect(result.residual).toBeNull();
    expect(result.orthogonality).toBeNull();
  });
  it("checks right-handed cross orientation and perpendicular area normals", () => {
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(cross([0, 1, 0], [1, 0, 0])).toEqual([0, 0, -1]);
    const a: Vec3 = [2, -1, 3],
      b: Vec3 = [1, 2, -2],
      n = cross(a, b);
    expect(dot(n, a)).toBe(0);
    expect(dot(n, b)).toBe(0);
    expect(norm(n) ** 2).toBeCloseTo(
      dot(a, a) * dot(b, b) - dot(a, b) ** 2,
      10,
    );
    expect(cross(a, scale(a, -1))).toEqual([0, 0, 0]);
  });
});

describe("R1 matrix action and determinant claims", () => {
  it("matches two independent block-matrix fixtures, with reflection sign", () => {
    const first = matrixModel([2, 1, 0, 1, 1, 1, 2, 3]);
    expect(first.image).toEqual([4, 2, 3]);
    expect(first.det).toBe(2);
    expect(first.area).toBe(2);
    const second = matrixModel([-1, 0, 0, 2, 1, 2, -1, 3]);
    expect(second.image).toEqual([-2, -2, 3]);
    expect(second.det).toBe(-2);
    expect(transform(inverse(first.matrix)!, first.image)).toEqual(first.probe);
  });
  it("derives displayed images from basis columns and agrees with an elimination reference", () => {
    for (let i = 0; i < 75; i++) {
      const values = [
        (i % 5) - 2,
        (i % 7) - 3,
        ((i * 3) % 5) - 2,
        i % 4,
        (i % 3) - 1,
        2,
        -1,
        1,
      ];
      const m = matrixModel(values);
      const sum = m.columns.reduce<Vec3>(
        (total, column, index) => add(total, scale(column, m.probe[index])),
        [0, 0, 0],
      );
      expect(sum).toEqual(m.image);
      expect(m.det).toBeCloseTo(eliminationDeterminant(m.matrix), 10);
      expect(m.det).toBeCloseTo(m.area * values[4], 10);
    }
  });
  it("shows a noncommuting example without asserting all matrices fail to commute", () => {
    const r = rotation("z", 90),
      s: Mat3 = [2, 0, 0, 0, 1, 0, 0, 0, 1];
    closeVector(transform(multiply(r, s), [1, 0, 0]), [0, 2, 0]);
    closeVector(transform(multiply(s, r), [1, 0, 0]), [0, 1, 0]);
    expect(multiply(IDENTITY, s)).toEqual(multiply(s, IDENTITY));
    expect(determinant(multiply(r, s))).toBeCloseTo(
      determinant(r) * determinant(s),
      12,
    );
  });
  it("preserves lengths under proper rotations while a determinant-one shear changes them", () => {
    for (const axis of ["x", "y", "z"] as const)
      for (const degrees of [-180, -60, 0, 30, 90, 179]) {
        const r = rotation(axis, degrees),
          v: Vec3 = [1, 2, -3];
        expect(norm(transform(r, v))).toBeCloseTo(Math.sqrt(14), 12);
        expect(determinant(r)).toBeCloseTo(1, 12);
        closeVector(transform(inverse(r)!, transform(r, v)), v);
      }
    const shear = matrixModel([1, 1, 0, 1, 1, 0, 1, 0]);
    expect(shear.det).toBe(1);
    expect(norm(shear.image)).toBeCloseTo(Math.sqrt(2), 12);
  });
  it("reports singular loss of a dimension instead of a fictitious inverse", () => {
    const m = matrixModel([1, 2, 2, 4 / 3, 0, 1, 1, 1]);
    expect(m.det).toBe(0);
    expect(m.image[2]).toBe(0);
    expect(inverse(m.matrix)).toBeNull();
  });
});

describe("R1 derivative, one-sided limits and epsilon bands", () => {
  it("matches two rational examples and converges from either side to the derivative", () => {
    expect(slopeModel({ values: [2, 0.5, 0.2], mode: "square" })).toMatchObject(
      { secant: 4.5, slope: 4 },
    );
    expect(
      slopeModel({ values: [-1, 0.25, 0.2], mode: "square" }),
    ).toMatchObject({ secant: -1.75, slope: -2 });
    for (const x of [-2, -1.25, 0, 0.5, 2])
      for (const h of [-0.1, -0.01, 0.01, 0.1]) {
        const m = slopeModel({ values: [x, h, 0.2], mode: "square" });
        expect(Math.abs(m.secant! - m.slope!)).toBeCloseTo(Math.abs(h), 12);
      }
  });
  it("does not evaluate the h=0 quotient and avoids catastrophic cancellation at tiny nonzero h", () => {
    const zero = slopeModel({ values: [2, 0, 0.2], mode: "square" });
    expect(zero.secant).toBeNull();
    expect(zero.slope).toBe(4);
    expect(
      slopeModel({ values: [2, 1e-16, 0.2], mode: "square" }).secant,
    ).toBeCloseTo(4, 12);
  });
  it("separates a jump's function limits from a cusp's derivative limits", () => {
    const left = slopeModel({ values: [0, -0.1, 0.2], mode: "jump" });
    const right = slopeModel({ values: [0, 0.1, 0.2], mode: "jump" });
    expect(left.other).toBe(-1);
    expect(right.other).toBe(1);
    expect(left.slope).toBeNull();
    expect(right.slope).toBeNull();
    const cuspLeft = slopeModel({ values: [0, -0.1, 0.2], mode: "cusp" });
    const cuspRight = slopeModel({ values: [0, 0.1, 0.2], mode: "cusp" });
    expect(cuspLeft.y).toBe(0);
    expect(cuspRight.y).toBe(0);
    expect(cuspLeft.secant).toBe(-1);
    expect(cuspRight.secant).toBe(1);
    expect(cuspLeft.slope).toBeNull();
    expect(cuspRight.slope).toBeNull();
  });
  it("uses mode-specific delta bounds and never supplies a two-sided jump-zero proof", () => {
    expect(
      slopeModel({ values: [0, 0.1, 0.2], mode: "jump" }).delta,
    ).toBeNull();
    for (const mode of ["square", "cusp", "jump"])
      for (const x of [-1, -0.1, 0.1, 1])
        for (const epsilon of [0.01, 0.2, 1]) {
          const m = slopeModel({ values: [x, 0.1, epsilon], mode });
          expect(m.delta).not.toBeNull();
          const delta = m.delta!;
          for (const fraction of [-0.99, -0.5, 0.5, 0.99]) {
            const nearby = x + fraction * delta;
            const value =
              mode === "square"
                ? nearby * nearby
                : mode === "cusp"
                  ? Math.abs(nearby)
                  : nearby < 0
                    ? -1
                    : 1;
            expect(Math.abs(value - m.y)).toBeLessThan(epsilon);
          }
        }
  });
});

describe("R1 gradient, Hessian, saddle and descent", () => {
  it("matches two independently computed exact-energy descent examples", () => {
    const first = gradientModel({ values: [1, 1, 0.25], mode: "bowl" });
    expect(first.gradient).toEqual([1, 2]);
    expect(first.hessian).toEqual([
      [1, 0],
      [0, 2],
    ]);
    expect(first.value).toBe(3 / 2);
    expect(first.step.point).toEqual([3 / 4, 1 / 2]);
    expect(first.step.after).toBe(17 / 32);
    const second = gradientModel({ values: [-2, 0.5, 0.1], mode: "bowl" });
    expect(second.gradient).toEqual([-2, 1]);
    closeVector(second.step.point, [-9 / 5, 2 / 5]);
    expect(second.step.after).toBeCloseTo(89 / 50, 12);
  });
  it("cross-checks analytic gradients and Hessians by central differences away from domain edges", () => {
    const h = 1e-5;
    for (const mode of ["bowl", "valleys"] as const)
      for (const [x, y] of [
        [-1.5, -0.5],
        [-0.25, 0.75],
        [0, 0],
        [1, 1],
      ]) {
        const model = gradientModel({ values: [x, y, 0.1], mode });
        const dx =
          (energy(mode, [x + h, y]) - energy(mode, [x - h, y])) / (2 * h);
        const dy =
          (energy(mode, [x, y + h]) - energy(mode, [x, y - h])) / (2 * h);
        closeVector(model.gradient, [dx, dy], 7);
        const gxPlus = gradientModel({
          values: [x + h, y, 0.1],
          mode,
        }).gradient;
        const gxMinus = gradientModel({
          values: [x - h, y, 0.1],
          mode,
        }).gradient;
        const gyPlus = gradientModel({
          values: [x, y + h, 0.1],
          mode,
        }).gradient;
        const gyMinus = gradientModel({
          values: [x, y - h, 0.1],
          mode,
        }).gradient;
        closeVector(
          model.hessian[0],
          [
            (gxPlus[0] - gxMinus[0]) / (2 * h),
            (gyPlus[0] - gyMinus[0]) / (2 * h),
          ],
          7,
        );
        closeVector(
          model.hessian[1],
          [
            (gxPlus[1] - gxMinus[1]) / (2 * h),
            (gyPlus[1] - gyMinus[1]) / (2 * h),
          ],
          7,
        );
      }
  });
  it("distinguishes a stationary saddle from the actual minima", () => {
    const origin = gradientModel({ values: [0, 0, 0.25], mode: "valleys" });
    closeVector(origin.gradient, [0, 0]);
    expect(origin.hessian).toEqual([
      [-1, 0],
      [0, 1],
    ]);
    expect(origin.value).toBe(0.25);
    for (const t of [0.1, 0.01, -0.1]) {
      expect(energy("valleys", [t, 0])).toBeLessThan(origin.value);
      expect(energy("valleys", [0, t])).toBeGreaterThan(origin.value);
    }
    for (const x of [-1, 1]) {
      const m = gradientModel({ values: [x, 0, 0.25], mode: "valleys" });
      expect(m.value).toBe(0);
      closeVector(m.gradient, [0, 0]);
    }
  });
  it("checks safe bowl steps, an explicit overshoot, and honest boundary rejection", () => {
    for (const [x, y] of [
      [2.5, -2.5],
      [-1, 0],
      [0, 0.5],
      [0.25, -0.75],
    ])
      for (const alpha of [0.05, 0.25, 0.5, 0.95]) {
        const m = gradientModel({ values: [x, y, alpha], mode: "bowl" });
        expect(m.step.status).toBe("ok");
        expect(m.step.after).toBeLessThan(m.step.before);
      }
    const overshoot = gradientModel({ values: [0, 1, 1.2], mode: "bowl" });
    closeVector(overshoot.step.point, [0, -1.4]);
    expect(overshoot.step.after).toBeCloseTo(1.96, 12);
    const boundary = gradientModel({ values: [2.5, 0, 1.2], mode: "valleys" });
    expect(boundary.step.status).toBe("boundary");
    expect(boundary.step.point).toEqual([2.5, 0]);
    expect(boundary.step.after).toBe(boundary.step.before);
  });
  it("connects the gradient to derivative per unit distance in a specified direction", () => {
    const p: [number, number] = [1, 1],
      u = [0.6, 0.8],
      h = 1e-5;
    const m = gradientModel({ values: [...p, 0.1], mode: "bowl" });
    expect(Math.hypot(...u)).toBe(1);
    const numeric =
      (energy("bowl", [p[0] + h * u[0], p[1] + h * u[1]]) -
        energy("bowl", [p[0] - h * u[0], p[1] - h * u[1]])) /
      (2 * h);
    expect(dot(m.gradient, u)).toBeCloseTo(2.2, 12);
    expect(numeric).toBeCloseTo(2.2, 8);
  });
});

describe("R1 deterministic independent practice", () => {
  it.each(conceptIds)(
    "%s rejects invalid seeds before generating a task",
    (id) => {
      for (const seed of [
        0,
        -1,
        1.5,
        NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 1,
      ])
        expect(() => makePractice(id, seed)).toThrow();
    },
  );
  it.each(conceptIds)(
    "%s yields finite, reproducible and objectively gradeable examples over many seeds",
    (id) => {
      for (let seed = 1; seed < 256; seed++) {
        const p = makePractice(id, seed);
        expect(makePractice(id, seed)).toEqual(p);
        expect(p.labels).toHaveLength(p.expected.length);
        expect(p.expected.length).toBeGreaterThan(0);
        expect(p.expected.every(Number.isFinite)).toBe(true);
        expect(
          p.ruleOptions.filter(([key]) => key === p.correctRule),
        ).toHaveLength(1);
        expect(gradePractice(p, p.expected.map(String), p.correctRule)).toBe(
          true,
        );
        expect(
          gradePractice(
            p,
            p.expected.map((value) => String(value + 0.024)),
            p.correctRule,
          ),
        ).toBe(true);
        expect(
          gradePractice(
            p,
            p.expected.map((value) => String(value + 0.026)),
            p.correctRule,
          ),
        ).toBe(false);
        expect(gradePractice(p, p.expected.map(String), "always")).toBe(false);
        for (const answer of [
          "",
          " ",
          "NaN",
          "Infinity",
          "1e309",
          "not a number",
        ])
          expect(
            gradePractice(
              p,
              p.expected.map(() => answer),
              p.correctRule,
            ),
          ).toBe(false);
        expect(gradePractice(p, [], p.correctRule)).toBe(false);
      }
    },
  );
  it("keeps all generated rescue controls in the playable range and satisfies landing or projection invariants", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const p = makePractice("vectors", seed);
      expect(p.expected.every((value) => Math.abs(value) <= 10)).toBe(true);
      if (p.question.includes("Drone")) {
        const match = p.question.match(
          /P=\(([^)]+)\).*w=\(([^)]+)\).*T=\(([^)]+)\)/,
        )!;
        expect(match).not.toBeNull();
        const start = parseCoordinates(match[1]),
          wind = parseCoordinates(match[2]),
          target = parseCoordinates(match[3]);
        p.expected.forEach((control, i) =>
          expect(start[i] + control + wind[i]).toBe(target[i]),
        );
      } else {
        const match = p.question.match(/a=\(([^)]+)\).*b=\(([^)]+)\)/)!;
        const a = parseCoordinates(match[1]),
          b = parseCoordinates(match[2]);
        expect(p.expected[0] * b[1] - p.expected[1] * b[0]).toBe(0);
        expect(
          (a[0] - p.expected[0]) * b[0] + (a[1] - p.expected[1]) * b[1],
        ).toBe(0);
      }
    }
  });
  it("checks generated matrix answers against their stated matrices using elimination", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const p = makePractice("matrices", seed);
      const match = p.question.match(
        /rows \(([^)]+)\), \(([^)]+)\), \(([^)]+)\)\. For v=\(([^)]+)\)/,
      )!;
      const rows = [
        parseCoordinates(match[1]),
        parseCoordinates(match[2]),
        parseCoordinates(match[3]),
      ];
      const v = parseCoordinates(match[4]);
      expect(p.expected[0]).toBeCloseTo(
        eliminationDeterminant(rows.flat() as Mat3),
        10,
      );
      expect(p.expected[1]).toBe(
        rows[0].reduce((sum, value, i) => sum + value * v[i], 0),
      );
    }
  });
  it("checks generated square-rate answers from the difference-quotient definition", () => {
    for (let seed = 1; seed <= 255; seed++) {
      const p = makePractice("derivatives", seed);
      if (!p.question.includes("f(x)=x²")) continue;
      const match = p.question.match(/at x=([−\-\d.]+) and h=([\d.]+)/)!;
      const x = Number(match[1].replace("−", "-")),
        h = Number(match[2]);
      const tiny = 1 / 1024;
      const derivativeReference =
        ((x + tiny) ** 2 - (x - tiny) ** 2) / (2 * tiny);
      const secantReference = ((x + h) ** 2 - x * x) / h;
      expect(p.expected[0]).toBe(derivativeReference);
      expect(p.expected[1]).toBe(secantReference);
    }
  });
  it("checks generated gradient and descent answers by independent finite differences", () => {
    const value = (x: number, y: number) => (x * x + 2 * y * y) / 2;
    const h = 1 / 1024;
    for (let seed = 1; seed <= 255; seed++) {
      const p = makePractice("gradients", seed);
      if (p.question.startsWith("At (0,0)")) {
        expect(p.expected).toEqual([0, 0]);
        expect(
          p.ruleOptions.find(([key]) => key === p.correctRule)![1],
        ).toMatch(/saddle/i);
        continue;
      }
      const match = p.question.match(/at \(([^)]+)\)/)!;
      const [x, y] = parseCoordinates(match[1]);
      const gradientReference = [
        (value(x + h, y) - value(x - h, y)) / (2 * h),
        (value(x, y + h) - value(x, y - h)) / (2 * h),
      ];
      const expected = p.question.includes("take one gradient step")
        ? [x - 0.25 * gradientReference[0], y - 0.25 * gradientReference[1]]
        : gradientReference;
      closeVector(p.expected, expected, 12);
    }
  });
  it("includes distinct jump, cusp and derivative tasks and classifies the saddle honestly", () => {
    const derivativeTasks = [1, 17, 34].map((seed) =>
      makePractice("derivatives", seed),
    );
    expect(new Set(derivativeTasks.map((p) => p.question)).size).toBe(3);
    const jump = derivativeTasks[0],
      cusp = derivativeTasks[2];
    expect(jump.expected).toEqual([-1, 1]);
    expect(
      jump.ruleOptions.find(([key]) => key === jump.correctRule)![1],
    ).toMatch(/does not exist/i);
    expect(cusp.expected).toEqual([-1, 1]);
    expect(
      cusp.ruleOptions.find(([key]) => key === cusp.correctRule)![1],
    ).toMatch(/differ/i);
    const saddle = makePractice("gradients", 1);
    expect(saddle.expected).toEqual([0, 0]);
    expect(
      saddle.ruleOptions.find(([key]) => key === saddle.correctRule)![1],
    ).toMatch(/saddle/i);
    expect(gradePractice(saddle, ["0", "0"], "guess")).toBe(false);
  });
});

describe("R1 authored content and checked worked-example linkage", () => {
  it("keeps concept/prerequisite IDs valid, acyclic and distinct from human-review status", () => {
    const ids = new Set(conceptIds);
    for (const id of conceptIds) {
      const module = concepts[id];
      expect(module.id).toBe(id);
      expect(module.contentStatus).toBe("machine-checked");
      expect(module.workedExamples.length).toBeGreaterThanOrEqual(2);
      expect(module.derivationSteps.length).toBeGreaterThanOrEqual(3);
      expect(module.derivationSteps.length).toBeLessThanOrEqual(8);
      expect(module.assumptions.length).toBeGreaterThan(0);
      expect(module.proofOrCounterexample.trim().length).toBeGreaterThan(0);
      for (const prerequisite of module.prerequisiteIds)
        expect(ids.has(prerequisite)).toBe(true);
      const visit = (current: typeof id, path: Set<typeof id>) => {
        expect(path.has(current)).toBe(false);
        const next = new Set(path);
        next.add(current);
        concepts[current].prerequisiteIds.forEach((prerequisite) =>
          visit(prerequisite, next),
        );
      };
      visit(id, new Set());
    }
  });
  it("gives every visible proof line a stated justification, evidence kind and visual link", () => {
    for (const id of conceptIds) {
      const states = [
        defaults[id],
        ...concepts[id].workedExamples.map((example) => example.state),
      ];
      if (id === "vectors")
        states.push({ values: [0, 0, 3, 4, 2, 0, 0, 0], mode: "projection" });
      if (id === "derivatives")
        states.push(
          { values: [0, 0.1, 0.2], mode: "jump" },
          { values: [0, 0.1, 0.2], mode: "cusp" },
        );
      if (id === "gradients")
        states.push({ values: [0, 0, 0.25], mode: "valleys" });
      for (const state of states)
        for (const step of derivationFor(id, state)) {
          expect(step.statement.trim()).not.toBe("");
          expect(step.justification.trim()).not.toBe("");
          expect(step.linkedVisualState.trim()).not.toBe("");
          expect([
            "definition",
            "algebra",
            "theorem",
            "limit",
            "calculation",
            "example",
          ]).toContain(step.rule);
        }
    }
  });
  it("checks both published worked states for each base concept against independent numerical fixtures", () => {
    concepts.vectors.workedExamples.forEach((example) => {
      expect(validState("vectors", example.state)).toBe(true);
      expect(vectorModel(example.state.values).error).toBe(0);
    });
    const matrixExpected = [
      { image: [4, 2, 3], det: 2 },
      { image: [-2, -2, 3], det: -2 },
    ];
    concepts.matrices.workedExamples.forEach((example, i) => {
      const model = matrixModel(example.state.values);
      expect(model.image).toEqual(matrixExpected[i].image);
      expect(model.det).toBe(matrixExpected[i].det);
    });
    const curveExpected = [
      { slope: 4, secant: 4.5 },
      { slope: -2, secant: -1.75 },
    ];
    concepts.derivatives.workedExamples.forEach((example, i) => {
      const model = slopeModel(example.state);
      expect(model.slope).toBe(curveExpected[i].slope);
      expect(model.secant).toBe(curveExpected[i].secant);
    });
    const energyExpected = [17 / 32, 89 / 50];
    concepts.gradients.workedExamples.forEach((example, i) =>
      expect(gradientModel(example.state).step.after).toBeCloseTo(
        energyExpected[i],
        12,
      ),
    );
  });
  it("switches the claim and proof when selecting a counterexample objective", () => {
    const valleys = { values: [0, 0, 0.25], mode: "valleys" };
    expect(claimFor("gradients", valleys)).toMatch(/saddle/i);
    const steps = derivationFor("gradients", valleys);
    expect(steps[0].statement).toMatch(/^F=/);
    expect(steps.some((step) => step.statement.includes("F(t,0)"))).toBe(true);
    expect(steps.some((step) => step.statement.includes("F(0,t)"))).toBe(true);
    expect(steps[steps.length - 1].statement).toMatch(
      /neither.*minimum.*maximum/i,
    );
    expect(
      claimFor("derivatives", { values: [0, 0.1, 0.2], mode: "jump" }),
    ).toMatch(/x=0.*one-sided/i);
    expect(
      claimFor("derivatives", { values: [0, 0.1, 0.2], mode: "cusp" }),
    ).toMatch(/continuous.*derivative does not exist/i);
    expect(
      claimFor("vectors", { ...defaults.vectors, mode: "projection" }),
    ).toMatch(/nonzero.*perpendicular/i);
  });
  it("checks both published projection examples and their orthogonal residuals", () => {
    const examples = examplesFor("vectors", {
      ...defaults.vectors,
      mode: "projection",
    });
    expect(examples).toHaveLength(2);
    const expected = [
      { projected: [3, 0, 0], residual: [0, 4, 0] },
      { projected: [3, 3, 0], residual: [1, -1, 0] },
    ];
    examples.forEach((example, i) => {
      const m = vectorModel(example.state.values);
      closeVector(m.projected!, expected[i].projected);
      closeVector(m.residual!, expected[i].residual);
      expect(m.orthogonality).toBeCloseTo(0, 12);
    });
  });
});
