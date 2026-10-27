import type { Vec3 } from "../math/linear";
import type { DerivationStep } from "../content/concepts";
export const worldIds = [
  "sales",
  "marketing",
  "ml",
  "robotics",
  "finance",
  "gis",
] as const;
export type WorldId = (typeof worldIds)[number];
export type Params = Record<string, number>;
export type Pair = [number, number];
export type Matrix2 = [Pair, Pair];
export interface Rule {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
}
export interface Analysis {
  value: number;
  gradient: Pair | null;
  hessian?: Matrix2;
  metrics: [string, string][];
  matrix: number[][];
  matrixLabel: string;
  interpretation: string;
  warnings: string[];
  feasible: boolean;
}
export interface Geometry {
  points: Vec3[];
  size: number;
  valid: boolean[];
  marker: Vec3;
  gradient?: [Vec3, Vec3];
  lines: { points: Vec3[]; color: string; label: string }[];
  spheres: { point: Vec3; radius: number; color: string; label: string }[];
  labels: [string, string, string];
  range: Pair;
  draggable: boolean;
}
export interface Mission {
  params: Params;
  question: string;
  hint: string;
  solution: string;
  choices: [string, string][];
  correctRule: string;
  grade: (p: Params) => { correct: boolean; feedback: string };
}
export interface Definition {
  id: WorldId;
  title: string;
  question: string;
  analogy: string;
  output: string;
  assumptions: string[];
  glossary: [string, string][];
  limit: string;
  formula: string;
  predict: string;
  predictionChoices: [string, string][];
  predictionAnswer: string;
  feasible?: (p: Params) => boolean;
  analyze: (p: Params) => Analysis;
  scalar: (p: Params, x: number, y: number) => number;
  derive: (p: Params) => DerivationStep[];
  examples: { title: string; params: Params; steps: string[] }[];
  edge: { title: string; params: Params; explanation: string };
  mission: (seed: number, level: number) => Mission;
  python: (p: Params) => string;
  geometry?: (p: Params) => Geometry;
  lines?: (
    p: Params,
    to: (x: number, y: number, z: number) => Vec3,
  ) => Geometry["lines"];
  step?: (p: Params) => Params;
  holdout?: (p: Params) => number;
  related: { url: string; label: string };
}
export const f = (n: number, d = 3) =>
  Number.isFinite(n) ? String(Number(n.toFixed(d))) : "undefined";
export const pair = (v: number[]) => `(${v.map((n) => f(n)).join(", ")})`;
export const proof = (
  statement: string,
  justification: string,
  rule: DerivationStep["rule"] = "algebra",
  linkedVisualState = "surface",
): DerivationStep => ({ statement, justification, rule, linkedVisualState });
