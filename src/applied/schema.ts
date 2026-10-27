import { heldoutLoss } from "./fixtures";
import { worldIds, type Params, type Rule, type WorldId } from "./types";
const rule = (
  key: string,
  label: string,
  unit: string,
  min: number,
  max: number,
  value: number,
  step = 0.1,
): Rule => ({ key, label, unit, min, max, value, step });
export const rules: Record<WorldId, Rule[]> = {
  sales: [
    rule("x", "Price", "$/item", 0, 40, 20),
    rule("y", "Sales effort", "h/day", 0, 8, 2),
    rule("k", "Unit cost", "$/item", 1, 20, 8),
    rule("h", "Effort cost", "$/h", 1, 15, 5),
    rule("mix", "Segment 1 weight", "share", 0, 1, 0.5, 0.05),
    rule("cap", "Stock capacity", "items/day", 10, 150, 120, 1),
    rule("budget", "Staff budget", "$/day", 5, 120, 40, 1),
    rule("uncertainty", "Intercept sensitivity", "fraction", 0, 0.3, 0.2, 0.05),
  ],
  marketing: [
    rule("x", "Channel A spend", "$/day", 0, 100, 40, 1),
    rule("y", "Channel B spend", "$/day", 0, 100, 40, 1),
    rule("budget", "Total budget", "$/day", 40, 160, 100, 1),
    rule("a", "Channel A ceiling", "conversions/day", 5, 60, 30, 1),
    rule("b", "Channel B ceiling", "conversions/day", 5, 60, 20, 1),
    rule("k1", "Channel A response rate", "day/$", 0.005, 0.08, 0.03, 0.005),
    rule("k2", "Channel B response rate", "day/$", 0.005, 0.08, 0.02, 0.005),
    rule("margin", "Conversion margin", "$/conversion", 1, 20, 5),
    rule("baseline", "Baseline", "conversions/day", 0, 100, 20, 1),
    rule("minimum", "Minimum per channel", "$/day", 0, 20, 0, 1),
  ],
  ml: [
    rule("x", "Weight 1", "meals/feature unit", -2, 8, 0),
    rule("y", "Weight 2", "meals/feature unit", -2, 8, 0),
    rule("alpha", "Learning rate", "scaled step", 0.01, 1, 0.1, 0.01),
    rule("view", "Feature-space view", "0 loss / 1 data", 0, 1, 0, 1),
  ],
  robotics: [
    rule("x", "Joint 1 angle", "degrees", -150, 150, 20, 1),
    rule("y", "Joint 2 angle", "degrees", -150, 150, -10, 1),
    rule("l1", "Link 1 length", "m", 0.8, 1.5, 1.3),
    rule("l2", "Link 2 length", "m", 0.8, 1.5, 1.1),
    rule("v1", "Joint 1 rate", "rad/s", -1, 1, 0.2),
    rule("v2", "Joint 2 rate", "rad/s", -1, 1, 0.1),
    rule("tx", "Target x", "m", -3, 3, 1.9),
    rule("ty", "Target y", "m", -3, 3, 0.6),
  ],
  finance: [
    rule("x", "Production quantity", "items/day", 0, 80, 20, 1),
    rule("y", "Investment spend", "$/day", 0, 60, 10, 1),
    rule("demand", "Base price", "$/item", 20, 30, 24),
    rule("cost", "Unit production cost", "$/item", 4, 12, 6),
    rule("budget", "Resource budget", "$/day", 80, 220, 160, 1),
  ],
  gis: [
    rule("x", "Probe x", "m", 0, 4, 1),
    rule("y", "Probe y", "m", 0, 4, 1),
    rule("route", "Route alternative", "index", 0, 3, 0, 1),
    rule("dx", "Probe direction x", "m/unit t", -2, 2, 1),
    rule("dy", "Probe direction y", "m/unit t", -2, 2, 2),
    rule("edge", "Edge 0–1 multiplier", "factor", 0.5, 3, 1),
    rule("climb", "Ascent penalty", "cost/m", 0, 4, 1),
  ],
};
export const defaults = (id: WorldId): Params =>
  Object.fromEntries(rules[id].map((r) => [r.key, r.value]));
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function validParams(id: WorldId, p: unknown): p is Params {
  return (
    obj(p) &&
    worldIds.includes(id) &&
    Object.keys(p).length === rules[id].length &&
    rules[id].every(
      (r) =>
        typeof p[r.key] === "number" &&
        Number.isFinite(p[r.key]) &&
        Number(p[r.key]) >= r.min &&
        Number(p[r.key]) <= r.max &&
        (!["route", "view"].includes(r.key) || Number.isInteger(p[r.key])),
    )
  );
}
export interface Attempt {
  at: string;
  seed: number;
  level: number;
  correct: boolean;
  guided: boolean;
  rule: string;
  params: Params;
  reasoning: "unreviewed" | "self-checked";
}
export interface RecordState {
  version: 1;
  stage: number;
  depth: number;
  params: Params;
  seed: number;
  level: number;
  prediction: string;
  reflection: string;
  guidance: string[];
  attempts: Attempt[];
  visited: number[];
  frozen?: { params: Params; seed: number; loss: number };
}
export interface WorldProject {
  kind: "applied-world-project";
  assumptions: string[];
  version: 1;
  world: WorldId;
  id: string;
  title: string;
  createdAt: string;
  record: RecordState;
}
export interface AppliedState {
  version: 1;
  sessions: Partial<Record<WorldId, RecordState>>;
  projects: WorldProject[];
}
export const emptyApplied = (): AppliedState => ({
  version: 1,
  sessions: {},
  projects: [],
});
const str = (v: unknown, max = 2000): v is string =>
  typeof v === "string" && v.length <= max;
const date = (v: unknown) => str(v, 40) && Number.isFinite(Date.parse(v));
const integer = (v: unknown, min: number, max: number) =>
  Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
export function validRecord(id: WorldId, v: unknown): v is RecordState {
  if (
    !obj(v) ||
    Object.keys(v).some(
      (k) =>
        ![
          "version",
          "stage",
          "depth",
          "params",
          "seed",
          "level",
          "prediction",
          "reflection",
          "guidance",
          "attempts",
          "visited",
          "frozen",
        ].includes(k),
    ) ||
    v.version !== 1 ||
    !validParams(id, v.params) ||
    !integer(v.stage, 0, 5) ||
    !integer(v.depth, 0, 2) ||
    !integer(v.seed, 1, 1e8) ||
    !integer(v.level, 1, 3) ||
    !str(v.prediction) ||
    !str(v.reflection) ||
    !Array.isArray(v.guidance) ||
    v.guidance.length > 1000 ||
    !Array.from(v.guidance).every((k) => str(k, 1500)) ||
    !Array.isArray(v.visited) ||
    v.visited.length > 6 ||
    !Array.from(v.visited).every((k) => integer(k, 0, 5)) ||
    !Array.isArray(v.attempts) ||
    v.attempts.length > 100
  )
    return false;
  if (
    v.frozen !== undefined &&
    (!obj(v.frozen) ||
      id !== "ml" ||
      Object.keys(v.frozen).sort().join() !== "loss,params,seed" ||
      !validParams(id, v.frozen.params) ||
      !integer(v.frozen.seed, 1, 1e8) ||
      typeof v.frozen.loss !== "number" ||
      !Number.isFinite(v.frozen.loss) ||
      v.frozen.loss < 0 ||
      v.frozen.seed !== v.seed ||
      !Object.entries(v.frozen.params as Params).every(
        ([k, value]) => value === (v.params as Params)[k],
      ) ||
      Math.abs(v.frozen.loss - heldoutLoss(v.frozen.params as Params)) > 1e-9)
  )
    return false;
  return Array.from(v.attempts).every(
    (a) =>
      obj(a) &&
      Object.keys(a).sort().join() ===
        "at,correct,guided,level,params,reasoning,rule,seed" &&
      date(a.at) &&
      integer(a.seed, 1, 1e8) &&
      integer(a.level, 1, 3) &&
      typeof a.correct === "boolean" &&
      typeof a.guided === "boolean" &&
      str(a.rule, 100) &&
      validParams(id, a.params) &&
      ["unreviewed", "self-checked"].includes(String(a.reasoning)),
  );
}
export const fresh = (id: WorldId): RecordState => ({
  version: 1,
  stage: 0,
  depth: 0,
  params: defaults(id),
  seed: 17,
  level: 1,
  prediction: "",
  reflection: "",
  guidance: [],
  attempts: [],
  visited: [0],
});
export function validWorldProject(v: unknown): v is WorldProject {
  return (
    obj(v) &&
    Object.keys(v).sort().join() ===
      "assumptions,createdAt,id,kind,record,title,version,world" &&
    Array.isArray(v.assumptions) &&
    v.assumptions.length > 0 &&
    v.assumptions.length <= 20 &&
    Array.from(v.assumptions).every((s) => str(s, 600)) &&
    v.kind === "applied-world-project" &&
    v.version === 1 &&
    worldIds.includes(v.world as WorldId) &&
    str(v.id, 100) &&
    /^[a-zA-Z0-9_-]+$/.test(v.id) &&
    str(v.title, 100) &&
    v.title.trim().length > 0 &&
    date(v.createdAt) &&
    validRecord(v.world as WorldId, v.record)
  );
}
export function validApplied(v: unknown): v is AppliedState {
  return (
    obj(v) &&
    Object.keys(v).sort().join() === "projects,sessions,version" &&
    v.version === 1 &&
    obj(v.sessions) &&
    Object.entries(v.sessions).every(
      ([k, r]) =>
        worldIds.includes(k as WorldId) && validRecord(k as WorldId, r),
    ) &&
    Array.isArray(v.projects) &&
    v.projects.length <= 20 &&
    Array.from(v.projects).every(validWorldProject) &&
    new Set(v.projects.map((p) => p.id)).size === v.projects.length
  );
}
export function readProject(text: string): WorldProject {
  if (new TextEncoder().encode(text).length > 128000)
    throw Error("Project exceeds 128 KB.");
  const p: unknown = JSON.parse(text);
  if (!validWorldProject(p))
    throw Error(
      "Unsupported or invalid applied project: expected version 1, known world, finite bounded inputs and valid evidence.",
    );
  return p;
}
