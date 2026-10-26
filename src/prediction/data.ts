import { seeded } from "../assessment/challenges";
export type ProjectId = "energy" | "maintenance" | "demand";
export interface Observation {
  id: string;
  entity: string;
  time: number;
  x: number[];
  y: number;
  baseline: number;
  segment: string;
  split: "train" | "validation" | "test";
}
export interface Dataset {
  project: ProjectId;
  seed: number;
  rows: Observation[];
  features: string[];
  units: string;
  classification: boolean;
}
export function makeDataset(
  project: ProjectId,
  seed = 42,
  shift = false,
): Dataset {
  const random = seeded(seed),
    noise = () => random() + random() + random() + random() - 2;
  const rows: Observation[] = [];
  if (project === "energy") {
    for (let t = 0; t < 180; t++) {
      const temperature = 4 * random() - 2,
        production = 4 * random() - 2;
      const split = t < 100 ? "train" : t < 140 ? "validation" : "test";
      rows.push({
        id: `day-${t}`,
        entity: "factory-A",
        time: t,
        x: [temperature, production],
        y: Math.max(
          1,
          90 +
            12 * temperature +
            18 * production +
            5 * noise() +
            (shift && t >= 140 ? 25 : 0),
        ),
        baseline: 0,
        segment: temperature > 0 ? "warmer days" : "cooler days",
        split,
      });
    }
    const mean = rows.slice(0, 100).reduce((s, r) => s + r.y, 0) / 100;
    rows.forEach((r) => (r.baseline = mean));
    return {
      project,
      seed,
      rows,
      features: [
        "Temperature (standardized physical scale)",
        "Planned production (standardized physical scale)",
      ],
      units: "kWh / day",
      classification: false,
    };
  }
  if (project === "maintenance") {
    for (let machine = 0; machine < 48; machine++) {
      const groupNoise = noise() * 0.3,
        split = machine < 28 ? "train" : machine < 38 ? "validation" : "test";
      for (let visit = 0; visit < 4; visit++) {
        const vibration = 4 * random() - 2,
          heat = 4 * random() - 2;
        const probability =
          1 /
          (1 +
            Math.exp(
              -(
                -2.5 +
                1.35 * vibration +
                0.9 * heat +
                groupNoise +
                (shift && machine >= 38 ? 1.3 : 0)
              ),
            ));
        rows.push({
          id: `m${machine}-v${visit}`,
          entity: `machine-${machine}`,
          time: visit,
          x: [vibration, heat],
          y: random() < probability ? 1 : 0,
          baseline: 0,
          segment: machine % 2 ? "line A" : "line B",
          split,
        });
      }
    }
    const training = rows.filter((r) => r.split === "train"),
      rate = training.reduce((s, r) => s + r.y, 0) / training.length;
    rows.forEach((r) => (r.baseline = rate));
    return {
      project,
      seed,
      rows,
      features: ["Vibration index (unitless)", "Heat index (unitless)"],
      units: "failure probability within 48 hours",
      classification: true,
    };
  }
  for (let store = 0; store < 3; store++) {
    const history: number[] = [];
    for (let week = 0; week < 96; week++) {
      const season = Math.sin((2 * Math.PI * week) / 12),
        promotion = random() < 0.22 ? 1 : 0;
      const y = Math.max(
        0,
        100 +
          25 * store +
          0.65 * week +
          18 * season +
          15 * promotion +
          5 * noise() +
          (shift && week >= 78 ? 30 : 0),
      );
      history.push(y);
      if (week < 12) continue;
      rows.push({
        id: `s${store}-w${week}`,
        entity: `store-${store}`,
        time: week,
        x: [history[week - 1], season, promotion],
        y,
        baseline: history[week - 12],
        segment: `store ${store + 1}`,
        split: week < 60 ? "train" : week < 78 ? "validation" : "test",
      });
    }
  }
  return {
    project,
    seed,
    rows,
    features: [
      "Previous completed week (packs)",
      "Calendar season index (known in advance)",
      "Promotion approved before cutoff (0/1)",
    ],
    units: "packs / store-week",
    classification: false,
  };
}
export const partition = (data: Dataset, split: Observation["split"]) =>
  data.rows.filter((r) => r.split === split);
export function design(row: Observation, leak = false) {
  return leak ? [...row.x, row.y] : row.x;
}
export function rollingOrigins(data: Dataset) {
  if (data.project !== "demand") return [];
  return [42, 48, 54].map((cut) => ({
    cut,
    train: data.rows.filter((r) => r.time < cut),
    validation: data.rows.filter((r) => r.time >= cut && r.time < cut + 6),
  }));
}
export function splitAudit(data: Dataset) {
  const train = partition(data, "train"),
    validation = partition(data, "validation"),
    test = partition(data, "test");
  const groups = (rows: Observation[]) => new Set(rows.map((r) => r.entity));
  const overlaps = [...groups(train)].filter(
    (x) => groups(validation).has(x) || groups(test).has(x),
  );
  return {
    counts: [train.length, validation.length, test.length],
    groupOverlap: overlaps.length,
    chronological:
      Math.max(...train.map((r) => r.time)) <
        Math.min(...validation.map((r) => r.time)) &&
      Math.max(...validation.map((r) => r.time)) <
        Math.min(...test.map((r) => r.time)),
  };
}
