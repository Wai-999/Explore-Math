import { defaults } from "../schema";
import { clip, quadraticMaximum } from "../math";
import {
  f,
  pair,
  proof,
  type Analysis,
  type Definition,
  type Pair,
  type Params,
} from "../types";
export const profit = (p: Params) =>
  (p.demand - 0.2 * p.x + 0.1 * p.y - p.cost) * p.x -
  p.y -
  0.02 * p.y * p.y -
  40;
export const profitGradient = (p: Params): Pair => [
  p.demand - p.cost - 0.4 * p.x + 0.1 * p.y,
  0.1 * p.x - 1 - 0.04 * p.y,
];
const feasible = (p: Params) => 2 * p.x + p.y <= p.budget + 1e-8;
export function financeOptimum(p: Params) {
  const poly = clip(
    [
      [0, 0],
      [80, 0],
      [80, 60],
      [0, 60],
    ],
    2,
    1,
    p.budget,
  );
  return quadraticMaximum(
    poly,
    (x, y) => profit({ ...p, x, y }),
    (x, y) => profitGradient({ ...p, x, y }),
    [
      [-0.4, 0.1],
      [0.1, -0.04],
    ],
  );
}
function analyze(p: Params): Analysis {
  return {
    value: profit(p),
    gradient: profitGradient(p),
    hessian: [
      [-0.4, 0.1],
      [0.1, -0.04],
    ],
    matrix: [
      [1, 0],
      [2, 1],
    ],
    matrixLabel:
      "C[q,a]ᵀ≤[80,budget]ᵀ. First row is items/day; second uses 2 $/item of the resource plus 1×investment $/day. Unit production cost includes other expenses.",
    metrics: [
      ["Profit", f(profit(p)) + " $/day"],
      ["Modeled sale price", f(p.demand - 0.2 * p.x + 0.1 * p.y) + " $/item"],
      ["Resource spend", `${f(2 * p.x + p.y)}/${f(p.budget)} $/day`],
      ["Marginal profit in q,a", pair(profitGradient(p))],
      ["Hessian determinant", "0.006; negative definite"],
    ],
    feasible: feasible(p),
    interpretation:
      "A larger production or investment level can help at first, then reduce profit. The resource boundary and both coordinate limits matter; stationary conditions alone do not identify a feasible decision.",
    warnings: [
      ...(!feasible(p)
        ? [
            "This point exceeds the resource budget and cannot complete a mission.",
          ]
        : []),
      "Synthetic continuous decision model, not financial or investment advice. The resource constraint covers only the stated resource, not every cost in the objective.",
    ],
  };
}
export const definition: Definition = {
  id: "finance",
  title: "Sustainable Profit Decision",
  question:
    "How much should a small producer make and invest within a resource budget?",
  analogy:
    "You can bake more loaves or improve the stall, but the same small resource pot supports both. The best plan balances the next loaf's benefit against the next improvement's benefit and the boundary of that pot.",
  output: "Profit ($/day)",
  assumptions: [
    "Synthetic continuous q (items/day) and investment a ($/day); fractional production is a mathematical relaxation, not an integer operating plan.",
    "Price=d−0.2q+0.1a; unit cost is k; investment costs a+0.02a²; fixed cost is 40 $/day. Coefficients carry the units needed by this daily model.",
    "Feasible region: 0≤q≤80, 0≤a≤60, 2q+a≤resource budget. The budget constrains a resource costing 2 $/item plus investment; other unit expenses remain in profit.",
  ],
  glossary: [
    ["q,a", "Production items/day; investment $/day"],
    ["d,k,π", "Base price and unit cost $/item; modeled profit $/day"],
    ["C,H", "2×2 resource coefficient matrix; Hessian of profit"],
  ],
  limit:
    "The model omits uncertainty, integer plans, competitor responses, cash timing and real parameter estimation. A simulated optimum is not guaranteed revenue, investment advice or real-world validation.",
  formula: String.raw`\pi(q,a)=(d-0.2q+0.1a-k)q-a-0.02a^2-40,\quad \begin{bmatrix}1&0\\2&1\end{bmatrix}\begin{bmatrix}q\\a\end{bmatrix}\le\begin{bmatrix}80\\B\end{bmatrix}`,
  predict:
    "If the current point is below the budget, must a higher investment always help?",
  predictionChoices: [
    ["marginal", "No: inspect its marginal profit and the constraints"],
    ["always", "Yes: more investment always earns more profit"],
  ],
  predictionAnswer: "marginal",
  feasible,
  analyze,
  scalar: (p, x, y) => profit({ ...p, x, y }),
  derive: (p) => [
    proof(
      "π=(d−0.2q+0.1a−k)q−a−0.02a²−40",
      "Write revenue minus variable, investment and fixed costs with daily units.",
      "definition",
    ),
    proof(
      "πq=d−k−0.4q+0.1a; πa=0.1q−1−0.04a",
      "Differentiate one variable at a time, holding the other fixed.",
      "algebra",
      "gradient",
    ),
    proof(
      "H=[[-0.4,0.1],[0.1,−0.04]]; det H=0.006>0",
      "The first principal entry is negative and the determinant positive, so this symmetric Hessian is negative definite.",
      "calculation",
    ),
    proof(
      "Strict concavity makes a feasible optimum unique on this convex polygon",
      "This conclusion depends on the objective and feasible set. It does not make an infeasible stationary point acceptable.",
      "theorem",
      "constraints",
    ),
    proof(
      "On each edge, p(t)=v+t(u−v), 0≤t≤1; test derivative zero and endpoints",
      "Restriction is a quadratic. Check every polygon edge and feasible interior stationary candidate.",
      "algebra",
      "constraints",
    ),
    proof(
      `Current resource use: 2×${f(p.x)}+${f(p.y)}=${f(2 * p.x + p.y)}`,
      "The matrix and the dashed feasible boundary use these same coefficients.",
      "calculation",
    ),
  ],
  examples: [
    {
      title: "Twenty items and a small improvement",
      params: { x: 20, y: 10, demand: 24, cost: 6, budget: 160 },
      steps: [
        "Price is 24−0.2×20+0.1×10=21 $/item.",
        "π=(21−6)×20−10−0.02×100−40=248 $/day.",
        "Resource use is 2×20+10=50≤160. The gradient is (11,0.6).",
      ],
    },
    {
      title: "More production near the resource frontier",
      params: { x: 40, y: 20, demand: 24, cost: 6, budget: 160 },
      steps: [
        "Price is 18 $/item; unit margin is 12 $/item.",
        "π=12×40−20−8−40=412 $/day.",
        "Resource use is 100≤160; marginals are (4,2.2). A boundary comparison is still needed.",
      ],
    },
  ],
  edge: {
    title: "A high-profit but infeasible proposal",
    params: { x: 80, y: 60, budget: 100 },
    explanation:
      "Resource use is 220 $/day against a 100-dollar budget. An attractive surface height outside the feasible set cannot complete a valid decision.",
  },
  mission: (seed, level) => {
    const p = {
        ...defaults("finance"),
        budget: 130 + (seed % 41),
        demand: 22 + (seed % 5),
      },
      o = financeOptimum(p);
    return {
      params: p,
      question:
        level === 3
          ? "Find a feasible near-optimum and explain why an unconstrained stationary proposal can fail the budget test."
          : `Maximize profit within the frozen polygon; get within ${level === 1 ? 1 : 0.1} $/day of the exact candidate maximum.`,
      hint: "Compute both marginals. If the stationary point is outside the polygon, solve the one-dimensional quadratic on each feasible edge and compare endpoints.",
      solution: `Candidate maximum ${f(o.value, 6)} $/day at (q,a)=${pair(o.point)}. All coordinate and resource boundaries are included.`,
      choices: [
        [
          "principle",
          "Check the feasible set, boundary candidates and the concavity assumptions",
        ],
        [
          "stationary",
          "Every stationary point is automatically the feasible global optimum",
        ],
      ],
      correctRule: "principle",
      grade: (q) => {
        const ok =
          feasible(q) && profit(q) >= o.value - (level === 1 ? 1 : 0.1);
        return {
          correct: ok,
          feedback: ok
            ? "Objective met for the declared continuous model; report the active constraint and omitted uncertainty."
            : `Not yet: profit ${f(profit(q))}, resource use ${f(2 * q.x + q.y)}/${q.budget}.`,
        };
      },
    };
  },
  lines: (p, to) => {
    const poly = clip(
      [
        [0, 0],
        [80, 0],
        [80, 60],
        [0, 60],
      ],
      2,
      1,
      p.budget,
    );
    return [
      {
        points: poly.flatMap((a, i) => {
          const b = poly[(i + 1) % poly.length];
          return Array.from({ length: 21 }, (_, j) => {
            const x = a[0] + ((b[0] - a[0]) * j) / 20,
              y = a[1] + ((b[1] - a[1]) * j) / 20;
            return to(x, y, profit({ ...p, x, y }));
          });
        }),
        color: "#edc5a3",
        label: "constraint polygon including resource boundary",
      },
    ];
  },
  python: (p) =>
    `# Synthetic continuous daily production/investment model, not advice.\nq,a,d,k=${p.x},${p.y},${p.demand},${p.cost}\nprint((d-.2*q+.1*a-k)*q-a-.02*a*a-40)\n`,
  related: {
    url: "#/applications/business",
    label: "Compare the existing one-variable production mission",
  },
};
