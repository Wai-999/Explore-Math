import { defaults } from "../schema";
import { clamp } from "../math";
import {
  f,
  pair,
  proof,
  type Analysis,
  type Definition,
  type Pair,
  type Params,
} from "../types";
export function marketingValues(p: Params) {
  const increment =
      p.a * -Math.expm1(-p.k1 * p.x) + p.b * -Math.expm1(-p.k2 * p.y),
    marginals: Pair = [
      p.a * p.k1 * Math.exp(-p.k1 * p.x),
      p.b * p.k2 * Math.exp(-p.k2 * p.y),
    ];
  return {
    increment,
    total: p.baseline + increment,
    net: p.margin * increment - p.x - p.y,
    marginals,
    gradient: marginals.map((v) => p.margin * v - 1) as Pair,
  };
}
export function marketingOptimum(p: Params, fixed = false) {
  const lo = Math.max(p.minimum, p.budget - 100),
    hi = Math.min(100, p.budget - p.minimum);
  if (fixed) {
    const x = clamp(
      (Math.log((p.a * p.k1) / (p.b * p.k2)) + p.k2 * p.budget) / (p.k1 + p.k2),
      lo,
      hi,
    );
    return {
      point: [x, p.budget - x] as Pair,
      method: "Equal free marginal response, then check endpoints",
    };
  }
  const spend = (lambda: number): Pair => [
    clamp(
      Math.log((p.margin * p.a * p.k1) / (1 + lambda)) / p.k1,
      p.minimum,
      100,
    ),
    clamp(
      Math.log((p.margin * p.b * p.k2) / (1 + lambda)) / p.k2,
      p.minimum,
      100,
    ),
  ];
  let result = spend(0);
  if (result[0] + result[1] <= p.budget)
    return {
      point: result,
      method: "Budget is slack: extra spend would reduce modeled net value",
    };
  let a = 0,
    b = 1;
  while (spend(b)[0] + spend(b)[1] > p.budget) b *= 2;
  for (let i = 0; i < 80; i++) {
    const mid = (a + b) / 2,
      v = spend(mid);
    if (v[0] + v[1] > p.budget) a = mid;
    else b = mid;
  }
  result = spend(b);
  return {
    point: result,
    method: "Positive budget multiplier; bounds and total spend checked",
  };
}
export function randomizedLift(t: number, nt: number, c: number, nc: number) {
  if (
    ![t, nt, c, nc].every(Number.isFinite) ||
    nt <= 0 ||
    nc <= 0 ||
    t < 0 ||
    c < 0 ||
    t > nt ||
    c > nc
  )
    throw Error("Invalid randomized counts");
  const pt = t / nt,
    pc = c / nc,
    lift = pt - pc,
    se = Math.sqrt((pt * (1 - pt)) / nt + (pc * (1 - pc)) / nc);
  return { lift, se, interval: [lift - 1.96 * se, lift + 1.96 * se] as Pair };
}
const feasible = (p: Params) =>
  p.x >= p.minimum - 1e-8 &&
  p.y >= p.minimum - 1e-8 &&
  p.x + p.y <= p.budget + 1e-8;
function analyze(p: Params): Analysis {
  const v = marketingValues(p),
    a = randomizedLift(105, 1000, 100, 1000),
    b = randomizedLift(120, 1000, 80, 1000);
  return {
    value: v.net,
    gradient: v.gradient,
    hessian: [
      [-p.margin * p.a * p.k1 ** 2 * Math.exp(-p.k1 * p.x), 0],
      [0, -p.margin * p.b * p.k2 ** 2 * Math.exp(-p.k2 * p.y)],
    ],
    matrix: [[1, 1]],
    matrixLabel:
      "cᵀ=[1,1] multiplies the 2×1 spend vector. cᵀx is total $/day; it must not exceed the budget.",
    feasible: feasible(p),
    metrics: [
      [
        "Bounded ceiling sensitivity",
        `${f(marketingValues({ ...p, a: clamp(p.a * (1 - p.uncertainty), 5, 60), b: clamp(p.b * (1 - p.uncertainty), 5, 60) }).net)} to ${f(marketingValues({ ...p, a: clamp(p.a * (1 + p.uncertainty), 5, 60), b: clamp(p.b * (1 + p.uncertainty), 5, 60) }).net)} $/day; scenario range, not confidence interval`,
      ],
      ["Baseline", f(p.baseline) + " conversions/day"],
      ["Modeled incremental response", f(v.increment) + " conversions/day"],
      ["Total modeled response", f(v.total) + " conversions/day"],
      ["Net value", f(v.net) + " $/day"],
      ["Total spend", `${f(p.x + p.y)}/${f(p.budget)} $/day`],
      ["Marginal response A, B", pair(v.marginals) + " conversions/$"],
    ],
    interpretation:
      "The first dollars have larger marginal response. Baseline is reported separately and is removed from modeled net value. A budget ceiling does not require spending every dollar.",
    warnings: [
      ...(!feasible(p)
        ? ["Spending violates the budget or a minimum-spend constraint."]
        : []),
      `Synthetic randomized holdouts: A lift ${f(a.lift * 100)} percentage points; normal-approximation 95% interval ${pair(a.interval.map((v) => 100 * v))}. B lift ${f(b.lift * 100)} points, interval ${pair(b.interval.map((v) => 100 * v))}.`,
      "Sensitivity scenarios scale both response ceilings within their stated 5–60 bounds. This assumption range is not posterior or sampling uncertainty.",
      "A has 160 last-click attributions and B only 50 in the toy report. Attribution is not incremental lift. Random assignment, no interference and the stated observation window are assumptions, not verified field evidence.",
    ],
  };
}
export const definition: Definition = {
  id: "marketing",
  title: "Marketing Mix Sandbox",
  question:
    "How should two channels share a budget without mistaking attribution for causation?",
  analogy:
    "Two watering cans help two garden beds. The first cup helps a lot; an already-wet bed benefits less. Spend on the next useful cup, and compare with a garden that received no extra water.",
  output: "Net value ($/day)",
  assumptions: [
    "Illustrative diminishing-return parameters; not fitted marketing-mix estimates.",
    "Spend x,y is $/day. Positive response ceilings are conversions/day; k has units day/$. Baseline is separate from modeled incrementality.",
    "Budget and channel minimums are explicit. This separable response omits channel interactions, adstock, saturation changes, selection bias and market feedback.",
  ],
  glossary: [
    ["x,y,B_budget", "Channel spend and total budget, $/day"],
    ["A₁,A₂,k₁,k₂", "Ceiling conversions/day; response-rate day/$"],
    ["B,Y,I", "Baseline, total and modeled incremental conversions/day"],
    ["m,G,λ", "Margin $/conversion, net $/day, budget multiplier"],
  ],
  limit:
    "Response parameters are assumptions, not real causal estimates. ROAS or last-click credit is not causal proof. The small randomized example uses a normal-approximation interval, not a powered experiment design or guaranteed future effect.",
  formula: String.raw`Y=B+A_1(1-e^{-k_1x})+A_2(1-e^{-k_2y}),\quad G=m(Y-B)-x-y`,
  predict:
    "For positive response parameters, how does the next dollar's response change as spend grows?",
  predictionChoices: [
    ["diminish", "Response rises, but the marginal response declines"],
    ["constant", "Each additional dollar always has the same effect"],
  ],
  predictionAnswer: "diminish",
  feasible,
  analyze,
  scalar: (p, x, y) => marketingValues({ ...p, x, y }).net,
  derive: (p) => [
    proof(
      "I=Y−B=A₁(1−exp(−k₁x))+A₂(1−exp(−k₂y))",
      "Subtract the baseline before assigning modeled incremental value.",
      "definition",
    ),
    proof(
      "∂Y/∂x=A₁k₁exp(−k₁x); ∂²Y/∂x²=−A₁k₁²exp(−k₁x)<0",
      "Differentiate the exponential. Positive parameters give increasing response and diminishing marginals.",
      "algebra",
      "gradient",
    ),
    proof(
      "∇G=m∇Y−(1,1)",
      "Each dollar of spend also costs one dollar. Baseline drops out of the derivative.",
      "algebra",
      "gradient",
    ),
    proof(
      "For fixed full budget and free interior channels: Yₓ=Yᵧ",
      "A small transfer (+δ,−δ) changes response by δ(Yₓ−Yᵧ). Balance the free marginals, then check endpoints.",
      "algebra",
      "constraints",
    ),
    proof(
      "For an at-most budget: bound-aware marginals equal 1+λ, λ≥0",
      "The budget may be slack (λ=0). If active, solve total spend and check channel bounds; strict concavity establishes the optimum under these assumptions.",
      "theorem",
      "constraints",
    ),
    proof(
      `Current ∇G=${pair(marketingValues(p).gradient)}; cᵀx=${f(p.x + p.y)}`,
      "This numerical instance checks the model, not the empirical truth of its coefficients.",
      "calculation",
    ),
  ],
  examples: [
    {
      title: "Zero spend separates baseline",
      params: { x: 0, y: 0 },
      steps: [
        "Each 1−exp(0)=0, so incremental response I=0.",
        "Total Y equals the 20 conversions/day baseline.",
        "G=5×0−0−0=0 $/day; baseline conversions are not claimed as campaign lift.",
      ],
    },
    {
      title: "A small channel-A experiment",
      params: {
        x: 10,
        y: 0,
        a: 30,
        b: 20,
        k1: 0.03,
        k2: 0.02,
        margin: 5,
        baseline: 20,
      },
      steps: [
        "I=30(1−exp(−0.3))≈7.77545 conversions/day.",
        "Total Y≈27.77545; the baseline remains 20.",
        "G=5I−10≈28.87727 $/day. These are model calculations, not observed campaign outcomes.",
      ],
    },
  ],
  edge: {
    title: "Why unused budget can be rational",
    params: {
      x: 50.135913,
      y: 34.657359,
      budget: 100,
      minimum: 0,
      a: 30,
      b: 20,
      k1: 0.03,
      k2: 0.02,
      margin: 5,
    },
    explanation:
      "At the unconstrained net-value optimum both free marginal values are approximately zero and spend is only 84.79 $/day. Forcing the whole 100-dollar budget changes the objective. Min-spend bounds can also prevent interior marginal equality.",
  },
  mission: (seed, level) => {
    const p = {
      ...defaults("marketing"),
      a: 25 + (seed % 11),
      b: 18 + (seed % 7),
      budget: 80 + (seed % 21),
      minimum: level === 2 ? 10 : 0,
      x: 20,
      y: 20,
    };
    const opt = marketingOptimum(p, level === 1),
      best = marketingValues({ ...p, x: opt.point[0], y: opt.point[1] });
    return {
      params: p,
      question:
        level === 1
          ? "Spend the full budget (±0.02 $/day) and get modeled response within 0.02 conversions/day of the best allocation."
          : level === 2
            ? "Maximize net value under the at-most budget and minimums; reach within 0.1 $/day of the bound-aware optimum."
            : "Choose a feasible allocation and interpret the synthetic holdouts: why can 160 last-click credits coexist with uncertain incremental lift?",
      hint: "Compare free marginal responses. For net value also subtract spend cost; a budget can remain unused. Attribution counts cannot replace randomized comparison.",
      solution: `Allocation ${pair(opt.point)} $/day; ${opt.method}. Synthetic A lift is 0.5 percentage points with an interval crossing zero; B lift is 4 points. Neither last-click count is causal proof.`,
      choices: [
        [
          "principle",
          "Respect marginal value and constraints; use valid randomized comparisons for incrementality",
        ],
        [
          "attribution",
          "Allocate to the highest last-click credit because that proves causal lift",
        ],
      ],
      correctRule: "principle",
      grade: (q) => {
        const v = marketingValues(q),
          ok =
            feasible(q) &&
            (level === 1
              ? Math.abs(q.x + q.y - q.budget) <= 0.02 &&
                v.increment >= best.increment - 0.02
              : level === 2
                ? v.net >= best.net - 0.1
                : true);
        return {
          correct: ok,
          feedback: ok
            ? "Objective met. Explain the active bounds and distinguish a modeled response from randomized evidence."
            : `Not yet. Spend ${f(q.x + q.y)}/${q.budget}; increment ${f(v.increment)}; net ${f(v.net)}. Budget feasibility alone does not prove optimality.`,
        };
      },
    };
  },
  lines: (p, to) => {
    const a = Math.max(0, p.budget - 100),
      b = Math.min(100, p.budget);
    return [
      {
        points: Array.from({ length: 31 }, (_, i) => {
          const x = a + ((b - a) * i) / 30,
            y = p.budget - x;
          return to(x, y, marketingValues({ ...p, x, y }).net);
        }),
        color: "#e9c7a2",
        label: "budget constraint x+y=B",
      },
    ];
  },
  python: (p) =>
    `# Synthetic response; no real causal parameter estimation.\nfrom math import exp\nx, y, a, b, k1, k2, margin = ${p.x}, ${p.y}, ${p.a}, ${p.b}, ${p.k1}, ${p.k2}, ${p.margin}\nincrement = a*(1-exp(-k1*x))+b*(1-exp(-k2*y))\nprint(margin*increment-x-y)\n`,
  related: {
    url: "#/explore/prediction/demand",
    label: "Continue to the full prediction-and-decision workflow",
  },
};
