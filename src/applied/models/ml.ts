import { defaults } from "../schema";
import { surfaceGeometry } from "../math";
import {
  f,
  pair,
  proof,
  type Analysis,
  type Definition,
  type Geometry,
  type Pair,
  type Params,
} from "../types";
export const X: Pair[] = [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  Y = [2, 3, 5, 7];
export function loss(p: Params) {
  return (
    X.reduce((s, row, i) => s + (row[0] * p.x + row[1] * p.y - Y[i]) ** 2, 0) /
    X.length
  );
}
export function lossGradient(p: Params): Pair {
  return [0, 1].map(
    (j) =>
      (2 / X.length) *
      X.reduce(
        (s, row, i) => s + row[j] * (row[0] * p.x + row[1] * p.y - Y[i]),
        0,
      ),
  ) as Pair;
}
const step = (p: Params) => {
  const g = lossGradient(p);
  return { ...p, x: p.x - p.alpha * g[0], y: p.y - p.alpha * g[1] };
};
function analyze(p: Params): Analysis {
  const g = lossGradient(p),
    next = step(p);
  return {
    value: loss(p),
    gradient: g,
    hessian: [
      [3, 1.5],
      [1.5, 1.5],
    ],
    matrix: X,
    matrixLabel:
      "X is 4×2: two available-at-prediction-time feature columns. Xw gives residual meals/day above the fixed 20-meal intercept.",
    feasible: true,
    metrics: [
      ["Training MSE", f(loss(p)) + " meals²"],
      ["Weights", pair([p.x, p.y]) + " meals/feature unit"],
      ["Gradient", pair(g)],
      ["Next-step training MSE", f(loss(next)) + " meals²"],
      [
        "Training predictions",
        X.map((row) => f(20 + row[0] * p.x + row[1] * p.y)).join(", ") +
          " meals/day",
      ],
    ],
    interpretation:
      "The loss height comes from the same four residuals as the table. A low training error describes this fixture, not tomorrow's generalization or business usefulness.",
    warnings: [
      ...(loss(next) > loss(p) + 1e-8
        ? [
            "This step increases training loss; the learning rate may be too large.",
          ]
        : []),
      "The bowl is exactly two trainable parameters with a fixed intercept, not a neural-network loss landscape.",
    ],
  };
}
export const definition: Definition = {
  id: "ml",
  title: "Train the Predictor",
  question:
    "Can two model weights reduce restaurant-demand error without looking at tomorrow?",
  analogy:
    "A recipe combines two ingredients. Here two weights combine normalized recent demand and advance reservations, both known before tomorrow. The bowl shows how wrong that recipe is on four teaching days.",
  output: "Training MSE (meals²)",
  assumptions: [
    "Four deterministic synthetic training rows; the intercept is fixed at 20 meals/day.",
    "Features are normalized recent demand and advance reservations, available at the decision timestamp. Labels are later meal totals.",
    "The fixed demonstration holdout is separate from training. Once evaluated, changing the weights is development feedback, not another untouched test.",
  ],
  glossary: [
    [
      "X,w,y",
      "4×2 feature matrix, 2×1 weight vector, 4×1 residual target (meals/day above 20)",
    ],
    ["L,r", "Mean squared error (meals²); residual Xw−y"],
    ["α,∇L", "Learning-rate scale; slope in each weight coordinate"],
  ],
  limit:
    "The perfect synthetic fit is deliberately simple. It does not establish demand causality, calibration, robustness or operational usefulness. Use Prediction Studio for the full forecasting contract and evaluation workflow.",
  formula: String.raw`L=\frac1n\|Xw-y\|^2,\quad\nabla L=\frac2nX^\mathsf T(Xw-y),\quad w^+=w-\alpha\nabla L`,
  predict:
    "If a small step follows the negative gradient, what do you expect locally?",
  predictionChoices: [
    [
      "local",
      "Training loss should decrease for a sufficiently small positive step",
    ],
    [
      "guarantee",
      "Every step size guarantees better future demand predictions",
    ],
  ],
  predictionAnswer: "local",
  analyze,
  scalar: (p, x, y) => loss({ ...p, x, y }),
  step,
  derive: () => [
    proof(
      "r=Xw−y; L=(r₁²+…+rₙ²)/n",
      "Define the residuals and mean squared loss.",
      "definition",
    ),
    proof(
      "∂rᵢ/∂wⱼ=Xᵢⱼ",
      "The prediction is a linear combination of feature columns.",
      "definition",
      "columns",
    ),
    proof(
      "∂L/∂wⱼ=(2/n)ΣᵢrᵢXᵢⱼ",
      "Differentiate each squared residual, using the chain rule.",
      "algebra",
      "gradient",
    ),
    proof(
      "∇L=(2/n)Xᵀ(Xw−y); H=(2/n)XᵀX",
      "Collect the component derivatives. H is positive semidefinite; this full-rank fixture makes it positive definite.",
      "algebra",
      "gradient",
    ),
    proof(
      "Here H=[[3,1.5],[1.5,1.5]] and λmax≈3.92705",
      "The 2×2 characteristic polynomial supplies the eigenvalues. A fixed 0<α<2/λmax contracts the quadratic error.",
      "calculation",
    ),
    proof(
      "Training fit, held-out error and decision usefulness are distinct",
      "Freeze the coefficients before the fixed holdout is displayed. No amount of animation establishes future performance.",
      "definition",
    ),
  ],
  examples: [
    {
      title: "Start with zero weights",
      params: { x: 0, y: 0, alpha: 0.1 },
      steps: [
        "Xw=(0,0,0,0); residuals are (−2,−3,−5,−7).",
        "L=(4+9+25+49)/4=21.75 meals².",
        "Xᵀr=(−21,−15), so ∇L=(−10.5,−7.5). A 0.1 step gives (1.05,0.75).",
      ],
    },
    {
      title: "An exact synthetic fit",
      params: { x: 2, y: 3, alpha: 0.1 },
      steps: [
        "X(2,3)ᵀ=(2,3,5,7). Add the fixed intercept for meal predictions.",
        "All four training residuals vanish, giving L=0 and ∇L=(0,0).",
        "This says nothing by itself about held-out outcomes. Noise and distribution change can defeat a perfect training fit.",
      ],
    },
  ],
  edge: {
    title: "Load an overshooting learning rate",
    params: { x: 0, y: 0, alpha: 0.6 },
    explanation:
      "The next point is (6.3,4.5), and MSE rises from 21.75 to 39.0975. A negative-gradient direction is only a local descent guarantee, not permission for any step size.",
  },
  mission: (seed, level) => {
    const p = { ...defaults("ml"), alpha: 0.08 + 0.01 * (seed % 4) };
    return {
      params: p,
      question:
        level === 1
          ? "Reach training MSE ≤0.03 meals² using two weights, then justify the gradient direction."
          : level === 2
            ? "Choose a learning rate and nonoptimal weights whose analytic next step increases loss by more than 0.01. Diagnose the local-versus-finite-step mistake."
            : "Reach training MSE ≤0.03, freeze coefficients, and evaluate the fixed held-out set without retuning on its labels. Explain why this is only one test.",
      hint: "Compute residuals Xw−y, multiply by Xᵀ and scale by 2/n. Small steps help this convex bowl; large steps can overshoot.",
      solution:
        "The training solution is (2,3), L=0. At (0,0) with α=0.6 the next loss is 39.0975. The separate fixed holdout is consumed after viewing; it is not a secure hidden exam.",
      choices: [
        [
          "principle",
          "Use the negative training gradient with a suitable step; evaluate a frozen model separately",
        ],
        ["training", "Zero training error proves useful future predictions"],
      ],
      correctRule: "principle",
      grade: (q) => {
        const ok =
          level === 2 ? loss(step(q)) > loss(q) + 0.01 : loss(q) <= 0.03;
        return {
          correct: ok,
          feedback: ok
            ? "Numerical objective met. Explain what the training criterion does and does not establish."
            : `Not yet: training MSE ${f(loss(q))}; next-step MSE ${f(loss(step(q)))}.`,
        };
      },
    };
  },
  lines: (p, to) => {
    const points = [];
    let q = { ...p };
    for (let i = 0; i < 13; i++) {
      if (q.x < -2 || q.x > 8 || q.y < -2 || q.y > 8) break;
      points.push(to(q.x, q.y, loss(q)));
      q = step(q);
    }
    return points.length > 1
      ? [
          {
            points,
            color: "#eef4bc",
            label:
              "path: analytic future gradient updates; stops at plot boundary",
          },
        ]
      : [];
  },
  geometry: (p) => {
    if (!p.view)
      return surfaceGeometry({ ...definition, geometry: undefined }, p);
    const to = (x: number, y: number, z: number): [number, number, number] => [
      2.5 * x - 2.5,
      2.5 * y - 2.5,
      (2.2 * z) / 60,
    ];
    const samples = [
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
    ] as Pair[];
    return {
      points: samples.map(([x, y]) => to(x, y, 20 + x * p.x + y * p.y)),
      size: 2,
      valid: [true, true, true, true],
      marker: to(1, 0, 20 + p.x),
      gradient: undefined,
      lines: X.map((row, i) => ({
        points: [
          to(row[0], row[1], 20 + Y[i]),
          to(row[0], row[1], 20 + row[0] * p.x + row[1] * p.y),
        ],
        color: "#edb58a",
        label: "training residual in feature space",
      })),
      spheres: X.map((row, i) => ({
        point: to(row[0], row[1], 20 + Y[i]),
        radius: 0.07,
        color: "#badfa7",
        label: "observed synthetic training row",
      })),
      labels: [
        "Known feature 1",
        "Known feature 2",
        "Meals/day; fixed display 0–60",
      ],
      range: [0, 60],
      draggable: false,
    } satisfies Geometry;
  },
  python: (p) =>
    `# Fixed-intercept synthetic 2-feature training fixture. No held-out fitting.\nX=[(1,0),(0,1),(1,1),(2,1)]\ny=[2,3,5,7]\nw=[${p.x},${p.y}]\npred=[a*w[0]+b*w[1] for a,b in X]\nprint(sum((a-b)**2 for a,b in zip(pred,y))/len(y))\n`,
  related: {
    url: "#/explore/prediction/demand",
    label: "Continue in the existing Prediction Studio",
  },
};
