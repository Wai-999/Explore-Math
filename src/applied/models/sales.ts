import { defaults } from "../schema";
import { clip, quadraticMaximum } from "../math";
import {
  f,
  pair,
  proof,
  type Analysis,
  type Definition,
  type Matrix2,
  type Pair,
  type Params,
} from "../types";
export function salesValues(p: Params) {
  const raw = [100 - 3 * p.x + 4 * p.y, 60 - p.x + 2 * p.y],
    weights = [p.mix, 1 - p.mix],
    q = weights.reduce((s, w, i) => s + w * Math.max(0, raw[i]), 0),
    served = Math.min(p.cap, q);
  const b = weights.reduce(
      (s, w, i) => s + (raw[i] > 0 ? w * [3, 1][i] : 0),
      0,
    ),
    c = weights.reduce((s, w, i) => s + (raw[i] > 0 ? w * [4, 2][i] : 0), 0);
  const kink =
    raw.some((v, i) => weights[i] > 0 && Math.abs(v) < 1e-8) ||
    Math.abs(q - p.cap) < 1e-8;
  const dp = q < p.cap ? -b : 0,
    ds = q < p.cap ? c : 0;
  return {
    raw,
    q,
    served,
    revenue: p.x * served,
    profit: (p.x - p.k) * served - p.h * p.y,
    dp,
    ds,
    kink,
    gradient: [served + (p.x - p.k) * dp, (p.x - p.k) * ds - p.h] as Pair,
    hessian: [
      [2 * dp, ds],
      [ds, 0],
    ] as Matrix2,
    elasticity: q > 0 ? (-b * p.x) / q : null,
  };
}
/** Partition every segment/capacity kink, then check quadratic interiors and edges. */
export function optimizeSales(p: Params, revenue = false) {
  const top = Math.min(8, p.budget / p.h),
    box: Pair[] = [
      [0, 0],
      [40, 0],
      [40, top],
      [0, top],
    ];
  let cells = [box];
  for (const [a, b, c] of [
    [-3, 4, -100],
    [-1, 2, -60],
  ])
    cells = cells
      .flatMap((poly) => [clip(poly, a, b, c), clip(poly, -a, -b, -c)])
      .filter((poly) => poly.length >= 3);
  const regions = cells.flatMap((poly) => {
    const x = poly.reduce((s, v) => s + v[0], 0) / poly.length,
      y = poly.reduce((s, v) => s + v[1], 0) / poly.length;
    const a1 = 100 - 3 * x + 4 * y > 0 ? p.mix : 0,
      a2 = 60 - x + 2 * y > 0 ? 1 - p.mix : 0;
    const intercept = 100 * a1 + 60 * a2,
      b = -3 * a1 - a2,
      c = 4 * a1 + 2 * a2;
    return [
      clip(poly, b, c, p.cap - intercept),
      clip(poly, -b, -c, intercept - p.cap),
    ].filter((v) => v.length >= 3);
  });
  const pp = revenue ? { ...p, k: 0, h: 0 } : p;
  const results = regions.map((poly) => {
    const center: Pair = [
      poly.reduce((s, v) => s + v[0], 0) / poly.length,
      poly.reduce((s, v) => s + v[1], 0) / poly.length,
    ];
    const centerModel = salesValues({ ...pp, x: center[0], y: center[1] });
    const h = centerModel.hessian;
    return quadraticMaximum(
      poly,
      (x, y) => salesValues({ ...pp, x, y }).profit,
      (x, y) => [
        centerModel.gradient[0] +
          h[0][0] * (x - center[0]) +
          h[0][1] * (y - center[1]),
        centerModel.gradient[1] +
          h[1][0] * (x - center[0]) +
          h[1][1] * (y - center[1]),
      ],
      h,
    );
  });
  return results.reduce((a, b) => (b.value > a.value ? b : a));
}
const feasible = (p: Params) => p.h * p.y <= p.budget + 1e-8;
function analyze(p: Params): Analysis {
  const m = salesValues(p),
    low = salesValues({ ...p, mix: Math.max(0, p.mix - p.uncertainty) }).profit,
    high = salesValues({
      ...p,
      mix: Math.min(1, p.mix + p.uncertainty),
    }).profit;
  return {
    value: m.profit,
    gradient: m.kink ? null : m.gradient,
    hessian: m.hessian,
    matrix: [
      [-3, 4],
      [-1, 2],
    ],
    matrixLabel:
      "A is 2×2; raw segment demand = A[price,effort]ᵀ + [100,60]ᵀ. Negative entries are clipped per segment before weighting.",
    metrics: [
      ["Demand", f(m.q) + " items/day"],
      ["Units sold", f(m.served) + " items/day"],
      ["Revenue", f(m.revenue) + " $/day"],
      ["Profit", f(m.profit) + " $/day"],
      [
        "Elasticity (demand)",
        m.elasticity === null ? "undefined at q=0" : f(m.elasticity),
      ],
      [
        "Mix sensitivity range",
        `${f(Math.min(low, high, m.profit))} to ${f(Math.max(low, high, m.profit))} $/day`,
      ],
    ],
    feasible: feasible(p),
    warnings: [
      ...(!feasible(p)
        ? [
            "Staff spend exceeds its budget; this decision cannot complete a mission.",
          ]
        : []),
      ...(m.kink
        ? [
            "At a demand/capacity kink, the classical gradient is not supplied. Use one-sided changes.",
          ]
        : []),
      "Sensitivity range varies the segment mix; it is not a statistical confidence interval.",
    ],
    interpretation: `At this price ${f(m.served)} modeled items sell. More sales need not increase profit: both unit margin and effort cost matter.`,
  };
}
export const definition: Definition = {
  id: "sales",
  title: "Sales Decision Simulator",
  question: "Which price earns the most after stock and staff costs?",
  analogy:
    "A lower price may fill more baskets, but each basket earns less. Picture adjusting two knobs: the price on the shelf and the hours spent helping customers. A related time-allocation example: two hours with leads converting at 0.3 expected sales/hour gives 0.6 expected sales, versus 0.2 at 0.1/hour. These are assumptions and expectations, not guaranteed outcomes; limited leads can change the best allocation.",
  output: "Profit ($/day)",
  assumptions: [
    "Synthetic daily steady-state model; no personal/customer data.",
    "Two hypothetical segment responses are clipped at zero, weighted, then limited by stock. Staff cost is h×effort; no inventory holding cost is modeled.",
    "The matrix model is an assumption, not a causal estimate from observational prices. Domain: price 0–40 $/item, effort 0–8 h/day.",
  ],
  glossary: [
    ["p,s", "Price ($/item), sales effort (h/day)"],
    ["q,R,π", "Demand and sold items/day; revenue and profit $/day"],
    ["k,h", "Unit cost $/item; hourly cost $/h"],
    [
      "A,m",
      "Segment response coefficients with row-specific units; segment-1 weight in [0,1]",
    ],
  ],
  limit:
    "A higher-sales strategy can lose money. Correlation between price and sales does not identify a causal demand curve; stock, competitors, seasonality and customer selection are omitted.",
  formula: String.raw`q=m\max(0,100-3p+4s)+(1-m)\max(0,60-p+2s),\quad \pi=(p-k)\min(q,C)-hs`,
  predict:
    "When both segments are positive and stock is not binding, what changes if price rises?",
  predictionChoices: [
    ["tradeoff", "Demand falls; profit can rise or fall"],
    ["always", "Both demand and profit always rise"],
  ],
  predictionAnswer: "tradeoff",
  feasible,
  analyze,
  scalar: (p, x, y) => salesValues({ ...p, x, y }).profit,
  derive: (p) => {
    const m = salesValues(p);
    return [
      proof(
        "q_raw=A[p,s]ᵀ+b; q=m·positive_part(q_raw)",
        "Matrix multiplication combines each segment's price and effort coefficients; m is a row of weights.",
        "definition",
        "columns",
      ),
      proof(
        "Inside one positive-demand, unsaturated piece: q=a−bp+cs",
        "Hold the active segments and their weights fixed. Boundary pieces need separate rules.",
        "definition",
      ),
      proof(
        "π=(p−k)(a−bp+cs)−hs",
        "Revenue less unit and effort costs, all in dollars/day.",
        "definition",
      ),
      proof(
        "∂π/∂p=q−b(p−k); ∂π/∂s=c(p−k)−h",
        "Product rule in p and partial differentiation in s.",
        "algebra",
        "gradient",
      ),
      proof(
        `Current gradient: ${m.kink ? "undefined at kink" : pair(m.gradient)}; H=[[−2b,c],[c,0]]`,
        "If c≠0 the Hessian determinant is −c²<0. An interior stationary point need not maximize profit.",
        "calculation",
        "gradient",
      ),
      proof(
        "Check feasible boundaries and every clipping/capacity piece",
        "Each piece is quadratic. Edge critical points and vertices, plus feasible interior stationary points, give the global candidate set for this bounded model.",
        "theorem",
        "constraints",
      ),
    ];
  },
  examples: [
    {
      title: "Two segments, one price",
      params: { x: 20, y: 0, mix: 0.5, k: 8, h: 5, cap: 120, budget: 40 },
      steps: [
        "A(20,0)ᵀ+(100,60)ᵀ=(40,40) items/day.",
        "Weighted demand is 0.5×40+0.5×40=40; stock does not bind.",
        "R=20×40=800 $/day; π=(20−8)×40=480 $/day.",
      ],
    },
    {
      title: "More units, less profit",
      params: { x: 10, y: 2, mix: 0.5, k: 8, h: 5, cap: 120, budget: 40 },
      steps: [
        "Raw segment demands are 78 and 54, giving 66 items/day.",
        "Revenue is 660 $/day, but unit margin is only 2 $/item.",
        "π=2×66−5×2=122 $/day. Compare 480 from the first decision; more units did not win.",
      ],
    },
  ],
  edge: {
    title: "No demand, no elasticity",
    params: { x: 40, y: 0, mix: 1, cap: 120 },
    explanation:
      "Segment 1 demand is clipped to zero. Demand elasticity divides by q and is undefined here; a smooth interior gradient cannot be carried across the kink.",
  },
  mission: (seed, level) => {
    const p = {
      ...defaults("sales"),
      mix: 0.25 + 0.1 * (seed % 5),
      cap: level === 1 ? 150 : 55 + (seed % 4) * 5,
      budget: level === 1 ? 5 : 20 + (seed % 5) * 5,
      y: 0,
      x: 10,
    };
    const opt =
      level === 1
        ? { point: [(60 + 40 * p.mix) / (2 * (1 + 2 * p.mix)), 0], value: 0 }
        : optimizeSales(p);
    return {
      params: p,
      question:
        level === 1
          ? "Hold effort at 0. Find the revenue-maximizing price for this fresh segment mix (±0.05 $/item)."
          : level === 2
            ? "Reach profit within 0.5 $/day of the best feasible decision. Respect the frozen staff budget and stock model."
            : "Construct a positive-sales decision that loses money, then identify why sales volume alone is misleading.",
      hint:
        level === 1
          ? "Set the interior marginal revenue a−2bp to zero; check the clipping pieces."
          : "Use the sign of the marginals, then test feasible boundaries and stock kinks. Read units, not just volume.",
      solution:
        level === 1
          ? `p=${f(opt.point[0], 6)}, s=0; p=(60+40m)/(2(1+2m)).`
          : `Best feasible profit ${f(opt.value, 6)} at (p,s)=${pair(opt.point)}. For a losing counterexample, choose price below unit cost with positive sales.`,
      choices: [
        ["principle", "Margin, costs and constraints determine the decision"],
        ["volume", "The most units sold always gives the most profit"],
      ],
      correctRule: "principle",
      grade: (q) => {
        const v = salesValues(q),
          ok =
            feasible(q) &&
            (level === 1
              ? Math.abs(q.x - opt.point[0]) <= 0.05 && q.y === 0
              : level === 2
                ? v.profit >= opt.value - 0.5
                : v.served > 0 && v.profit < 0);
        return {
          correct: ok,
          feedback: ok
            ? "Objective met under the synthetic assumptions; explain the margin and active constraint."
            : `Not yet: profit ${f(v.profit)} $/day, staff spend ${f(q.h * q.y)}/${f(q.budget)}. Check the stated objective, not just units sold.`,
        };
      },
    };
  },
  python: (p) =>
    `# Synthetic sales assumptions; no causal or real-revenue claim.\np, s, k, h, mix, capacity = ${p.x}, ${p.y}, ${p.k}, ${p.h}, ${p.mix}, ${p.cap}\nraw = [100-3*p+4*s, 60-p+2*s]\nq = mix*max(0,raw[0])+(1-mix)*max(0,raw[1])\nsold = min(q,capacity)\nprofit = (p-k)*sold-h*s\nprint(profit)\n`,
  related: {
    url: "#/explore/prediction/demand",
    label: "Continue with the time-aware store-demand forecasting workflow",
  },
};
