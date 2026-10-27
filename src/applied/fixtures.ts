import type { Pair, Params } from "./types";
export const TRAIN_X: Pair[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
];
export const TRAIN_Y = [2, 3, 5, 7];
// Residual targets above the fixed 20-meal intercept. Distinct from training.
export const HOLDOUT_X: Pair[] = [
  [1.5, 0.5],
  [0.5, 2],
  [2, 2],
];
export const HOLDOUT_Y = [4.7, 7.3, 9.8];
export const heldoutLoss = (p: Params) =>
  HOLDOUT_X.reduce(
    (s, row, i) => s + (row[0] * p.x + row[1] * p.y - HOLDOUT_Y[i]) ** 2,
    0,
  ) / HOLDOUT_Y.length;
