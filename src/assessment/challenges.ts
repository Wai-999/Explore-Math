import { rotation, type Mat3 } from "../math/linear";
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function satelliteChallenge(seed: number) {
  const r = seeded(seed);
  return {
    id: `satellite-${seed}`,
    angle: [30, 45, 60, -60, -90][Math.floor(r() * 5)],
    tolerance: 0.025,
    units: "unitless matrix entries",
    seed,
  };
}
export function gradeMatrix(m: Mat3, angle: number) {
  const target = rotation("z", angle);
  return m.every((v, i) => Math.abs(v - target[i]) <= 0.025);
}
export interface ChallengeEvidence {
  id: string;
  at: string;
  attempts: number;
  seed: number;
}
