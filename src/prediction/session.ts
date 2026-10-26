import type { ProjectId } from "./data";
import type { Model } from "./model";
export interface StudioSession {
  seed: number;
  stage: number;
  model: Model | null;
  leak: boolean;
  lambda: number;
  rate: number;
  threshold: number;
  frozen: boolean;
  tested: boolean;
  shift: boolean;
  method: "gradient" | "stump";
  hypothesis: string;
  interpretation: string;
  decision: string;
  answers: Record<string, string>;
  hintUsed: boolean;
  testedAt: string | null;
  misconceptions?: string[];
}
export interface StudioHistory {
  project: ProjectId;
  seed: number;
  at: string;
  hypothesis: string;
  interpretation: string;
  decision: string;
  guided: boolean;
}
export const freshSession = (seed = 42): StudioSession => ({
  seed,
  stage: 0,
  model: null,
  leak: false,
  lambda: 0,
  rate: 0.15,
  threshold: 0.3,
  frozen: false,
  tested: false,
  shift: false,
  method: "gradient",
  hypothesis: "",
  interpretation: "",
  decision: "",
  answers: {},
  hintUsed: false,
  testedAt: null,
  misconceptions: [],
});
export function validSession(v: unknown): v is StudioSession {
  if (!v || typeof v !== "object") return false;
  const s = v as StudioSession;
  const finite = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  if (
    !Number.isSafeInteger(s.seed) ||
    s.seed < 0 ||
    !Number.isInteger(s.stage) ||
    s.stage < 0 ||
    s.stage > 7 ||
    !finite(s.lambda, 0, 10) ||
    !finite(s.rate, 0.001, 1) ||
    !finite(s.threshold, 0, 1) ||
    ![s.leak, s.frozen, s.tested, s.shift, s.hintUsed].every(
      (x) => typeof x === "boolean",
    ) ||
    !["gradient", "stump"].includes(s.method) ||
    ![s.hypothesis, s.interpretation, s.decision].every(
      (x) => typeof x === "string" && x.length <= 5000,
    ) ||
    !s.answers ||
    typeof s.answers !== "object" ||
    Array.isArray(s.answers) ||
    Object.values(s.answers).some(
      (x) => typeof x !== "string" || x.length > 1000,
    ) ||
    (s.misconceptions !== undefined &&
      (!Array.isArray(s.misconceptions) ||
        s.misconceptions.length > 10 ||
        s.misconceptions.some(
          (x) => typeof x !== "string" || x.length > 200,
        ))) ||
    (s.tested && !s.frozen) ||
    (s.tested && s.testedAt === null) ||
    (s.testedAt !== null &&
      (typeof s.testedAt !== "string" ||
        !Number.isFinite(Date.parse(s.testedAt))))
  )
    return false;
  if (s.model !== null) {
    const m = s.model;
    if (
      !m ||
      !Array.isArray(m.weights) ||
      m.weights.length < 3 ||
      m.weights.length > 5 ||
      m.weights.some((x) => !finite(x, -1e5, 1e5)) ||
      !m.prep ||
      !Array.isArray(m.prep.means) ||
      !Array.isArray(m.prep.scales) ||
      m.prep.means.length !== m.weights.length - 1 ||
      m.prep.scales.length !== m.prep.means.length ||
      m.prep.means.some((x) => !finite(x, -1e6, 1e6)) ||
      m.prep.scales.some((x) => !finite(x, 1e-12, 1e6)) ||
      !finite(m.prep.targetMean, -1e6, 1e6) ||
      !finite(m.prep.targetScale, 1e-12, 1e6) ||
      typeof m.classification !== "boolean" ||
      typeof m.leak !== "boolean" ||
      m.leak !== s.leak ||
      !finite(m.lambda, 0, 10) ||
      !Number.isInteger(m.iterations) ||
      m.iterations < 0 ||
      m.iterations > 100000 ||
      !Array.isArray(m.losses) ||
      m.losses.length > 200 ||
      m.losses.some((x) => !finite(x, 0, 1e12)) ||
      !["ready", "unstable"].includes(m.status)
    )
      return false;
  }
  return (
    !s.frozen ||
    (!s.leak &&
      s.model !== null &&
      s.model.iterations > 0 &&
      s.model.status === "ready" &&
      s.hypothesis.trim().length >= 20)
  );
}
export function canFreeze(s: StudioSession) {
  return (
    !s.leak &&
    !!s.model &&
    s.model.iterations > 0 &&
    s.model.status === "ready" &&
    s.hypothesis.trim().length >= 20
  );
}
export function freezeSession(s: StudioSession): StudioSession {
  if (!canFreeze(s))
    throw Error(
      "Train a valid model, remove future information, and record a hypothesis before freezing.",
    );
  return { ...s, frozen: true };
}
export function testSession(
  s: StudioSession,
  at = new Date().toISOString(),
): StudioSession {
  if (!s.frozen || s.tested)
    throw Error(
      "Final evaluation requires one frozen, unevaluated experiment.",
    );
  return { ...s, tested: true, testedAt: at };
}
export function mutateSession(
  s: StudioSession,
  patch: Partial<StudioSession>,
): StudioSession {
  const locked = [
    "model",
    "leak",
    "lambda",
    "rate",
    "threshold",
    "shift",
    "method",
    "seed",
  ];
  if (s.frozen && Object.keys(patch).some((k) => locked.includes(k)))
    throw Error(
      "The tested protocol is locked. Start a fresh seeded experiment to change it.",
    );
  return { ...s, ...patch };
}
