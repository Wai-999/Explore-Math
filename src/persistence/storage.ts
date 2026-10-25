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
};
export const STORAGE_KEY = "math-world-3d:v2";
export function parseLearning(text: string): Learning {
  if (text.length > 5000000) throw Error("Backup is too large (maximum 5 MB).");
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
  return {
    version: 2,
    theme: v.theme,
    depth: v.depth,
    solved: v.solved,
    bookmarks: v.bookmarks,
    attempts: v.attempts,
    studio: v.version === 2 ? v.studio : {},
    studioHistory: v.version === 2 ? v.studioHistory : [],
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
