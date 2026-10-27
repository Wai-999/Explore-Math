import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendEvidence,
  freshJourney,
  practiceKey,
  problemWasGuided,
  recordGuidance,
  journeyStatus,
  validJourney,
  type AttemptEvidence,
  type ExperimentSnapshot,
  type JourneySession,
} from "./session";
import { conceptIds, defaults } from "./model";
import {
  INITIAL,
  PRE_UPGRADE_KEY,
  RECOVERY_KEY,
  STORAGE_KEY,
  loadLearning,
  originalLearningBackup,
  parseLearning,
  persistLearning,
  type Learning,
} from "../persistence/storage";
import { newProject } from "../projects/templates";
import { validProjectCollection } from "../projects/schema";
import {
  freshSession as freshPrediction,
  freezeSession,
  testSession,
} from "../prediction/session";
import { makeDataset, partition } from "../prediction/data";
import { fit } from "../prediction/model";

const NOW = "2026-10-26T12:00:00.000Z";
const REVIEW = "2026-11-02T12:00:00.000Z";
const V1_KEY = "math-world-3d:v1";
type NewEvidence = Omit<
  AttemptEvidence,
  "attemptNumber" | "at" | "seed" | "promptVersion"
>;
const evidence = (overrides: Partial<NewEvidence> = {}): NewEvidence => ({
  activity: "practice",
  correct: false,
  guided: false,
  response: ["1", "2"],
  rule: "principle",
  reasoning: "unreviewed",
  ...overrides,
});
const cleanLearning = (): Learning => structuredClone(INITIAL);
const legacyBase = () => ({
  version: 1,
  theme: "light",
  depth: "research",
  solved: [{ id: "satellite-11", at: NOW, attempts: 2, seed: 11 }],
  bookmarks: ["transform-space", "touch-change"],
  attempts: { "satellite-11": 2, camera: 4 },
});
function legacyV2() {
  const data = makeDataset("energy");
  const model = fit(partition(data, "train"));
  const studio = testSession(
    freezeSession({
      ...freshPrediction(),
      model,
      hypothesis:
        "Available production plans may improve the declared baseline.",
    }),
    NOW,
  );
  return {
    ...legacyBase(),
    version: 2,
    studio: { energy: studio },
    studioHistory: [
      {
        project: "energy",
        seed: 42,
        at: NOW,
        hypothesis: "A previously recorded hypothesis.",
        interpretation:
          "Small synthetic data does not establish real usefulness.",
        decision: "Hold for review.",
        guided: true,
      },
    ],
  };
}
function snapshot(s: JourneySession): ExperimentSnapshot {
  return {
    at: NOW,
    state: structuredClone(s.state),
    prediction: "Wind adds a horizontal displacement.",
    observation: "The endpoint changed when wind changed.",
    reflection: "This is displacement bookkeeping, not a full dynamics model.",
    dataVersion: "r1-v1",
  };
}

/** Atomic setItem behavior, with visible ordering and injectable quota failures. */
class MemoryStorage {
  readonly data = new Map<string, string>();
  readonly calls: { method: "get" | "set"; key: string; value?: string }[] = [];
  failWriteKey: string | null = null;
  getItem(key: string) {
    this.calls.push({ method: "get", key });
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.calls.push({ method: "set", key, value });
    if (key === this.failWriteKey)
      throw new DOMException("Storage quota failure", "QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  get length() {
    return this.data.size;
  }
  writes() {
    return this.calls.filter((call) => call.method === "set");
  }
}
let storage: MemoryStorage;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("guided learning evidence remains local, bounded and honest", () => {
  it.each(conceptIds)(
    "%s begins with an unassessed, valid independent copy of its defaults",
    (id) => {
      const before = structuredClone(defaults[id]);
      const first = freshJourney(id),
        second = freshJourney(id);
      expect(validJourney(first, id)).toBe(true);
      expect(first).toMatchObject({
        id,
        version: 1,
        lens: "discover",
        attempts: [],
        snapshots: [],
        reviewDueAt: null,
        hintUsed: false,
      });
      expect(journeyStatus(first)).toBe("Exploring");
      first.state.values[0] += 0.1;
      first.answers.push("an answer");
      expect(second.state).toEqual(before);
      expect(defaults[id]).toEqual(before);
      expect(second.answers).toEqual([]);
    },
  );
  it("counts attempts by seed and activity without inventing a global mastery level", () => {
    let s = freshJourney("vectors");
    s = appendEvidence(s, evidence(), NOW);
    s = appendEvidence(
      s,
      evidence({ activity: "proof-check", correct: true }),
      NOW,
    );
    s = appendEvidence(s, evidence(), NOW);
    s = appendEvidence({ ...s, seed: 34 }, evidence(), NOW);
    expect(
      s.attempts.map((a) => [a.seed, a.activity, a.attemptNumber]),
    ).toEqual([
      [17, "practice", 1],
      [17, "proof-check", 1],
      [17, "practice", 2],
      [34, "practice", 1],
    ]);
    expect(s.attempts.every((a) => a.promptVersion === 1 && a.at === NOW)).toBe(
      true,
    );
    expect(journeyStatus(s)).toBe("Practicing");
    expect(s.reviewDueAt).toBeNull();
  });
  it("keeps counters increasing even after the bounded history drops old records", () => {
    let s = freshJourney("vectors");
    for (let i = 0; i < 66; i++) s = appendEvidence(s, evidence(), NOW);
    expect(s.attempts).toHaveLength(60);
    expect(s.attempts.at(-1)!.attemptNumber).toBe(66);
    expect(new Set(s.attempts.map((a) => a.attemptNumber)).size).toBe(60);
    expect(validJourney(s, "vectors")).toBe(true);
  });
  it("hint use forces assisted evidence even when a caller supplies guided:false", () => {
    const s = appendEvidence(
      { ...freshJourney("vectors"), hintUsed: true },
      evidence({ correct: true, guided: false }),
      NOW,
    );
    expect(s.attempts.at(-1)).toMatchObject({ correct: true, guided: true });
    expect(s.reviewDueAt).toBeNull();
    expect(journeyStatus(s)).toBe("Practicing");
    const explicitlyGuided = appendEvidence(
      freshJourney("vectors"),
      evidence({ correct: true, guided: true }),
      NOW,
    );
    expect(explicitlyGuided.attempts.at(-1)!.guided).toBe(true);
    expect(explicitlyGuided.reviewDueAt).toBeNull();
  });
  it("records a seven-day suggested revisit only for correct unassisted practice", () => {
    const s = appendEvidence(
      freshJourney("derivatives"),
      evidence({ correct: true }),
      NOW,
    );
    expect(s.reviewDueAt).toBe(REVIEW);
    expect(journeyStatus(s, Date.parse(REVIEW) - 1)).toBe(
      "Independent numerical evidence",
    );
    expect(journeyStatus(s, Date.parse(REVIEW))).toBe("Review due");
    for (const e of [
      evidence(),
      evidence({ correct: true, guided: true }),
      evidence({ correct: true, activity: "proof-check" }),
    ]) {
      const other = appendEvidence(freshJourney("derivatives"), e, NOW);
      expect(other.reviewDueAt).toBeNull();
      expect(journeyStatus(other)).not.toBe("Independent numerical evidence");
    }
  });
  it("preserves arbitrary explanation text without calling it a graded proof or human review", () => {
    const explanation =
      "This is my unverified argument; the word proven here does not certify anything.";
    const s = appendEvidence(
      { ...freshJourney("matrices"), explanation },
      evidence({ activity: "proof-check", correct: true }),
      NOW,
    );
    expect(s.attempts.at(-1)).toMatchObject({
      explanation,
      reasoning: "unreviewed",
    });
    expect(s.reviewDueAt).toBeNull();
    expect(journeyStatus(s)).toBe("Exploring");
    expect(validJourney(s, "matrices")).toBe(true);
    const roundtrip = parseLearning(
      JSON.stringify({ ...cleanLearning(), journeys: { matrices: s } }),
    );
    expect(roundtrip.journeys.matrices!.attempts[0].explanation).toBe(
      explanation,
    );
    for (const reasoning of ["human-reviewed", "ai-graded", "mastered"])
      expect(
        validJourney(
          { ...s, attempts: [{ ...s.attempts[0], reasoning }] },
          "matrices",
        ),
      ).toBe(false);
  });
  it("keeps older attempt records without explanation compatible", () => {
    const s = appendEvidence(freshJourney("vectors"), evidence(), NOW);
    delete s.attempts[0].explanation;
    expect(validJourney(s, "vectors")).toBe(true);
    expect(
      parseLearning(
        JSON.stringify({ ...cleanLearning(), journeys: { vectors: s } }),
      ).journeys.vectors!.attempts[0].explanation,
    ).toBeUndefined();
  });
  it("rejects unsupported, sparse, oversized or malformed journey records", () => {
    const s = appendEvidence(freshJourney("vectors"), evidence(), NOW);
    const shot = snapshot(s);
    const invalid: unknown[] = [
      { ...s, version: 2 },
      { ...s, id: "derivatives" },
      { ...s, lens: "mastery" },
      { ...s, seed: 0 },
      { ...s, seed: NaN },
      { ...s, step: 9 },
      { ...s, updatedAt: "not a date" },
      { ...s, reviewDueAt: 7 },
      { ...s, prediction: "x".repeat(1001) },
      { ...s, explanation: "x".repeat(1001) },
      { ...s, answers: Array(2) },
      { ...s, answers: ["x".repeat(101)] },
      { ...s, attempts: Array(1) },
      { ...s, attempts: Array.from({ length: 61 }, () => s.attempts[0]) },
      { ...s, attempts: [{ ...s.attempts[0], promptVersion: 2 }] },
      { ...s, attempts: [{ ...s.attempts[0], response: Array(1) }] },
      { ...s, attempts: [{ ...s.attempts[0], explanation: "x".repeat(1001) }] },
      { ...s, snapshots: Array(1) },
      { ...s, snapshots: Array.from({ length: 11 }, () => shot) },
      { ...s, snapshots: [{ ...shot, dataVersion: "r1-v2" }] },
    ];
    for (const value of invalid)
      expect(validJourney(value, "vectors")).toBe(false);
    expect(validJourney({ ...s, snapshots: [shot] }, "vectors")).toBe(true);
  });
});

describe("additive backup migration retains prior work", () => {
  it("imports v1 learning with new defaults while preserving its historical fields", () => {
    const old = legacyBase(),
      raw = JSON.stringify(old, null, 2);
    const migrated = parseLearning(raw);
    expect(migrated).toEqual({
      ...old,
      version: 2,
      studio: {},
      studioHistory: [],
      journeys: {},
      projects: [],
    });
    expect(storage.writes()).toEqual([]);
  });
  it("imports legacy v2 without losing fitted prediction models, freeze locks, or history", () => {
    const old = legacyV2(),
      migrated = parseLearning(JSON.stringify(old));
    expect(migrated).toEqual({ ...old, journeys: {}, projects: [] });
    expect(migrated.studio.energy).toMatchObject({
      frozen: true,
      tested: true,
      testedAt: NOW,
    });
    expect(migrated.studio.energy!.model!.weights).toEqual(
      old.studio.energy.model!.weights,
    );
    expect(storage.writes()).toEqual([]);
  });
  it("roundtrips projects, journey evidence/snapshots, old progress and Prediction Studio together", () => {
    let journey = appendEvidence(
      {
        ...freshJourney("vectors"),
        explanation: "The two displacements use one coordinate frame.",
      },
      evidence({ correct: true }),
      NOW,
    );
    journey = { ...journey, snapshots: [snapshot(journey)] };
    const project = newProject("vector-navigation", "my-route", NOW);
    project.parameters.controlX = 6;
    project.parameters.controlY = 3;
    project.reflection =
      "This toy route reaches the target under a fixed known wind.";
    project.evidence = {
      attempts: 1,
      hintUsed: false,
      goalMet: true,
      selfChecked: true,
      checkedAt: NOW,
    };
    const second = newProject("quadratic-cost", "my-cost", NOW);
    const combined = {
      ...legacyV2(),
      journeys: { vectors: journey },
      projects: [project, second],
    } as Learning;
    const restored = parseLearning(JSON.stringify(combined));
    expect(restored).toEqual(combined);
    expect(restored.journeys.vectors!.attempts[0].reasoning).toBe("unreviewed");
    expect(restored.projects[0].evidence.selfChecked).toBe(true);
    expect(restored.studio.energy!.frozen).toBe(true);
  });
  it("rejects future schemas and corrupt combined records rather than partially importing", () => {
    const base = cleanLearning(),
      project = newProject("vector-navigation", "one", NOW),
      journey = freshJourney("vectors");
    for (const invalid of [
      { ...base, version: 3 },
      { ...base, journeys: { vectors: { ...journey, version: 2 } } },
      { ...base, journeys: { unknown: journey } },
      { ...base, projects: [{ ...project, version: 2 }] },
      { ...base, projects: [project, project] },
      { ...base, projects: [null] },
    ])
      expect(() => parseLearning(JSON.stringify(invalid))).toThrow();
  });
  it("rejects sparse project collections before serialization can turn holes into null", () => {
    expect(validProjectCollection(Array(1))).toBe(false);
  });
  it("enforces the outer backup byte limit for multibyte text", () => {
    const oversized = JSON.stringify({
      ...cleanLearning(),
      unusedNotes: "é".repeat(2_500_001),
    });
    expect(() => parseLearning(oversized)).toThrow(/too large/i);
  });
});

describe("backup-before-write and recoverable unreadable data", () => {
  it("loads old v1 without writing and retains its raw key through the first v2 save", () => {
    const raw = JSON.stringify(legacyBase(), null, 4) + "\n";
    storage.data.set(V1_KEY, raw);
    const loaded = loadLearning();
    expect(loaded.notice).toBe("");
    expect(loaded.data.solved).toEqual(legacyBase().solved);
    expect(storage.writes()).toEqual([]);
    expect(originalLearningBackup()).toBe(raw);
    persistLearning({
      ...loaded.data,
      journeys: { vectors: freshJourney("vectors") },
    });
    expect(storage.data.get(V1_KEY)).toBe(raw);
    expect(
      parseLearning(storage.data.get(STORAGE_KEY)!).journeys.vectors!.id,
    ).toBe("vectors");
  });
  it("copies raw legacy v2 exactly before replacing the active key", () => {
    const raw = JSON.stringify(legacyV2(), null, 4) + "\n";
    storage.data.set(STORAGE_KEY, raw);
    const next = parseLearning(raw);
    next.journeys.vectors = freshJourney("vectors");
    persistLearning(next);
    expect(storage.writes().map((call) => call.key)).toEqual([
      PRE_UPGRADE_KEY,
      STORAGE_KEY,
    ]);
    expect(storage.writes()[0].value).toBe(raw);
    expect(storage.data.get(PRE_UPGRADE_KEY)).toBe(raw);
    expect(parseLearning(storage.data.get(STORAGE_KEY)!)).toEqual({
      ...next,
      applied: { version: 1, sessions: {}, projects: [] },
    });
  });
  it("never replaces the old active key when the required backup fails", () => {
    const raw = JSON.stringify(legacyV2(), null, 2);
    storage.data.set(STORAGE_KEY, raw);
    storage.failWriteKey = PRE_UPGRADE_KEY;
    expect(() => persistLearning(parseLearning(raw))).toThrow();
    expect(storage.data.get(STORAGE_KEY)).toBe(raw);
    expect(storage.writes().some((call) => call.key === STORAGE_KEY)).toBe(
      false,
    );
  });
  it("retains both the backup and old active key if the final write fails", () => {
    const raw = JSON.stringify(legacyV2(), null, 2);
    storage.data.set(STORAGE_KEY, raw);
    storage.failWriteKey = STORAGE_KEY;
    expect(() => persistLearning(parseLearning(raw))).toThrow();
    expect(storage.data.get(PRE_UPGRADE_KEY)).toBe(raw);
    expect(storage.data.get(STORAGE_KEY)).toBe(raw);
  });
  it("preserves the first pre-upgrade snapshot and does not repeatedly rewrite it", () => {
    const protectedRaw = "previous raw snapshot",
      current = JSON.stringify(legacyV2());
    storage.data.set(PRE_UPGRADE_KEY, protectedRaw);
    storage.data.set(STORAGE_KEY, current);
    persistLearning(parseLearning(current));
    expect(storage.data.get(PRE_UPGRADE_KEY)).toBe(protectedRaw);
    expect(storage.writes().some((call) => call.key === PRE_UPGRADE_KEY)).toBe(
      false,
    );
    const firstSaved = storage.data.get(STORAGE_KEY)!;
    storage.calls.length = 0;
    persistLearning(parseLearning(firstSaved));
    expect(storage.writes().map((call) => call.key)).toEqual([STORAGE_KEY]);
  });
  it("does not overwrite unreadable data while loading, then protects it before a fresh save", () => {
    const raw = "{broken later learning data — keep this exact text";
    storage.data.set(STORAGE_KEY, raw);
    const loaded = loadLearning();
    expect(loaded.notice).toMatch(/could not be read/i);
    expect(loaded.data).toEqual(INITIAL);
    expect(storage.data.get(STORAGE_KEY)).toBe(raw);
    expect(storage.writes()).toEqual([]);
    persistLearning(cleanLearning());
    expect(storage.writes().map((call) => call.key)).toEqual([
      RECOVERY_KEY,
      STORAGE_KEY,
    ]);
    expect(storage.data.get(RECOVERY_KEY)).toBe(raw);
    expect(parseLearning(storage.data.get(STORAGE_KEY)!)).toEqual(INITIAL);
  });
  it("refuses to replace unreadable current data if its recovery write fails", () => {
    const raw = '{"version":99,"notes":"valuable future data"}';
    storage.data.set(STORAGE_KEY, raw);
    storage.failWriteKey = RECOVERY_KEY;
    expect(() => persistLearning(cleanLearning())).toThrow();
    expect(storage.data.get(STORAGE_KEY)).toBe(raw);
    expect(storage.writes().some((call) => call.key === STORAGE_KEY)).toBe(
      false,
    );
  });
  it("can download the current unreadable raw key without writing, even when older backups exist", () => {
    const current = "{current unreadable V2 notes";
    storage.data.set(STORAGE_KEY, current);
    storage.data.set(V1_KEY, JSON.stringify(legacyBase()));
    storage.data.set(PRE_UPGRADE_KEY, "older pre-upgrade snapshot");
    expect(originalLearningBackup()).toBe(current);
    expect(storage.writes()).toEqual([]);
    expect(storage.data.get(STORAGE_KEY)).toBe(current);
  });
  it("offers protected recovery data after a successful fresh save without more mutation", () => {
    const raw = "{unreadable data";
    storage.data.set(STORAGE_KEY, raw);
    persistLearning(cleanLearning());
    storage.calls.length = 0;
    expect(originalLearningBackup()).toBe(raw);
    expect(storage.writes()).toEqual([]);
  });
});

describe("guidance survives repeated problem text and seed changes", () => {
  it("retains a hint even before any attempt, after reload and a different seed", () => {
    const original = { ...freshJourney("derivatives"), seed: 34 };
    const helped = recordGuidance(original);
    const repeated = {
      ...JSON.parse(JSON.stringify(helped)),
      seed: 85,
      hintUsed: false,
    };
    expect(practiceKey("derivatives", 34)).toBe(practiceKey("derivatives", 85));
    expect(validJourney(repeated, "derivatives")).toBe(true);
    expect(problemWasGuided(repeated)).toBe(true);
    const result = appendEvidence(repeated, evidence({ correct: true }), NOW);
    expect(result.attempts.at(-1)?.guided).toBe(true);
    expect(result.reviewDueAt).toBeNull();
  });
  it("does not mark a different problem guided and keeps the original attempt chronology", () => {
    const independent = appendEvidence(
      freshJourney("vectors"),
      evidence({ correct: true }),
      NOW,
    );
    const helped = recordGuidance(independent);
    expect(helped.attempts[0].guided).toBe(false);
    expect(problemWasGuided({ ...helped, seed: 34, hintUsed: false })).toBe(
      false,
    );
  });
  it("retains guidance when bounded attempt history is evicted", () => {
    let s = recordGuidance({ ...freshJourney("derivatives"), seed: 34 });
    for (let i = 0; i < 65; i++)
      s = appendEvidence(
        { ...s, seed: 17 + i * 51, hintUsed: false },
        evidence(),
        NOW,
      );
    expect(s.attempts).toHaveLength(60);
    expect(problemWasGuided({ ...s, seed: 85, hintUsed: false })).toBe(true);
  });
  it("rejects malformed and sparse guidance imports, and handles ledger saturation conservatively", () => {
    const s = freshJourney("vectors");
    expect(
      validJourney({ ...s, guidedProblems: ["not a key"] }, "vectors"),
    ).toBe(false);
    expect(
      validJourney({ ...s, guidedProblems: new Array(1) }, "vectors"),
    ).toBe(false);
    const saturated = {
      ...s,
      guidedProblems: Array.from({ length: 5000 }, (_, i) =>
        i.toString(16).padStart(16, "0"),
      ),
    };
    expect(validJourney(saturated, "vectors")).toBe(true);
    expect(problemWasGuided(saturated)).toBe(true);
    expect(recordGuidance(saturated).guidedProblems).toHaveLength(5000);
  });
});
