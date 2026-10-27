import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { defaults } from "./schema";
import { finiteDifference } from "./math";
import {
  definition,
  dijkstra,
  edgeCost,
  graph,
  routeCost,
  terrain,
  terrainGradient,
} from "./models/gis";
describe("Terrain rates and nonnegative graph routes", () => {
  it("matches terrain and chain-rule fixtures with finite differences", () => {
    expect(terrain(0, 0)).toBe(0);
    expect(terrain(2, 1)).toBeCloseTo(0.8, 12);
    const g = terrainGradient(2, 1);
    expect(g[0]).toBeCloseTo(0.65, 12);
    expect(g[1]).toBeCloseTo(0.3, 12);
    expect(g[0] + 2 * g[1]).toBeCloseTo(1.25, 12);
    for (const [x, y] of [
      [0, 0],
      [1, 2],
      [3, 1],
      [4, 4],
    ])
      finiteDifference(terrain, x, y).forEach((v, i) =>
        expect(v).toBeCloseTo(terrainGradient(x, y)[i], 8),
      );
  });
  it("checks Dijkstra against independent simple-path enumeration and known graph distances", () => {
    expect(
      dijkstra(
        [
          [0, 2, 9],
          [2, 0, 3],
          [9, 3, 0],
        ],
        0,
        2,
      ),
    ).toMatchObject({ distance: 5, path: [0, 1, 2] });
    expect(
      dijkstra(
        [
          [0, Infinity],
          [Infinity, 0],
        ],
        0,
        1,
      ).path,
    ).toEqual([]);
    expect(() =>
      dijkstra(
        [
          [0, -1],
          [-1, 0],
        ],
        0,
        1,
      ),
    ).toThrow();
    expect(() =>
      dijkstra(
        [
          [0, NaN],
          [1, 0],
        ],
        0,
        1,
      ),
    ).toThrow();
    for (const edge of [0.5, 1, 2.7]) {
      const p = { ...defaults("gis"), edge },
        a = graph(p);
      let brute = Infinity;
      function walk(u: number, seen: Set<number>, cost: number) {
        if (u === 6) {
          brute = Math.min(brute, cost);
          return;
        }
        for (let v = 0; v < a.length; v++)
          if (!seen.has(v) && Number.isFinite(a[u][v]))
            walk(v, new Set([...seen, v]), cost + a[u][v]);
      }
      walk(0, new Set([0]), 0);
      expect(dijkstra(a, 0, 6).distance).toBeCloseTo(brute, 10);
    }
  });
  it("rejects hazard routes and compares quadrature refinement", () => {
    const p = defaults("gis");
    expect(routeCost({ ...p, route: 3 })).toBe(Infinity);
    expect(definition.analyze({ ...p, route: 3 }).feasible).toBe(false);
    for (const [i, j] of [
      [0, 1],
      [1, 2],
      [3, 6],
      [0, 7],
    ]) {
      const coarse = edgeCost(p, i, j),
        reference = edgeCost(p, i, j, 4096);
      expect(coarse).toBeGreaterThan(0);
      expect(Math.abs(coarse - reference)).toBeLessThan(0.001);
    }
    expect(() => edgeCost({ ...p, edge: -1 }, 0, 1)).toThrow();
  });
  it("exports a calculation matching the declared route-cost algorithm", () => {
    const p = defaults("gis");
    expect(
      Number(
        execFileSync("python3", ["-c", definition.python(p)], {
          encoding: "utf8",
        }),
      ),
    ).toBeCloseTo(routeCost(p), 9);
  });
});
