import { defaults } from "../schema";
import {
  f,
  pair,
  proof,
  type Analysis,
  type Definition,
  type Geometry,
  type Matrix2,
  type Pair,
  type Params,
} from "../types";
export const rad = (degrees: number) => (degrees * Math.PI) / 180;
export function multiply4(a: number[][], b: number[][]) {
  return a.map((row) =>
    b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)),
  );
}
export function arm(p: Params) {
  const a = rad(p.x),
    b = rad(p.y),
    c = Math.cos,
    s = Math.sin;
  const t1 = [
      [c(a), -s(a), 0, p.l1 * c(a)],
      [s(a), c(a), 0, p.l1 * s(a)],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
    t2 = [
      [c(b), -s(b), 0, p.l2 * c(b)],
      [s(b), c(b), 0, p.l2 * s(b)],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ],
    T = multiply4(t1, t2),
    joint: Pair = [t1[0][3], t1[1][3]],
    tip: Pair = [T[0][3], T[1][3]],
    J: Matrix2 = [
      [-p.l1 * s(a) - p.l2 * s(a + b), -p.l2 * s(a + b)],
      [p.l1 * c(a) + p.l2 * c(a + b), p.l2 * c(a + b)],
    ],
    det = J[0][0] * J[1][1] - J[0][1] * J[1][0],
    velocity: Pair = [
      J[0][0] * p.v1 + J[0][1] * p.v2,
      J[1][0] * p.v1 + J[1][1] * p.v2,
    ];
  return {
    T,
    t1,
    joint,
    tip,
    J,
    det,
    velocity,
    error: Math.hypot(tip[0] - p.tx, tip[1] - p.ty),
  };
}
function segmentDistance(a: Pair, b: Pair, c: Pair) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    den = dx * dx + dy * dy,
    t = den
      ? Math.max(
          0,
          Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / den),
        )
      : 0;
  return Math.hypot(c[0] - a[0] - t * dx, c[1] - a[1] - t * dy);
}
export function pathSafety(p: Params) {
  let clearance = Infinity;
  const samples = 64;
  for (let i = 0; i <= samples; i++) {
    const a = arm({ ...p, x: (p.x * i) / samples, y: (p.y * i) / samples });
    clearance = Math.min(
      clearance,
      segmentDistance([0, 0], a.joint, [0.4, 1.2]) - 0.3,
      segmentDistance(a.joint, a.tip, [0.4, 1.2]) - 0.3,
    );
  }
  const travel =
      p.l1 * Math.abs(rad(p.x)) +
      p.l2 * (Math.abs(rad(p.x)) + Math.abs(rad(p.y))),
    bound = travel / (2 * samples);
  return { clearance, bound, certified: clearance > bound + 1e-9 };
}
const scalar = (p: Params, x: number, y: number) =>
  arm({ ...p, x, y }).error ** 2;
function analyze(p: Params): Analysis {
  const a = arm(p),
    safe = pathSafety(p),
    r: Pair = [a.tip[0] - p.tx, a.tip[1] - p.ty],
    g: Pair = [
      (2 * (r[0] * a.J[0][0] + r[1] * a.J[1][0]) * Math.PI) / 180,
      (2 * (r[0] * a.J[0][1] + r[1] * a.J[1][1]) * Math.PI) / 180,
    ];
  return {
    value: a.error ** 2,
    gradient: g,
    matrix: a.T,
    matrixLabel:
      "T01×T12 is a 4×4 homogeneous transform. Rotation block is unitless; its last column is the tip position in meters. Jacobian below uses radians, unlike the degree controls.",
    feasible: safe.certified,
    metrics: [
      ["Tip position", pair(a.tip) + " m"],
      ["Target error", f(a.error) + " m"],
      ["Squared error objective", f(a.error ** 2) + " m²"],
      ["Jacobian row x", pair(a.J[0]) + " m/rad"],
      ["Jacobian row y", pair(a.J[1]) + " m/rad"],
      ["det J", f(a.det) + " m²/rad²"],
      ["Instantaneous tip velocity", pair(a.velocity) + " m/s"],
      [
        "Path clearance certificate",
        `${f(safe.clearance)} > ${f(safe.bound)} m: ${safe.certified ? "safe" : "not certified"}`,
      ],
    ],
    interpretation:
      "Rotations compose into the tip position. The Jacobian maps joint rates to instantaneous tip velocity; it is not a finite-motion or force model.",
    warnings: [
      ...(!safe.certified
        ? [
            safe.clearance < 0
              ? "The straight joint-space path from home intersects the inflated obstacle at a sampled pose."
              : "Path clearance is too small for the conservative 64-interval certificate; treat it as infeasible.",
          ]
        : []),
      ...(Math.abs(a.det) < 0.01
        ? [
            "Jacobian is singular or near singular. An arbitrary desired tip velocity need not have a unique bounded joint-rate solution.",
          ]
        : []),
      "Arm links stay in the xy plane. This is kinematics only; torque, loads and motor dynamics are omitted. Target glyph marks the center; numeric reach tolerance is 0.03 m.",
    ],
  };
}
export const definition: Definition = {
  id: "robotics",
  title: "Move the Warehouse Arm",
  question:
    "Which two joint angles reach the package along a collision-free modeled path?",
  analogy:
    "Two rulers joined by a hinge can reach a point in more than one way. Turning the first hinge moves both rulers; turning the second moves only the last ruler.",
  output: "Planar workspace (m)",
  assumptions: [
    "Two rigid links in the xy plane; right-handed world frame, z up. Numeric angle controls use degrees; trig internals use radians.",
    "Obstacle is a circle at (0.4,1.2) m with inflated radius 0.3 m (0.25 obstacle plus 0.05 link radius).",
    "Path is straight interpolation from home in joint-angle space. A 64-interval clearance certificate uses a link-motion Lipschitz bound between samples; uncertain paths fail conservatively.",
  ],
  glossary: [
    [
      "θ₁,θ₂,l₁,l₂",
      "Joint angles in radians for formulas; link lengths in meters",
    ],
    ["T01,T12", "4×4 rotations/translations between joint frames"],
    [
      "J,ṗ,θ̇",
      "2×2 tip-position Jacobian (m/rad), tip velocity m/s, joint rates rad/s",
    ],
  ],
  limit:
    "Planar kinematics is not a physically faithful industrial robot, force/torque controller or general obstacle planner. A conservative certificate may reject a safe near-obstacle path. Singular does not mean the forward position is undefined.",
  formula: String.raw`p=\begin{bmatrix}l_1\cos\theta_1+l_2\cos(\theta_1+\theta_2)\\l_1\sin\theta_1+l_2\sin(\theta_1+\theta_2)\end{bmatrix},\quad\dot p=J(\theta)\dot\theta`,
  predict: "Which joint rotation affects both links' world positions?",
  predictionChoices: [
    ["first", "Joint 1; joint 2 changes the downstream link"],
    ["none", "Neither joint affects the tip until force is modeled"],
  ],
  predictionAnswer: "first",
  analyze,
  scalar,
  derive: (p) => [
    proof(
      "T02=T01T12; local points are column vectors",
      "Compose frame transforms in order. The last column gives the world position of the local origin.",
      "definition",
      "columns",
    ),
    proof(
      "pₓ=l₁cosθ₁+l₂cos(θ₁+θ₂); pᵧ=l₁sinθ₁+l₂sin(θ₁+θ₂)",
      "Project each link onto the world axes and add its displacement.",
      "algebra",
    ),
    proof(
      "J=[[-l₁sinθ₁−l₂sinθ12,−l₂sinθ12],[l₁cosθ₁+l₂cosθ12,l₂cosθ12]]",
      "Differentiate each tip coordinate with respect to each angle in radians.",
      "algebra",
      "gradient",
    ),
    proof(
      "ṗ=Jθ̇ and det J=l₁l₂sinθ₂",
      "The chain rule maps rates. At sinθ₂=0, the planar Jacobian loses rank.",
      "algebra",
      "gradient",
    ),
    proof(
      `Current J rows: ${pair(arm(p).J[0])}; ${pair(arm(p).J[1])}`,
      "The finite-difference panel differentiates squared target error per degree; multiply angle derivatives by 180/π to compare a position Jacobian per radian.",
      "calculation",
    ),
    proof(
      "Clearance(sample)>motion_bound/(2×64) certifies the interpolated path",
      "Every intermediate pose is within half a sample interval of a sample. Link-point motion is bounded by l₁|Δθ₁|+l₂(|Δθ₁|+|Δθ₂|). Distance to the obstacle is 1-Lipschitz in that displacement.",
      "theorem",
      "constraints",
    ),
  ],
  examples: [
    {
      title: "Straight arm, singular Jacobian",
      params: { x: 0, y: 0, l1: 1.3, l2: 1.1 },
      steps: [
        "Both links point along +x; the tip is (2.4,0) m.",
        "J=[[0,0],[2.4,1.1]] m/rad, so det J=0.",
        "Forward position is valid, but arbitrary planar velocity cannot be produced uniquely here.",
      ],
    },
    {
      title: "Two opposing joint turns",
      params: { x: 30, y: -30, l1: 1.3, l2: 1.1 },
      steps: [
        "The second link's world angle is 30−30=0 degrees.",
        "Tip=(1.3 cos30°+1.1,1.3 sin30°)≈(2.225833,0.65) m.",
        "J≈[[-0.65,0],[2.225833,1.1]], det J=−0.715 m²/rad².",
      ],
    },
  ],
  edge: {
    title: "A forward pose can be singular",
    params: { x: 0, y: 0 },
    explanation:
      "The straight arm has a well-defined tip position and zero Jacobian determinant. Position existence does not imply an invertible instantaneous velocity map.",
  },
  mission: (seed, level) => {
    const p = defaults("robotics"),
      targetPose = { ...p, x: 35 + (seed % 16), y: -70 + (seed % 21) },
      target = arm(targetPose).tip;
    const q = { ...p, tx: target[0], ty: target[1] };
    return {
      params: q,
      question:
        level === 3
          ? "Find a collision-certified pose with |det J|<0.01, and explain why an arbitrary inverse velocity map fails."
          : `Reach target ${pair(target)} m within 0.03 m, with certified home-to-pose clearance${level === 2 ? " and |det J|≥0.25" : ""}. Joint limits remain ±150 degrees.`,
      hint: "Forward kinematics adds rotated link displacements. A target can have more than one inverse pose; test path safety, not only endpoint error.",
      solution: `One reachable target pose is (${targetPose.x},${targetPose.y}) degrees. For a singularity example choose (0,0); this does not make forward kinematics undefined.`,
      choices: [
        [
          "principle",
          "Compose frame transforms; use the Jacobian for instantaneous rates and check the whole modeled path",
        ],
        ["tip", "Endpoint distance alone guarantees every path is safe"],
      ],
      correctRule: "principle",
      grade: (r) => {
        const a = arm(r),
          safe = pathSafety(r).certified,
          ok =
            safe &&
            (level === 3
              ? Math.abs(a.det) < 0.01
              : a.error <= 0.03 && (level !== 2 || Math.abs(a.det) >= 0.25));
        return {
          correct: ok,
          feedback: ok
            ? "Objective met. Distinguish a safe interpolated kinematic path from physical robot control."
            : `Not yet: error ${f(a.error)} m; determinant ${f(a.det)}; path ${safe ? "certified" : "not certified"}.`,
        };
      },
    };
  },
  geometry: (p) => {
    const a = arm(p),
      lines: Geometry["lines"] = [
        {
          points: [
            [0, 0, 0],
            [...a.joint, 0],
            [...a.tip, 0],
          ],
          color: "#bde29e",
          label: "arm links in meters",
        },
        {
          points: Array.from({ length: 65 }, (_, i) => {
            const q = arm({ ...p, x: (p.x * i) / 64, y: (p.y * i) / 64 });
            return [...q.tip, 0];
          }),
          color: "#e8cf9f",
          label: "path: straight joint-angle interpolation from home",
        },
        {
          points: [
            ...Array.from(
              { length: 41 },
              (_, i) =>
                [
                  0.4 + 0.3 * Math.cos((2 * Math.PI * i) / 40),
                  1.2 + 0.3 * Math.sin((2 * Math.PI * i) / 40),
                  0,
                ] as [number, number, number],
            ),
          ],
          color: "#df9b96",
          label: "inflated circular obstacle",
        },
        {
          points: [
            [...a.tip, 0],
            [a.tip[0] + 0.4 * a.velocity[0], a.tip[1] + 0.4 * a.velocity[1], 0],
          ],
          color: "#f0b28a",
          label:
            "instantaneous velocity arrow, scaled by 0.4 seconds; not integrated motion",
        },
      ];
    for (const [T, pos] of [
      [a.t1, a.joint],
      [a.T, a.tip],
    ] as const)
      for (let j = 0; j < 3; j++)
        lines.push({
          points: [
            [pos[0], pos[1], 0],
            [pos[0] + 0.25 * T[0][j], pos[1] + 0.25 * T[1][j], 0.25 * T[2][j]],
          ],
          color: ["#e0ad9f", "#a4d7bb", "#aaaede"][j],
          label: `joint frame axis ${j + 1}`,
        });
    return {
      points: [],
      size: 0,
      valid: [],
      marker: [...a.tip, 0],
      lines,
      spheres: [
        {
          point: [p.tx, p.ty, 0],
          radius: 0.07,
          color: "#eef6bd",
          label: "target center",
        },
        {
          point: [...a.joint, 0],
          radius: 0.07,
          color: "#c6bcdf",
          label: "elbow joint",
        },
      ],
      labels: ["World x (m)", "World y (m)", "World z (m); arm lies at zero"],
      range: [0, 0],
      draggable: false,
    };
  },
  python: (p) =>
    `# Planar rigid-link kinematics only; degrees converted to radians.\nfrom math import sin, cos, radians\na,b=radians(${p.x}),radians(${p.y})\nx=${p.l1}*cos(a)+${p.l2}*cos(a+b)\ny=${p.l1}*sin(a)+${p.l2}*sin(a+b)\nprint((x-${p.tx})**2+(y-${p.ty})**2)\n`,
  related: {
    url: "#/applications/robot",
    label: "Compare the existing world-frame camera rotation mission",
  },
};
