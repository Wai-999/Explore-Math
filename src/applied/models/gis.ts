import { defaults } from "../schema";
import {
  f,
  pair,
  proof,
  type Analysis,
  type Definition,
  type Pair,
  type Params,
} from "../types";
export const nodes: Pair[] = [
  [0, 0],
  [1, 0],
  [3, 0],
  [4, 0],
  [1, 3],
  [3, 3],
  [4, 4],
  [0, 4],
  [2, 2],
];
export const routes = [
  [0, 1, 2, 3, 6],
  [0, 4, 5, 6],
  [0, 7, 6],
  [0, 8, 6],
];
export const terrain = (x: number, y: number) =>
  0.15 * x * x + 0.1 * y * y + 0.05 * x * y;
export const terrainGradient = (x: number, y: number): Pair => [
  0.3 * x + 0.05 * y,
  0.2 * y + 0.05 * x,
];
function distanceToSegment(a: Pair, b: Pair) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((2 - a[0]) * dx + (2 - a[1]) * dy) / (dx * dx + dy * dy)),
    );
  return Math.hypot(a[0] + t * dx - 2, a[1] + t * dy - 2);
}
/** Midpoint quadrature of 3D arclength + positive climb; graph weights are approximate and nonnegative. */
export function edgeCost(p: Params, i: number, j: number, n = 64) {
  if (
    !Number.isInteger(n) ||
    n < 1 ||
    n > 16384 ||
    !Number.isFinite(p.edge) ||
    p.edge <= 0 ||
    !Number.isFinite(p.climb) ||
    p.climb < 0
  )
    throw Error("Invalid nonnegative edge-cost inputs");
  const a = nodes[i],
    b = nodes[j];
  if (!a || !b || i === j) throw Error("Invalid route edge");
  if (distanceToSegment(a, b) <= 0.5) return Infinity;
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  let value = 0;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n,
      g = terrainGradient(a[0] + t * dx, a[1] + t * dy),
      dz = g[0] * dx + g[1] * dy;
    value += (Math.hypot(dx, dy, dz) + p.climb * Math.max(0, dz)) / n;
  }
  value += distanceToSegment(a, b) < 1.1 ? 5 : 0;
  return value * ((i === 0 && j === 1) || (i === 1 && j === 0) ? p.edge : 1);
}
export function graph(p: Params) {
  const adj = nodes.map((_, i) =>
    nodes.map((_, j) => (i === j ? 0 : Infinity)),
  );
  for (const path of routes)
    for (let k = 1; k < path.length; k++) {
      const i = path[k - 1],
        j = path[k];
      adj[i][j] = edgeCost(p, i, j);
      adj[j][i] = edgeCost(p, j, i);
    }
  return adj;
}
export function dijkstra(adj: number[][], start: number, goal: number) {
  const n = adj.length;
  if (
    !n ||
    n > 100 ||
    Array.from(adj).some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== n ||
        Array.from(row).some(
          (c) => typeof c !== "number" || Number.isNaN(c) || c < 0,
        ),
    ) ||
    !Number.isInteger(start) ||
    !Number.isInteger(goal) ||
    start < 0 ||
    goal < 0 ||
    start >= n ||
    goal >= n
  )
    throw Error(
      "Dijkstra requires a square graph with nonnegative costs and valid endpoints",
    );
  const distance = Array(n).fill(Infinity) as number[],
    prev = Array(n).fill(-1) as number[],
    done = new Set<number>();
  distance[start] = 0;
  while (done.size < n) {
    let u = -1;
    for (let i = 0; i < n; i++)
      if (!done.has(i) && (u < 0 || distance[i] < distance[u])) u = i;
    if (u < 0 || !Number.isFinite(distance[u])) break;
    done.add(u);
    if (u === goal) break;
    for (let v = 0; v < n; v++) {
      const next = distance[u] + adj[u][v];
      if (!done.has(v) && next < distance[v]) {
        distance[v] = next;
        prev[v] = u;
      }
    }
  }
  const path: number[] = [];
  if (Number.isFinite(distance[goal]))
    for (let u = goal; u >= 0; u = prev[u]) {
      path.unshift(u);
      if (u === start) break;
    }
  return { distance: distance[goal], path, visited: [...done] };
}
export function routeCost(p: Params, index = p.route) {
  const path = routes[index];
  if (!path) return Infinity;
  return path.slice(1).reduce((s, j, k) => s + edgeCost(p, path[k], j), 0);
}
function analyze(p: Params): Analysis {
  const g = terrainGradient(p.x, p.y),
    route = routes[p.route],
    v: Pair = [p.dx, p.dy],
    rate = g[0] * v[0] + g[1] * v[1],
    cost = routeCost(p);
  return {
    value: terrain(p.x, p.y),
    gradient: g,
    hessian: [
      [0.3, 0.05],
      [0.05, 0.2],
    ],
    matrix: graph(p).map((row) => row.map((v) => (Number.isFinite(v) ? v : 0))),
    matrixLabel:
      "9×9 traversable directed cost adjacency matrix. Zero off-diagonal means no usable direct edge, including blocked edges; positive entries are computed cost units. Reverse costs can differ because ascent is directional.",
    feasible: Number.isFinite(cost),
    metrics: [
      ["Probe elevation", f(terrain(p.x, p.y)) + " m"],
      ["Terrain gradient", pair(g) + " m/m"],
      ["Probe direction vector", pair(v) + " m/unit t"],
      ["Probe chain-rule rate", f(rate) + " m/unit t"],
      ["Chosen route", route.join(" → ")],
      [
        "Node elevation profile",
        route.map((i) => f(terrain(...nodes[i]))).join(" → ") + " m",
      ],
      [
        "Route cost",
        Number.isFinite(cost)
          ? f(cost) + " cost units"
          : "blocked / infeasible",
      ],
      [
        "Alternatives 0,1,2,3",
        routes
          .map((_, i) =>
            Number.isFinite(routeCost(p, i)) ? f(routeCost(p, i)) : "blocked",
          )
          .join(" · "),
      ],
    ],
    interpretation:
      "The terrain gradient turns the probe direction into a local elevation rate. Route costs use each actual segment direction internally. Route cost integrates approximate 3D length and positive ascent, adds the stated hazard penalty, then applies the editable edge multiplier.",
    warnings: [
      ...(!Number.isFinite(cost)
        ? ["The selected route crosses the hard hypothetical hazard core."]
        : []),
      "Edge costs use 64-panel midpoint quadrature. Dijkstra is exact for those computed nonnegative graph weights, not a continuous terrain path optimum.",
      "Nodes: " + nodes.map((n, i) => `${i}=${pair(n)} m`).join("; "),
      "Synthetic terrain and hazards; not navigation or emergency guidance.",
    ],
  };
}
export const definition: Definition = {
  id: "gis",
  title: "Deliver Through the Terrain",
  question: "Which route balances distance, slope and hypothetical hazards?",
  analogy:
    "The shortest line on a flat map may be a tiring walk uphill. Compare a few marked corridors: each segment has a distance, an elevation change and a declared cost.",
  output: "Terrain elevation (m)",
  assumptions: [
    "Synthetic local xy plane in meters, not geographic coordinates or live GIS data. z=0.15x²+0.1y²+0.05xy meters; coefficients have inverse-meter units.",
    "Hard hazard core: disk center (2,2), radius 0.5 m. Crossing its 1.1 m buffer adds five cost units per edge. Neither disk is a real hazard map.",
    "Nine fixed nodes and four corridors. You can edit the 0–1 edge multiplier and ascent weight; graph topology stays fixed. Edge distance costs 1 unit/m; climb weight has units cost/m.",
  ],
  glossary: [
    [
      "r(t),r′(t)",
      "Segment position in meters and direction m per unit parameter t",
    ],
    ["∇f,df/dt", "Terrain slopes m/m; elevation rate m per unit t"],
    [
      "Aᵢⱼ,Dijkstra",
      "Directed cost adjacency entries; shortest paths with nonnegative weights",
    ],
  ],
  limit:
    "Optimal means minimum among traversable paths in this small fixed graph using approximate edge weights. It is not continuous variational optimization, a geographic forecast or emergency guidance. Changing topology and real data require separate validation.",
  formula: String.raw`\frac{dz}{dt}=\nabla f(r(t))\cdot r'(t),\quad C_e\approx\int_0^1\left(\sqrt{\|r'\|^2+(z')^2}+c\max(0,z')\right)dt+H_e`,
  predict: "What determines elevation change while moving along a route?",
  predictionChoices: [
    ["direction", "The dot product of terrain gradient with route direction"],
    ["height", "Only the starting elevation, regardless of direction"],
  ],
  predictionAnswer: "direction",
  analyze,
  scalar: (_p, x, y) => terrain(x, y),
  feasible: (p) => Math.hypot(p.x - 2, p.y - 2) > 0.5,
  derive: (p) => [
    proof(
      "r(t)=u+t(v−u); r′(t)=v−u",
      "A straight xy segment is parameterized on 0≤t≤1.",
      "definition",
    ),
    proof(
      "∇f=(0.3x+0.05y,0.2y+0.05x)",
      "Take the partial derivatives of the stated polynomial terrain.",
      "algebra",
      "gradient",
    ),
    proof(
      "z′(t)=fₓx′(t)+fᵧy′(t)=∇f·r′",
      "Apply the multivariable chain rule. A unit direction gives slope per meter; r′ here is per unit t.",
      "algebra",
      "gradient",
    ),
    proof(
      "3D segment speed=√(x′²+y′²+z′²)",
      "Differentiate (x(t),y(t),f(x(t),y(t))) and take the Euclidean norm. Integrating speed gives length.",
      "algebra",
    ),
    proof(
      "Every traversable edge has a nonnegative computed cost",
      "Length, positive ascent, nonnegative hazard penalty and positive multiplier preserve nonnegativity. Hard-core crossings are excluded.",
      "definition",
      "constraints",
    ),
    proof(
      `Dijkstra settles nodes: ${dijkstra(graph(p), 0, 6).visited.join(", ")}`,
      "With nonnegative weights, no unsettled detour can improve the least tentative settled distance. Relax outgoing edges, then repeat. This proof concerns the supplied graph weights.",
      "theorem",
    ),
  ],
  examples: [
    {
      title: "Start at the map origin",
      params: { x: 0, y: 0, route: 0 },
      steps: [
        "f(0,0)=0 meters and ∇f(0,0)=(0,0).",
        "A first-order elevation estimate is locally zero in every direction at that point.",
        "Farther along the rising segment, the gradient changes; zero local rate does not make the entire route flat.",
      ],
    },
    {
      title: "Connect a segment vector to an elevation rate",
      params: { x: 2, y: 1, route: 0 },
      steps: [
        "f(2,1)=0.15×4+0.1+0.05×2=0.8 m.",
        "∇f(2,1)=(0.65,0.3). For direction v=(1,2), df/dt=0.65+0.6=1.25 m/unit t.",
        "For the unit direction v/√5, the slope per meter is 1.25/√5. Normalization changes the interpretation.",
      ],
    },
  ],
  edge: {
    title: "A short route can cross a hazard",
    params: { route: 3 },
    explanation:
      "Route 0→8→6 passes through the hard core at node 8. Its apparent short distance cannot make it feasible. Dijkstra excludes those edges.",
  },
  mission: (seed, level) => {
    const p = {
      ...defaults("gis"),
      edge: 0.8 + 0.1 * (seed % 12),
      climb: level === 1 ? 1 : 2,
      route: 3,
    };
    const best = dijkstra(graph(p), 0, 6);
    return {
      params: p,
      question:
        "Choose route index 0, 1 or 2 with minimum computed graph cost. Avoid the hard core, then explain the chain rule and the scope of graph optimality.",
      hint: "Read each alternative's cost, check its edges, and compare the graph distances. The gradient gives a local elevation rate, not the whole route cost.",
      solution: `Dijkstra returns ${best.path.join(" → ")} with cost ${f(best.distance, 6)}. The result is for this graph and its declared quadrature weights, not all possible continuous routes.`,
      choices: [
        [
          "principle",
          "Use nonnegative graph costs; distinguish local slope from cumulative route cost",
        ],
        [
          "straight",
          "The visually shortest xy line is always safe and cheapest",
        ],
      ],
      correctRule: "principle",
      grade: (q) => {
        const cost = routeCost(q),
          ok = Number.isFinite(cost) && cost <= best.distance + 1e-6;
        return {
          correct: ok,
          feedback: ok
            ? "Optimal corridor found for these computed graph weights. Explain the terrain rate and what this result omits."
            : `Not yet: chosen cost ${Number.isFinite(cost) ? f(cost) : "blocked"}. Check feasibility and compare all traversable alternatives.`,
        };
      },
    };
  },
  lines: (p, to) => {
    const lines = [];
    for (let index = 0; index < routes.length; index++) {
      const path = routes[index];
      const points = path.slice(1).flatMap((j, k) => {
        const a = nodes[path[k]],
          b = nodes[j];
        return Array.from({ length: 21 }, (_, i) => {
          const x = a[0] + ((b[0] - a[0]) * i) / 20,
            y = a[1] + ((b[1] - a[1]) * i) / 20;
          return to(x, y, terrain(x, y));
        });
      });
      lines.push({
        points,
        color:
          index === p.route ? (index === 3 ? "#e3a09c" : "#eef3b2") : "#83a8a1",
        label: `${index === p.route ? "path: chosen" : "alternative"} route ${index}`,
      });
    }
    const px = p.x + 0.25 * p.dx,
      py = p.y + 0.25 * p.dy;
    if (px >= 0 && px <= 4 && py >= 0 && py <= 4)
      lines.push({
        points: [
          to(p.x, p.y, terrain(p.x, p.y)),
          to(
            px,
            py,
            terrain(p.x, p.y) +
              0.25 *
                (terrainGradient(p.x, p.y)[0] * p.dx +
                  terrainGradient(p.x, p.y)[1] * p.dy),
          ),
        ],
        color: "#cbb7e5",
        label: "probe tangent direction, scaled by 0.25",
      });
    for (const radius of [0.5, 1.1])
      lines.push({
        points: Array.from({ length: 65 }, (_, i) => {
          const x = 2 + radius * Math.cos((2 * Math.PI * i) / 64),
            y = 2 + radius * Math.sin((2 * Math.PI * i) / 64);
          return to(x, y, terrain(x, y));
        }),
        color: "#e1a5a1",
        label: "constraint: hypothetical hazard disk",
      });
    return lines;
  },
  python: (p) =>
    `# Fixed synthetic corridors and midpoint costs, not real navigation.\nfrom math import hypot\nnodes=${JSON.stringify(nodes)}\nroutes=${JSON.stringify(routes)}\npath=routes[${p.route}]\ntotal=0.0\nfor i,j in zip(path,path[1:]):\n    ax,ay=nodes[i]; bx,by=nodes[j]; dx,dy=bx-ax,by-ay\n    t=max(0,min(1,((2-ax)*dx+(2-ay)*dy)/(dx*dx+dy*dy)))\n    distance=hypot(ax+t*dx-2,ay+t*dy-2)\n    if distance<=0.5:\n        total=float('inf'); break\n    value=0.0\n    for k in range(64):\n        t=(k+0.5)/64; x=ax+t*dx; y=ay+t*dy\n        dz=(0.3*x+0.05*y)*dx+(0.2*y+0.05*x)*dy\n        value+=(hypot(dx,dy,dz)+${p.climb}*max(0,dz))/64\n    value+=5 if distance<1.1 else 0\n    total+=value*(${p.edge} if {i,j}=={0,1} else 1)\nprint(total)\n`,
  related: {
    url: "#/explore/calculus/gradients",
    label: "Revisit gradients and directional change",
  },
};
