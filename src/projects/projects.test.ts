import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  MAX_PROJECT_BYTES,
  parseProject,
  serializeProject,
  validProject,
  validProjectCollection,
  type TemplateId,
} from "./schema";
import {
  costModel,
  newProject,
  projectCode,
  projectReport,
  vectorModel,
} from "./templates";
const at = "2026-10-25T00:00:00.000Z";
const fixture = (template: TemplateId = "vector-navigation") =>
  newProject(template, `fixture-${template}`, at);
describe("safe project specifications", () => {
  it.each(["vector-navigation", "quadratic-cost"] as TemplateId[])(
    "%s roundtrips without losing narrative or objective evidence",
    (template) => {
      const p = {
        ...fixture(template),
        prediction: "A single parameter change should alter the result.",
        reflection: "I checked the units, assumptions, and one boundary case.",
      };
      expect(parseProject(serializeProject(p))).toEqual(p);
      expect(validProjectCollection([p])).toBe(true);
    },
  );
  it("rejects malformed, oversized, future-version and extra-field input", () => {
    const p = fixture();
    for (const x of [
      "{",
      JSON.stringify({ ...p, version: 2 }),
      JSON.stringify({ ...p, extra: "ignored?" }),
      JSON.stringify({ ...p, parameters: { ...p.parameters, nextOutcome: 5 } }),
      JSON.stringify({ ...p, title: "  " }),
      JSON.stringify({ ...p, units: "km" }),
      JSON.stringify({ ...p, updatedAt: "not a date" }),
      JSON.stringify({ ...p, evidence: { ...p.evidence, attempts: -1 } }),
    ])
      expect(() => parseProject(x)).toThrow();
    expect(() => parseProject(" ".repeat(MAX_PROJECT_BYTES + 1))).toThrow(
      /250 KB/,
    );
    expect(() =>
      parseProject(JSON.stringify({ ...p, question: "😀".repeat(64000) })),
    ).toThrow(/250 KB/);
  });
  it("enforces finite numeric ranges and template parameters", () => {
    const p = fixture("quadratic-cost");
    for (const parameters of [
      { ...p.parameters, a: 0 },
      { ...p.parameters, q: 21 },
      { ...p.parameters, b: Infinity },
      { ...p.parameters, q: NaN },
      { ...p.parameters, c: "400" },
    ])
      expect(validProject({ ...p, parameters })).toBe(false);
    expect(validProject({ ...fixture(), parameters: [] })).toBe(false);
  });
  it("rejects duplicate project identities and overfull collections", () => {
    const p = fixture();
    expect(validProjectCollection([p, p])).toBe(false);
    expect(
      validProjectCollection(
        Array.from({ length: 21 }, (_, i) => ({ ...p, id: `id-${i}` })),
      ),
    ).toBe(false);
  });
  it("keeps hinted and manually reviewed records explicit", () => {
    const p = fixture();
    p.reflection = "I connected the calculation to its units and limitations.";
    p.evidence = {
      attempts: 1,
      hintUsed: true,
      goalMet: true,
      selfChecked: true,
      checkedAt: at,
    };
    expect(parseProject(serializeProject(p)).evidence.hintUsed).toBe(true);
    expect(projectReport(p)).toContain(
      "learner self-checked, not independently reviewed",
    );
    expect(
      validProject({ ...p, evidence: { ...p.evidence, checkedAt: null } }),
    ).toBe(false);
  });
});
describe("vector-navigation model", () => {
  it("matches a worked coordinate example and exactly reaches its target", () => {
    const p = fixture(),
      r = vectorModel(p.parameters);
    expect(r.landing).toEqual([-1, 0, 0]);
    expect(r.required).toEqual([6, 3, 0]);
    expect(r.error).toBeCloseTo(Math.sqrt(45), 12);
    expect(
      vectorModel({ ...p.parameters, controlX: 6, controlY: 3 }),
    ).toMatchObject({ landing: [5, 3, 0], error: 0, goalMet: true });
  });
  it("handles zero wind/opposite displacements and all extremal reachable controls", () => {
    const p = fixture();
    expect(
      vectorModel({
        ...p.parameters,
        startX: 0,
        startY: 0,
        windX: 0,
        windY: 0,
        controlX: 0,
        controlY: 0,
        targetX: 0,
        targetY: 0,
      }).goalMet,
    ).toBe(true);
    for (const start of [-10, 10])
      for (const wind of [-10, 10])
        for (const target of [-10, 10]) {
          const control = target - start - wind;
          expect(
            vectorModel({
              ...p.parameters,
              startX: start,
              windX: wind,
              targetX: target,
              controlX: control,
              startY: 0,
              windY: 0,
              targetY: 0,
              controlY: 0,
            }).error,
          ).toBe(0);
        }
  });
});
describe("convex cost model", () => {
  it("matches the interior worked optimum and independent boundary cases", () => {
    const p = fixture("quadratic-cost").parameters;
    expect(costModel(p)).toMatchObject({
      value: 380,
      derivative: 8,
      optimum: 6,
      minimum: 364,
      gap: 16,
      goalMet: false,
    });
    expect(costModel({ ...p, q: 6 }).goalMet).toBe(true);
    expect(costModel({ ...p, b: 4 })).toMatchObject({
      optimum: 0,
      minimum: 400,
    });
    expect(costModel({ ...p, a: 0.25, b: -20 })).toMatchObject({
      optimum: 20,
      minimum: 100,
    });
  });
  it("agrees with a fine-grid reference and finite-difference derivative", () => {
    const defaults = fixture("quadratic-cost").parameters;
    for (let i = 0; i < 12; i++) {
      const p: Record<string, number> = {
        ...defaults,
        a: 0.25 + i * 0.2,
        b: -20 + i * 2.5,
        q: 2 + i,
      };
      const model = costModel(p);
      let gridMin = Infinity;
      for (let k = 0; k <= 20000; k++) {
        const q = k / 1000;
        gridMin = Math.min(gridMin, p.a * q * q + p.b * q + p.c);
      }
      expect(model.minimum).toBeLessThanOrEqual(gridMin + 1e-10);
      expect(gridMin - model.minimum).toBeLessThan(0.00001);
      const h = 1e-5,
        f = (q: number) => p.a * q * q + p.b * q + p.c;
      expect(model.derivative).toBeCloseTo(
        (f(p.q + h) - f(p.q - h)) / (2 * h),
        5,
      );
    }
  });
});
describe("portable project artifacts", () => {
  it.each(["vector-navigation", "quadratic-cost"] as TemplateId[])(
    "%s audited Python reproduces the mathematical fixture",
    (template) => {
      const p = fixture(template),
        source = projectCode(p);
      const output = JSON.parse(
        execFileSync("python3", ["-c", source], { encoding: "utf8" }),
      );
      if (template === "vector-navigation") {
        const r = vectorModel(p.parameters);
        expect(output.landing).toEqual(r.landing.slice(0, 2));
        expect(output.required).toEqual(r.required.slice(0, 2));
        expect(output.error).toBeCloseTo(r.error, 12);
      } else {
        const r = costModel(p.parameters);
        expect(output).toEqual({
          cost: r.value,
          derivative: r.derivative,
          optimum: r.optimum,
          minimum: r.minimum,
        });
      }
    },
  );
  it("never inserts narrative or imported code into executable templates", () => {
    const p = {
      ...fixture(),
      title: "__import__('os').system('bad')",
      reflection: "<script>bad</script>",
    };
    expect(projectCode(p)).not.toContain("__import__");
    expect(projectCode(p)).not.toContain("script");
    const report = projectReport(p);
    expect(report).toContain("\n\n## Question\n");
    expect(report).toContain("&lt;script&gt;");
    expect(report).toContain("Position error");
  });
});
