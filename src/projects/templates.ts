import { add, norm, type Vec3 } from "../math/linear";
import {
  validProject,
  validParameters,
  type ProjectSpec,
  type TemplateId,
} from "./schema";
export const TEMPLATE_INFO: Record<
  TemplateId,
  {
    title: string;
    question: string;
    scenario: string;
    assumptions: string[];
    goal: string;
    defaults: Record<string, number>;
  }
> = {
  "vector-navigation": {
    title: "My delivery drone",
    question:
      "Which control displacement reaches the destination despite the wind?",
    scenario:
      "A navigation plan on a flat map. Displacements are measured in meters in one fixed coordinate frame.",
    assumptions: [
      "This is vector displacement bookkeeping, not full drone dynamics.",
      "Start, control, wind, and destination share one fixed right-handed map frame.",
      "Wind is represented as a known displacement over the maneuver; acceleration, collisions, fuel, and uncertainty are omitted.",
    ],
    goal: "Land within 0.15 m of the destination.",
    defaults: {
      startX: -3,
      startY: 1,
      windX: 2,
      windY: -1,
      targetX: 5,
      targetY: 3,
      controlX: 0,
      controlY: 0,
    },
  },
  "quadratic-cost": {
    title: "My workshop operating cost",
    question:
      "Which feasible production quantity minimizes this modeled operating cost?",
    scenario:
      "A synthetic cost curve for a divisible production quantity between 0 and 20 units per batch.",
    assumptions: [
      "C(q)=aq²+bq+c is an illustrative operating-cost model in dollars per batch.",
      "a is positive, so the cost is strictly convex; quantities are continuous, not indivisible orders.",
      "Demand, revenue, measured data, uncertainty, staffing, and start-up decisions are omitted. This model alone cannot prescribe an operating plan.",
    ],
    goal: "Choose q in [0,20] with cost at most $0.05 above the feasible minimum.",
    defaults: { a: 1, b: -12, c: 400, q: 10 },
  },
};
export function newProject(
  template: TemplateId = "vector-navigation",
  id: string = crypto.randomUUID(),
  at: string = new Date().toISOString(),
): ProjectSpec {
  const info = TEMPLATE_INFO[template];
  return {
    version: 1,
    id,
    template,
    title: info.title,
    scenario: info.scenario,
    units: template === "vector-navigation" ? "m" : "USD",
    createdAt: at,
    updatedAt: at,
    question: info.question,
    prediction: "",
    observation: "",
    reflection: "",
    parameters: { ...info.defaults },
    evidence: {
      attempts: 0,
      hintUsed: false,
      goalMet: null,
      selfChecked: false,
      checkedAt: null,
    },
  };
}
export function vectorModel(parameters: Record<string, number>) {
  if (!validParameters("vector-navigation", parameters))
    throw Error("Use finite navigation values within the labeled bounds.");
  const p: Vec3 = [parameters.startX, parameters.startY, 0],
    u: Vec3 = [parameters.controlX, parameters.controlY, 0],
    w: Vec3 = [parameters.windX, parameters.windY, 0],
    target: Vec3 = [parameters.targetX, parameters.targetY, 0];
  const afterControl = add(p, u),
    landing = add(afterControl, w),
    required = target.map((v, i) => v - p[i] - w[i]) as Vec3;
  const error = norm(landing.map((v, i) => v - target[i]));
  return {
    start: p,
    control: u,
    wind: w,
    target,
    afterControl,
    landing,
    required,
    error,
    goalMet: error <= 0.15,
  };
}
export function costModel(parameters: Record<string, number>) {
  if (!validParameters("quadratic-cost", parameters))
    throw Error(
      "Use finite positive a and the labeled coefficient/quantity bounds.",
    );
  const { a, b, c, q } = parameters;
  const cost = (x: number) => a * x * x + b * x + c;
  const stationary = -b / (2 * a),
    candidates = [0, 20];
  if (stationary >= 0 && stationary <= 20) candidates.push(stationary);
  const optimum = candidates.reduce((best, next) =>
    cost(next) < cost(best) ? next : best,
  );
  const minimum = cost(optimum),
    value = cost(q),
    gap = value - minimum;
  return {
    value,
    derivative: 2 * a * q + b,
    stationary,
    candidates: [...new Set(candidates)].map((quantity) => ({
      quantity,
      cost: cost(quantity),
    })),
    optimum,
    minimum,
    gap,
    goalMet: gap <= 0.05,
    curve: Array.from({ length: 101 }, (_, i) => ({
      q: i / 5,
      cost: cost(i / 5),
    })),
  };
}
export function evaluateProject(project: ProjectSpec) {
  if (!validProject(project))
    throw Error("The project specification is invalid.");
  return project.template === "vector-navigation"
    ? vectorModel(project.parameters)
    : costModel(project.parameters);
}
export function projectCode(project: ProjectSpec): string {
  if (!validProject(project)) throw Error("Export requires a valid project.");
  const p = project.parameters;
  // User text is never inserted into executable code; all literals are schema-checked numbers.
  if (project.template === "vector-navigation")
    return `# Python 3: fixed-frame displacement model; values are meters.\nimport math\nimport json\nstart = [${p.startX}, ${p.startY}]\ncontrol = [${p.controlX}, ${p.controlY}]\nwind = [${p.windX}, ${p.windY}]\ntarget = [${p.targetX}, ${p.targetY}]\nlanding = [start[i] + control[i] + wind[i] for i in range(2)]\nrequired = [target[i] - start[i] - wind[i] for i in range(2)]\nerror = math.dist(landing, target)\nprint(json.dumps({"landing": landing, "required": required, "error": error}))\n`;
  return `# Python 3: synthetic convex cost, dollars per batch; q in [0, 20].\nimport json\na, b, c, q = ${p.a}, ${p.b}, ${p.c}, ${p.q}\ndef cost(quantity):\n    return a * quantity ** 2 + b * quantity + c\nstationary = -b / (2 * a)\ncandidates = [0.0, 20.0]\nif 0 <= stationary <= 20:\n    candidates.append(stationary)\noptimum = min(candidates, key=cost)\nprint(json.dumps({"cost": cost(q), "derivative": 2*a*q+b, "optimum": optimum, "minimum": cost(optimum)}))\n`;
}
export function projectReport(project: ProjectSpec): string {
  if (!validProject(project))
    throw Error("Repair the project before exporting its report.");
  const p = project.parameters,
    result = evaluateProject(project);
  const clean = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r/g, "");
  const record = (value: string) =>
    value
      ? clean(value)
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")
      : "Not recorded.";
  const calculation =
    project.template === "vector-navigation"
      ? (() => {
          const r = result as ReturnType<typeof vectorModel>;
          return `Landing = start + control + wind = (${r.landing[0]}, ${r.landing[1]}) m.\nRequired control = target − start − wind = (${r.required[0]}, ${r.required[1]}) m.\nPosition error = ${r.error} m; tolerance = 0.15 m.`;
        })()
      : (() => {
          const r = result as ReturnType<typeof costModel>;
          return `C(q) = ${p.a}q² + (${p.b})q + ${p.c} dollars per batch.\nC′(${p.q}) = ${r.derivative} dollars per production unit.\nFeasible minimum: q = ${r.optimum}, C = ${r.minimum}.\nCurrent cost = ${r.value}; gap = ${r.gap} dollars.`;
        })();
  return `# ${clean(project.title).replace(/\n/g, " ")}\n\nTemplate: ${project.template}; schema: ${project.version}; model: explore-math-projects-v1.\nCreated: ${project.createdAt}; updated: ${project.updatedAt}.\n\n## Question\n${record(project.question)}\n\n## Scenario\n${record(project.scenario)}\n\n## Inputs\n${Object.entries(
    p,
  )
    .map(([key, value]) => `- ${key}: ${value}`)
    .join(
      "\n",
    )}\n\n## Prediction\n${record(project.prediction)}\n\n## Calculations\n${calculation}\n\n## Observation\n${record(project.observation)}\n\n## Decision and explanation\n${record(project.reflection)}\n\n## Assumptions and limitations\n${TEMPLATE_INFO[project.template].assumptions.map((s) => `- ${s}`).join("\n")}\n\n## Attempt evidence\nChecks: ${project.evidence.attempts}; last objective result: ${project.evidence.goalMet === null ? "not checked" : project.evidence.goalMet ? "goal met" : "goal not met"}; hint/solution used: ${project.evidence.hintUsed ? "yes" : "no in this draft"}.\nReasoning rubric: ${project.evidence.selfChecked ? "learner self-checked, not independently reviewed" : "not reviewed"}. This record does not establish general mastery or real-world performance.\n\n## Next experiment\nChange one assumption or parameter, predict its effect, compare before/after, and test a fresh boundary case.\n`;
}
