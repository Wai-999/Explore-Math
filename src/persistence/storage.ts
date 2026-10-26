import { validProjectCollection, type ProjectSpec } from "../projects/schema";
import { validJourney, type JourneySession } from "../education/session";
import { conceptIds, type ConceptId } from "../education/model";
import type { ChallengeEvidence } from "../assessment/challenges";
import {
  validSession,
  type StudioSession,
  type StudioHistory,
} from "../prediction/session";
import type { ProjectId } from "../prediction/data";
export type Theme = "dark" | "light" | "system";
export interface Learning {
  version: 2;
  theme: Theme;
  depth: "intuition" | "foundations" | "advanced" | "research";
  solved: ChallengeEvidence[];
  bookmarks: string[];
  attempts: Record<string, number>;
  studio: Partial<Record<ProjectId, StudioSession>>;
  studioHistory: StudioHistory[];
  journeys: Partial<Record<ConceptId, JourneySession>>;
  projects: ProjectSpec[];
}
export const INITIAL: Learning = {
  version: 2,
  theme: "dark",
  depth: "intuition",
  solved: [],
  bookmarks: [],
  attempts: {},
  studio: {},
  studioHistory: [],
  journeys: {},
  projects: [],
};
export const STORAGE_KEY = "math-world-3d:v2";
export function parseLearning(text: string): Learning {
  if (new TextEncoder().encode(text).byteLength > 5000000)
    throw Error("Backup is too large (maximum 5 MB).");
  const v = JSON.parse(text);
  if (
    ![1, 2].includes(v?.version) ||
    !["dark", "light", "system"].includes(v.theme) ||
    !["intuition", "foundations", "advanced", "research"].includes(v.depth) ||
    !Array.isArray(v.solved) ||
    v.solved.length > 1000 ||
    !v.solved.every(
      (e: ChallengeEvidence) =>
        typeof e.id === "string" &&
        e.id.length < 100 &&
        typeof e.at === "string" &&
        Number.isFinite(Date.parse(e.at)) &&
        Number.isInteger(e.attempts) &&
        e.attempts > 0 &&
        Number.isInteger(e.seed),
    ) ||
    !Array.isArray(v.bookmarks) ||
    v.bookmarks.length > 100 ||
    !v.bookmarks.every(
      (x: unknown) => typeof x === "string" && x.length < 100,
    ) ||
    !v.attempts ||
    typeof v.attempts !== "object" ||
    Array.isArray(v.attempts) ||
    !Object.values(v.attempts).every(
      (x) => Number.isInteger(x) && Number(x) >= 0 && Number(x) < 100000,
    )
  )
    throw Error("This is not a valid Math World learning backup (v1 or v2).");
  if (
    v.version === 2 &&
    (!v.studio ||
      typeof v.studio !== "object" ||
      Array.isArray(v.studio) ||
      Object.entries(v.studio).some(
        ([key, value]) =>
          !["energy", "maintenance", "demand"].includes(key) ||
          !validSession(value) ||
          (!!value.model &&
            (value.model.classification !== (key === "maintenance") ||
              value.model.weights.length !==
                (key === "demand" ? 4 : 3) + (value.leak ? 1 : 0))),
      ) ||
      !Array.isArray(v.studioHistory) ||
      v.studioHistory.length > 100 ||
      v.studioHistory.some(
        (h: StudioHistory) =>
          !["energy", "maintenance", "demand"].includes(h.project) ||
          !Number.isInteger(h.seed) ||
          typeof h.at !== "string" ||
          !Number.isFinite(Date.parse(h.at)) ||
          ![h.hypothesis, h.interpretation, h.decision].every(
            (x) => typeof x === "string" && x.length <= 5000,
          ) ||
          typeof h.guided !== "boolean",
      ))
  )
    throw Error("Invalid prediction-studio session or experiment history.");
  if (
    v.journeys !== undefined &&
    (!v.journeys ||
      typeof v.journeys !== "object" ||
      Array.isArray(v.journeys) ||
      Object.entries(v.journeys).some(
        ([id, value]) =>
          !conceptIds.includes(id as ConceptId) ||
          !validJourney(value, id as ConceptId),
      ))
  )
    throw Error("Invalid guided-learning record.");
  if (v.projects !== undefined && !validProjectCollection(v.projects))
    throw Error("Invalid saved project collection.");
  return {
    version: 2,
    theme: v.theme,
    depth: v.depth,
    solved: v.solved,
    bookmarks: v.bookmarks,
    attempts: v.attempts,
    studio: v.version === 2 ? v.studio : {},
    studioHistory: v.version === 2 ? v.studioHistory : [],
    journeys: v.journeys || {},
    projects: v.projects || [],
  };
}
export function loadLearning(): { data: Learning; notice: string } {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("math-world-3d:v1");
    return { data: raw ? parseLearning(raw) : INITIAL, notice: "" };
  } catch {
    return {
      data: INITIAL,
      notice:
        "Your saved data could not be read. A fresh session is ready; the original data has not been overwritten.",
    };
  }
}

export const PRE_UPGRADE_KEY = "math-world-3d:before-guided-upgrade";
export const RECOVERY_KEY = "math-world-3d:protected-unreadable-data";
/** Backup-before-write is required: a failed backup must not overwrite the old key. */
export function persistLearning(data: Learning) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    let unreadable = false,
      legacy = false;
    try {
      const old = JSON.parse(raw);
      parseLearning(raw);
      legacy = old.journeys === undefined || old.projects === undefined;
    } catch {
      unreadable = true;
    }
    if (unreadable) localStorage.setItem(RECOVERY_KEY, raw);
    else if (legacy && !localStorage.getItem(PRE_UPGRADE_KEY))
      localStorage.setItem(PRE_UPGRADE_KEY, raw);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
export function originalLearningBackup() {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) {
    try {
      parseLearning(current);
    } catch {
      return current;
    }
  }
  return (
    localStorage.getItem(RECOVERY_KEY) ||
    localStorage.getItem(PRE_UPGRADE_KEY) ||
    localStorage.getItem("math-world-3d:v1") ||
    localStorage.getItem(STORAGE_KEY)
  );
}
