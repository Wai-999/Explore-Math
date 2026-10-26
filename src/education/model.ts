import {
  add,
  scale,
  projection,
  dot,
  determinant,
  transform,
  type Mat3,
  type Vec3,
} from "../math/linear";
import { energy, gradient, descent, type SurfaceKind } from "../math/calculus";
import { seeded } from "../assessment/challenges";
const sub = (a: Vec3, b: Vec3): Vec3 => add(a, scale(b, -1));
export type ConceptId = "vectors" | "matrices" | "derivatives" | "gradients";
export type Lens = "discover" | "understand" | "justify" | "apply";
export interface SemanticState {
  values: number[];
  mode: string;
}
export const conceptIds: ConceptId[] = [
  "vectors",
  "matrices",
  "derivatives",
  "gradients",
];
export const defaults: Record<ConceptId, SemanticState> = {
  vectors: { values: [0, 0, 2, 1, 1, 2, 4, 4], mode: "addition" },
  matrices: { values: [1, 0.5, 0, 1, 1, 1, 2, 1], mode: "matrix" },
  derivatives: { values: [1, 0.5, 0.2], mode: "square" },
  gradients: { values: [1, 1, 0.25], mode: "bowl" },
};
export function validState(id: ConceptId, s: unknown): s is SemanticState {
  if (!conceptIds.includes(id) || !s || typeof s !== "object") return false;
  const v = s as SemanticState;
  const modes = {
    vectors: ["addition", "projection"],
    matrices: ["matrix"],
    derivatives: ["square", "jump", "cusp"],
    gradients: ["bowl", "valleys"],
  };
  return (
    modes[id].includes(v.mode) &&
    Array.isArray(v.values) &&
    v.values.length === defaults[id].values.length &&
    Array.from(v.values).every(Number.isFinite) &&
    (id === "vectors"
      ? v.values.every((n) => Math.abs(n) <= 10)
      : id === "matrices"
        ? v.values.every((n) => Math.abs(n) <= 3)
        : id === "derivatives"
          ? Math.abs(v.values[0]) <= 2 &&
            Math.abs(v.values[1]) <= 1 &&
            v.values[2] >= 0.01 &&
            v.values[2] <= 1
          : Math.abs(v.values[0]) <= 2.5 &&
            Math.abs(v.values[1]) <= 2.5 &&
            v.values[2] >= 0.05 &&
            v.values[2] <= 1.2)
  );
}
export function vectorModel(values: number[]) {
  if (!validState("vectors", { values, mode: "addition" }))
    throw Error("Vector coordinates must be eight finite values in [−10,10].");
  const p: Vec3 = [values[0], values[1], 0],
    u: Vec3 = [values[2], values[3], 0],
    w: Vec3 = [values[4], values[5], 0],
    target: Vec3 = [values[6], values[7], 0];
  const landing = add(add(p, u), w),
    projected = projection(u, w);
  return {
    p,
    u,
    w,
    target,
    landing,
    required: sub(sub(target, p), w),
    error: Math.hypot(...sub(landing, target)),
    projected,
    residual: projected ? sub(u, projected) : null,
    orthogonality: projected ? dot(sub(u, projected), w) : null,
  };
}
export function matrixModel(values: number[]) {
  if (!validState("matrices", { values, mode: "matrix" }))
    throw Error(
      "Matrix and probe values must be eight finite values in [−3,3].",
    );
  const [a, b, c, d, z, x, y, vz] = values;
  const matrix: Mat3 = [a, b, 0, c, d, 0, 0, 0, z],
    probe: Vec3 = [x, y, vz];
  return {
    matrix,
    probe,
    image: transform(matrix, probe),
    det: determinant(matrix),
    area: a * d - b * c,
    columns: [
      [a, c, 0],
      [b, d, 0],
      [0, 0, z],
    ] as Vec3[],
  };
}
export function functionValue(mode: string, x: number) {
  if (!["square", "jump", "cusp"].includes(mode) || !Number.isFinite(x))
    throw Error("Use a supported finite function input.");
  return mode === "jump"
    ? x < 0
      ? -1
      : 1
    : mode === "cusp"
      ? Math.abs(x)
      : x * x;
}
export function slopeModel(s: SemanticState) {
  if (!validState("derivatives", s))
    throw Error("Invalid derivative experiment or bounded domain.");
  const [x, h, epsilon] = s.values,
    y = functionValue(s.mode, x);
  const slope =
    s.mode === "square"
      ? 2 * x
      : s.mode === "cusp"
        ? x === 0
          ? null
          : Math.sign(x)
        : x === 0
          ? null
          : 0;
  return {
    x,
    h,
    epsilon,
    y,
    other: functionValue(s.mode, x + h),
    secant:
      h === 0
        ? null
        : s.mode === "square"
          ? 2 * x + h
          : (functionValue(s.mode, x + h) - y) / h,
    rawQuotient: h === 0 ? null : (functionValue(s.mode, x + h) - y) / h,
    slope,
    delta:
      s.mode === "square"
        ? Math.min(1, epsilon / (2 * Math.abs(x) + 1))
        : s.mode === "cusp"
          ? epsilon
          : x === 0
            ? null
            : Math.min(1, Math.abs(x)),
  };
}
export function gradientModel(s: SemanticState) {
  if (!validState("gradients", s))
    throw Error("Invalid gradient experiment or bounded domain.");
  const [x, y, alpha] = s.values,
    kind = s.mode as SurfaceKind,
    point: [number, number] = [x, y];
  return {
    point,
    value: energy(kind, point),
    gradient: gradient(kind, point),
    hessian:
      kind === "bowl"
        ? [
            [1, 0],
            [0, 2],
          ]
        : [
            [3 * x * x - 1, 0],
            [0, 1],
          ],
    step: descent(kind, point, alpha),
  };
}
export interface Practice {
  question: string;
  labels: string[];
  expected: number[];
  ruleQuestion: string;
  ruleOptions: [string, string][];
  correctRule: string;
  hint: string;
  solution: string;
  rubric: string;
}
export function makePractice(id: ConceptId, seed: number): Practice {
  if (!Number.isSafeInteger(seed) || seed < 1)
    throw Error("Use a positive safe-integer seed.");
  const random = seeded(seed),
    integer = (lo: number, hi: number) =>
      lo + Math.floor(random() * (hi - lo + 1)),
    variant = Math.floor(seed / 17) % 3;
  const ruleOptions: [string, string][] = [
    ["principle", "Use the stated rule under its assumptions"],
    ["guess", "A picture proves every case"],
    ["always", "The rule has no restrictions"],
  ];
  const common = {
    ruleQuestion: "Which standard justifies the result?",
    ruleOptions,
    correctRule: "principle",
    rubric:
      "Name the rule, its assumptions, what the numbers mean, and one limit of the model.",
  };
  if (id === "vectors") {
    if (variant === 2) {
      const a = [integer(2, 6), integer(-3, 3)],
        b = integer(1, 3);
      return {
        ...common,
        question: `Project a=(${a}) onto b=(${b},0). Give both projection coordinates. All coordinates are meters.`,
        labels: ["Projection x (m)", "Projection y (m)"],
        expected: [a[0], 0],
        hint: "Write p=t b and make (a−p)·b=0. The direction b must be nonzero.",
        solution: `t=${a[0] / b}, so p=(${a[0]},0). The residual is (0,${a[1]}), perpendicular to b.`,
      };
    }
    const p = [integer(-2, 2), integer(-2, 2)],
      w = [integer(-2, 2), integer(-2, 2)],
      target = [integer(3, 6), integer(3, 6)],
      u = target.map((t, i) => t - p[i] - w[i]);
    return {
      ...common,
      question: `Drone displacement model: start P=(${p}) m, wind w=(${w}) m, target T=(${target}) m. Choose control u so P+u+w=T. No thrust/fuel constraint is modeled.`,
      labels: ["Control x (m)", "Control y (m)"],
      expected: u,
      hint: "Subtract the start and wind component by component: u=T−P−w.",
      solution: `u=(${u}) m. Substitution gives P+u+w=(${target}) m.`,
    };
  }
  if (id === "matrices") {
    const a = integer(-2, 3),
      b = integer(-2, 2),
      c = integer(-2, 2),
      d = integer(1, 3),
      x = integer(1, 3),
      y = integer(-2, 2);
    return {
      ...common,
      question: `A has rows (${a},${b},0), (${c},${d},0), (0,0,1). For v=(${x},${y},1), find det(A) and the first coordinate of Av.`,
      labels: ["Signed volume scale det(A)", "First coordinate of Av"],
      expected: [a * d - b * c, a * x + b * y],
      hint: "Columns are images of the basis. This block matrix has det(A)=ad−bc; multiply the first row by v for its first output.",
      solution: `det(A)=${a * d - b * c}; (Av)₁=${a}×${x}+${b}×${y}=${a * x + b * y}. Determinant is volume scale, not a guarantee of length preservation.`,
    };
  }
  if (id === "derivatives") {
    if (variant === 2)
      return {
        ...common,
        question:
          "For f(x)=|x| at x=0, find the left and right difference-quotient limits. Does one derivative exist?",
        labels: ["Left quotient limit", "Right quotient limit"],
        expected: [-1, 1],
        ruleOptions: [
          ["principle", "No: the one-sided derivative limits differ"],
          ["guess", "Yes: continuity guarantees differentiability"],
          ["always", "Yes: every graph has a tangent"],
        ],
        hint: "For h<0, |h|/h=−1; for h>0 it is +1.",
        solution:
          "The limits are −1 and +1. The function is continuous at 0, but its derivative there does not exist.",
      };
    if (variant === 0)
      return {
        ...common,
        question:
          "For f(x)=−1 when x<0 and f(x)=1 when x≥0, find the left and right function limits at 0.",
        labels: ["Left function limit", "Right function limit"],
        expected: [-1, 1],
        ruleOptions: [
          ["principle", "The two-sided limit does not exist"],
          ["guess", "The limit is the value f(0)=1"],
          ["always", "Two samples prove the limit is 0"],
        ],
        hint: "A two-sided limit requires the two one-sided limits to agree.",
        solution:
          "Left limit −1; right limit +1. They differ, so there is no two-sided limit. Assigning f(0) does not repair the jump.",
      };
    const x = integer(-2, 2),
      h = integer(1, 3) / 4;
    return {
      ...common,
      question: `For f(x)=x² at x=${x} and h=${h}, give the exact derivative and the nonzero-gap secant slope. Variables are unitless.`,
      labels: ["Exact derivative f′(x)", "Secant slope"],
      expected: [2 * x, 2 * x + h],
      hint: "For h≠0 the quotient simplifies to 2x+h. Its limit, not substitution into 0/0, gives 2x.",
      solution: `f′(${x})=${2 * x}; the secant is ${2 * x + h}. Its error is |h|=${h}.`,
    };
  }
  if (variant === 0)
    return {
      ...common,
      question:
        "At (0,0), F=(x²−1)²/4+y²/2 has which two gradient components? How should this stationary point be interpreted?",
      labels: ["∂F/∂x", "∂F/∂y"],
      expected: [0, 0],
      ruleOptions: [
        ["principle", "A saddle: lower and higher nearby values exist"],
        ["guess", "A minimum: the gradient is zero"],
        ["always", "A maximum: the height is positive"],
      ],
      hint: "F(t,0)<F(0,0) and F(0,t)>F(0,0) for sufficiently small nonzero t.",
      solution:
        "∇F=(0,0), but the Hessian is diag(−1,1). Opposite curvature directions make this a saddle.",
    };
  const x = integer(-2, 2),
    y = integer(-2, 2) / 2;
  return variant === 1
    ? {
        ...common,
        question: `For E=(x²+2y²)/2 at (${x},${y}), give both gradient components.`,
        labels: ["∂E/∂x", "∂E/∂y"],
        expected: [x, 2 * y],
        hint: "Differentiate in x with y fixed, then in y with x fixed.",
        solution: `∇E=(${x},${2 * y}). A small downhill displacement subtracts a positive multiple of this gradient.`,
      }
    : {
        ...common,
        question: `For E=(x²+2y²)/2 at (${x},${y}), take one gradient step with α=0.25. Give the next point.`,
        labels: ["Next x", "Next y"],
        expected: [0.75 * x, 0.5 * y],
        hint: "Subtract α(x,2y); the coordinate factors are (1−α) and (1−2α).",
        solution: `The next point is (${0.75 * x},${0.5 * y}). For this bowl, 0<α<1 guarantees convergence from every starting point.`,
      };
}
export function gradePractice(p: Practice, answers: string[], rule: string) {
  return (
    answers.length === p.expected.length &&
    answers.every(
      (s, i) =>
        s.trim() !== "" &&
        Number.isFinite(Number(s)) &&
        Math.abs(Number(s) - p.expected[i]) <= 0.025,
    ) &&
    rule === p.correctRule
  );
}
