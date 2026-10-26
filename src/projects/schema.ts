export type TemplateId = "vector-navigation" | "quadratic-cost";
export const MAX_PROJECTS = 20;
export const MAX_PROJECT_BYTES = 250_000;
export interface ParameterRule {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}
export const PARAMETER_RULES: Record<TemplateId, ParameterRule[]> = {
  "vector-navigation": [
    {
      key: "startX",
      label: "Start x",
      min: -10,
      max: 10,
      step: 0.1,
      unit: "m",
    },
    {
      key: "startY",
      label: "Start y",
      min: -10,
      max: 10,
      step: 0.1,
      unit: "m",
    },
    {
      key: "windX",
      label: "Wind displacement x",
      min: -10,
      max: 10,
      step: 0.1,
      unit: "m",
    },
    {
      key: "windY",
      label: "Wind displacement y",
      min: -10,
      max: 10,
      step: 0.1,
      unit: "m",
    },
    {
      key: "targetX",
      label: "Destination x",
      min: -10,
      max: 10,
      step: 0.1,
      unit: "m",
    },
    {
      key: "targetY",
      label: "Destination y",
      min: -10,
      max: 10,
      step: 0.1,
      unit: "m",
    },
    {
      key: "controlX",
      label: "Control displacement x",
      min: -30,
      max: 30,
      step: 0.1,
      unit: "m",
    },
    {
      key: "controlY",
      label: "Control displacement y",
      min: -30,
      max: 30,
      step: 0.1,
      unit: "m",
    },
  ],
  "quadratic-cost": [
    {
      key: "a",
      label: "Quadratic coefficient a",
      min: 0.25,
      max: 3,
      step: 0.05,
      unit: "$/unit²",
    },
    {
      key: "b",
      label: "Linear coefficient b",
      min: -20,
      max: 10,
      step: 0.1,
      unit: "$/unit",
    },
    {
      key: "c",
      label: "Fixed cost c",
      min: 400,
      max: 2000,
      step: 1,
      unit: "$",
    },
    {
      key: "q",
      label: "Production quantity q",
      min: 0,
      max: 20,
      step: 0.1,
      unit: "units",
    },
  ],
};
export interface ProjectSpec {
  version: 1;
  id: string;
  template: TemplateId;
  title: string;
  scenario: string;
  units: "m" | "USD";
  createdAt: string;
  updatedAt: string;
  question: string;
  prediction: string;
  observation: string;
  reflection: string;
  parameters: Record<string, number>;
  evidence: {
    attempts: number;
    hintUsed: boolean;
    goalMet: boolean | null;
    selfChecked: boolean;
    checkedAt: string | null;
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const fields = [
  "version",
  "id",
  "template",
  "title",
  "scenario",
  "units",
  "createdAt",
  "updatedAt",
  "question",
  "prediction",
  "observation",
  "reflection",
  "parameters",
  "evidence",
];
const date = (v: unknown) =>
  typeof v === "string" &&
  v.length <= 40 &&
  /^\d{4}-\d{2}-\d{2}T/.test(v) &&
  Number.isFinite(Date.parse(v));
export function validParameters(
  template: TemplateId,
  input: unknown,
): input is Record<string, number> {
  if (!object(input)) return false;
  const rules = PARAMETER_RULES[template];
  return (
    !!rules &&
    Object.keys(input).length === rules.length &&
    rules.every(
      (r) =>
        typeof input[r.key] === "number" &&
        Number.isFinite(input[r.key]) &&
        (input[r.key] as number) >= r.min &&
        (input[r.key] as number) <= r.max,
    )
  );
}
export function validProject(value: unknown): value is ProjectSpec {
  if (
    !object(value) ||
    Object.keys(value).length !== fields.length ||
    Object.keys(value).some((k) => !fields.includes(k)) ||
    value.version !== 1 ||
    !["vector-navigation", "quadratic-cost"].includes(String(value.template))
  )
    return false;
  const p = value as unknown as ProjectSpec;
  if (
    typeof p.id !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(p.id) ||
    typeof p.title !== "string" ||
    p.title.trim().length < 1 ||
    p.title.length > 80 ||
    typeof p.scenario !== "string" ||
    p.scenario.length > 240 ||
    ![p.question, p.prediction, p.observation, p.reflection].every(
      (s) => typeof s === "string" && s.length <= 2000,
    ) ||
    p.units !== (p.template === "vector-navigation" ? "m" : "USD") ||
    !date(p.createdAt) ||
    !date(p.updatedAt) ||
    Date.parse(p.updatedAt) < Date.parse(p.createdAt) ||
    !validParameters(p.template, p.parameters) ||
    !object(p.evidence)
  )
    return false;
  const e = p.evidence;
  return (
    Object.keys(e).sort().join(",") ===
      "attempts,checkedAt,goalMet,hintUsed,selfChecked" &&
    Number.isSafeInteger(e.attempts) &&
    e.attempts >= 0 &&
    e.attempts <= 10000 &&
    typeof e.hintUsed === "boolean" &&
    (e.goalMet === null || typeof e.goalMet === "boolean") &&
    typeof e.selfChecked === "boolean" &&
    (!e.selfChecked || p.reflection.trim().length >= 20) &&
    (e.checkedAt === null || date(e.checkedAt)) &&
    (e.attempts === 0
      ? e.checkedAt === null && e.goalMet === null
      : e.checkedAt !== null)
  );
}
export function validProjectCollection(value: unknown): value is ProjectSpec[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_PROJECTS &&
    Array.from(value).every(validProject) &&
    new Set(value.map((p) => p.id)).size === value.length
  );
}
export function parseProject(text: string): ProjectSpec {
  if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_BYTES)
    throw Error("Project exceeds the 250 KB import limit.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error("Choose a valid JSON project file.");
  }
  if (!validProject(value))
    throw Error(
      "This is not a supported version-1 project. Check its template, fields, units, finite parameter ranges, and attempt record.",
    );
  return structuredClone(value);
}
export function serializeProject(project: ProjectSpec) {
  if (!validProject(project))
    throw Error("Repair invalid project fields before exporting.");
  return JSON.stringify(project, null, 2);
}
