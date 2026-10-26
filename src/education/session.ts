import {
  conceptIds,
  defaults,
  validState,
  makePractice,
  type ConceptId,
  type Lens,
  type SemanticState,
} from "./model";
export interface AttemptEvidence {
  activity: "practice" | "proof-check";
  at: string;
  seed: number;
  promptVersion: 1;
  attemptNumber: number;
  correct: boolean;
  guided: boolean;
  response: string[];
  rule: string;
  reasoning: "unreviewed" | "self-checked";
  explanation?: string;
}
export interface ExperimentSnapshot {
  at: string;
  state: SemanticState;
  prediction: string;
  observation: string;
  reflection: string;
  dataVersion: "r1-v1";
}
export interface JourneySession {
  version: 1;
  id: ConceptId;
  lens: Lens;
  state: SemanticState;
  seed: number;
  step: number;
  guideDismissed: boolean;
  hintUsed: boolean;
  guidedProblems?: string[];
  prediction: string;
  explanation: string;
  answers: string[];
  rule: string;
  attempts: AttemptEvidence[];
  snapshots: ExperimentSnapshot[];
  updatedAt: string;
  reviewDueAt: string | null;
}
export function freshJourney(id: ConceptId): JourneySession {
  if (!conceptIds.includes(id)) throw Error("Unknown concept.");
  return {
    version: 1,
    id,
    lens: "discover",
    state: structuredClone(defaults[id]),
    seed: 17,
    step: 0,
    guideDismissed: false,
    hintUsed: false,
    prediction: "",
    explanation: "",
    answers: [],
    rule: "",
    attempts: [],
    snapshots: [],
    updatedAt: new Date().toISOString(),
    reviewDueAt: null,
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const date = (s: unknown): s is string =>
  typeof s === "string" && Number.isFinite(Date.parse(s));
const text = (s: unknown, max = 1000): s is string =>
  typeof s === "string" && s.length <= max;
const seed = (s: unknown): s is number =>
  Number.isSafeInteger(s) && Number(s) > 0 && Number(s) < 1e9;
export function validJourney(v: unknown, id: ConceptId): v is JourneySession {
  if (
    !object(v) ||
    !conceptIds.includes(id) ||
    v.id !== id ||
    v.version !== 1 ||
    !validState(id, v.state) ||
    !["discover", "understand", "justify", "apply"].includes(String(v.lens)) ||
    !seed(v.seed) ||
    !Number.isInteger(v.step) ||
    Number(v.step) < 0 ||
    Number(v.step) > 8 ||
    typeof v.guideDismissed !== "boolean" ||
    typeof v.hintUsed !== "boolean" ||
    (v.guidedProblems !== undefined &&
      (!Array.isArray(v.guidedProblems) ||
        v.guidedProblems.length > 5000 ||
        !Array.from(v.guidedProblems).every(
          (x) => typeof x === "string" && /^[0-9a-f]{16}$/.test(x),
        ))) ||
    !text(v.prediction) ||
    !text(v.explanation) ||
    !Array.isArray(v.answers) ||
    v.answers.length > 3 ||
    !Array.from(v.answers).every((x) => text(x, 100)) ||
    !text(v.rule, 100) ||
    !date(v.updatedAt) ||
    (v.reviewDueAt !== null && !date(v.reviewDueAt)) ||
    !Array.isArray(v.attempts) ||
    v.attempts.length > 60 ||
    !Array.isArray(v.snapshots) ||
    v.snapshots.length > 10
  )
    return false;
  return (
    Array.from(v.attempts).every(
      (e) =>
        object(e) &&
        ["practice", "proof-check"].includes(String(e.activity)) &&
        date(e.at) &&
        seed(e.seed) &&
        e.promptVersion === 1 &&
        Number.isInteger(e.attemptNumber) &&
        Number(e.attemptNumber) > 0 &&
        Number(e.attemptNumber) < 10000 &&
        typeof e.correct === "boolean" &&
        typeof e.guided === "boolean" &&
        Array.isArray(e.response) &&
        e.response.length <= 3 &&
        (e.explanation === undefined || text(e.explanation)) &&
        Array.from(e.response).every((x) => text(x, 100)) &&
        text(e.rule, 100) &&
        ["unreviewed", "self-checked"].includes(String(e.reasoning)),
    ) &&
    Array.from(v.snapshots).every(
      (s) =>
        object(s) &&
        date(s.at) &&
        validState(id, s.state) &&
        text(s.prediction) &&
        text(s.observation) &&
        text(s.reflection) &&
        s.dataVersion === "r1-v1",
    )
  );
}
export function appendEvidence(
  s: JourneySession,
  e: Omit<AttemptEvidence, "attemptNumber" | "at" | "seed" | "promptVersion">,
  at = new Date().toISOString(),
): JourneySession {
  const attemptNumber =
    Math.max(
      0,
      ...s.attempts
        .filter((a) => a.seed === s.seed && a.activity === e.activity)
        .map((a) => a.attemptNumber),
    ) + 1;
  if (attemptNumber >= 10000)
    throw Error("Attempt limit reached for this case. Try fresh parameters.");
  const attempt: AttemptEvidence = {
    ...e,
    guided:
      e.guided ||
      (e.activity === "practice" ? problemWasGuided(s) : s.hintUsed),
    explanation: s.explanation,
    at,
    seed: s.seed,
    promptVersion: 1,
    attemptNumber,
  };
  return {
    ...s,
    attempts: [...s.attempts.slice(-59), attempt],
    updatedAt: at,
    reviewDueAt:
      attempt.activity === "practice" && attempt.correct && !attempt.guided
        ? new Date(Date.parse(at) + 7 * 86400000).toISOString()
        : s.reviewDueAt,
  };
}
export function journeyStatus(s: JourneySession, now = Date.now()) {
  if (s.reviewDueAt && Date.parse(s.reviewDueAt) <= now) return "Review due";
  if (
    s.attempts.some((e) => e.activity === "practice" && e.correct && !e.guided)
  )
    return "Independent numerical evidence";
  if (s.attempts.some((e) => e.activity === "practice")) return "Practicing";
  return "Exploring";
}

// A stable identifier for repeated prompts, not a security hash or proof score.
export function practiceKey(id: ConceptId, seed: number): string {
  const prompt = makePractice(id, seed).question;
  let a = 2166136261,
    b = 5381;
  for (const char of prompt) {
    a = Math.imul(a ^ char.charCodeAt(0), 16777619);
    b = Math.imul(b, 33) ^ char.charCodeAt(0);
  }
  return (
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0")
  );
}
export function problemWasGuided(s: JourneySession): boolean {
  const key = practiceKey(s.id, s.seed);
  return (
    s.hintUsed ||
    (s.guidedProblems?.length ?? 0) >= 5000 ||
    !!s.guidedProblems?.includes(key) ||
    s.attempts.some(
      (a) =>
        a.activity === "practice" &&
        a.guided &&
        practiceKey(s.id, a.seed) === key,
    )
  );
}
export function recordGuidance(s: JourneySession): JourneySession {
  const keys = new Set(s.guidedProblems || []);
  if (keys.size < 5000) keys.add(practiceKey(s.id, s.seed));
  return {
    ...s,
    hintUsed: true,
    guidedProblems: [...keys],
    updatedAt: new Date().toISOString(),
  };
}
