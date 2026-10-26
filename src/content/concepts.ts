import type { ConceptId, SemanticState } from "../education/model";
export type VerificationKind =
  "definition" | "algebra" | "theorem" | "limit" | "calculation" | "example";
export interface DerivationStep {
  statement: string;
  justification: string;
  rule: VerificationKind;
  linkedVisualState: string;
}
export interface WorkedExample {
  title: string;
  state: SemanticState;
  steps: string[];
}
export interface ConceptModule {
  id: ConceptId;
  subject: "linear-algebra" | "calculus";
  title: string;
  entryQuestion: string;
  learningObjectives: string[];
  prerequisiteIds: ConceptId[];
  glossary: { symbol: string; meaning: string; unit?: string }[];
  visualSceneId: string;
  representationNotes: string;
  intuition: string;
  assumptions: string[];
  claim: string;
  derivationSteps: DerivationStep[];
  proofOrCounterexample: string;
  workedExamples: WorkedExample[];
  independentAssessmentIds: string[];
  applicationIds: string[];
  sourceRefs: string[];
  contentStatus: "machine-checked";
  rigorous: string;
  application: string;
}
const step = (
  statement: string,
  justification: string,
  rule: VerificationKind,
  linkedVisualState: string,
): DerivationStep => ({ statement, justification, rule, linkedVisualState });
export const concepts: Record<ConceptId, ConceptModule> = {
  vectors: {
    id: "vectors",
    subject: "linear-algebra",
    title: "Vector rescue",
    entryQuestion: "How can two moves land a drone at the right place?",
    learningObjectives: [
      "Read a coordinate as a signed move along an axis",
      "Add displacements and solve for a missing move",
      "Project onto a nonzero direction and explain the residual",
    ],
    prerequisiteIds: [],
    glossary: [
      {
        symbol: "(x,y)",
        meaning: "x is horizontal position; y is vertical position",
        unit: "m",
      },
      {
        symbol: "u,w",
        meaning: "Control and wind displacements in one fixed frame",
        unit: "m",
      },
      { symbol: "‖u‖", meaning: "Length: √(uₓ²+uᵧ²)", unit: "m" },
      { symbol: "u·w", meaning: "Dot product uₓwₓ+uᵧwᵧ", unit: "m²" },
    ],
    visualSceneId: "vector-rescue",
    representationNotes:
      "This is a 2D displacement model in one fixed frame. It omits time-varying wind, mass, acceleration, fuel, and real drone control.",
    intuition:
      "A vector is a move with a direction and a size. The pair (2,1) means move two meters right and one meter up. A negative coordinate moves the other way. Put the next arrow's tail at the first arrow's tip: both moves still count. The endpoint is found by adding each coordinate. A zero vector makes no move and has no unique direction.",
    assumptions: [
      "Displacements use the same coordinate frame and meter units.",
      "Coordinates are real numbers; the illustrative wind is one added displacement.",
    ],
    claim:
      "For vectors in the same real coordinate space, addition and scalar multiplication operate component by component.",
    derivationSteps: [
      step(
        "u=(uₓ,uᵧ), w=(wₓ,wᵧ)",
        "A coordinate records the signed movement along its axis.",
        "definition",
        "u",
      ),
      step(
        "u+w=(uₓ+wₓ,uᵧ+wᵧ)",
        "Each axis accumulates its own displacement.",
        "definition",
        "sum",
      ),
      step(
        "u+w=(wₓ+uₓ,wᵧ+uᵧ)=w+u",
        "Commutativity of real addition holds in each coordinate. Associativity follows in the same way.",
        "algebra",
        "sum",
      ),
      step(
        "c(u+w)=(c(uₓ+wₓ),c(uᵧ+wᵧ))",
        "Scalar multiplication scales each coordinate.",
        "definition",
        "u",
      ),
      step(
        "c(u+w)=cu+cw",
        "Distribute multiplication over real addition in each coordinate.",
        "algebra",
        "sum",
      ),
      step(
        "T=P+u+w ⇒ u=T−P−w",
        "Subtract the known start and wind from both sides. Substitution checks the result.",
        "algebra",
        "target",
      ),
    ],
    proofOrCounterexample:
      "A zero vector has length 0, so dividing by its length cannot define a unit direction. Adding displacements in different units or frames without converting them is not this model.",
    workedExamples: [
      {
        title: "Counter a crosswind",
        state: { values: [1, 2, 4, 4, 2, -1, 7, 5], mode: "addition" },
        steps: [
          "Start (1,2), target (7,5), wind (2,−1), all meters.",
          "u=(7−1−2, 5−2−(−1))=(4,4) m.",
          "Check (1,2)+(4,4)+(2,−1)=(7,5) m.",
        ],
      },
      {
        title: "A different start and wind",
        state: { values: [-2, 1, 6, -4, -1, 2, 3, -1], mode: "addition" },
        steps: [
          "Start (−2,1), target (3,−1), wind (−1,2) m.",
          "u=(3−(−2)−(−1), −1−1−2)=(6,−4) m.",
          "Check (−2,1)+(6,−4)+(−1,2)=(3,−1) m.",
        ],
      },
    ],
    independentAssessmentIds: ["vector-rescue", "projection-residual"],
    applicationIds: ["vector-navigation"],
    sourceRefs: [
      "https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/",
    ],
    contentStatus: "machine-checked",
    rigorous:
      "In Rⁿ equality is coordinatewise. Define (a+b)ᵢ=aᵢ+bᵢ and (ca)ᵢ=caᵢ for every i. The real-number commutative, associative and distributive laws therefore establish the corresponding vector identities for every coordinate, hence for the whole vector. This is a derivation from coordinate definitions, not an inference from a picture.",
    application:
      "Robotics: solve a simplified route correction, then create a saved vector-navigation project. A real drone requires dynamics and feedback beyond this displacement model.",
  },
  matrices: {
    id: "matrices",
    subject: "linear-algebra",
    title: "Matrix architect",
    entryQuestion: "How can moving two basis arrows move an entire grid?",
    learningObjectives: [
      "Read matrix columns as images of basis vectors",
      "Connect signed area and volume to determinant",
      "Distinguish volume preservation from length preservation",
    ],
    prerequisiteIds: ["vectors"],
    glossary: [
      { symbol: "e₁,e₂", meaning: "One unit along each coordinate axis" },
      {
        symbol: "A",
        meaning: "A linear rule, stored by its rows; vectors are columns",
      },
      {
        symbol: "det(A)",
        meaning: "Signed area or volume scale, not length scale",
      },
      {
        symbol: "A⁻¹",
        meaning: "An inverse exists only for an invertible map",
      },
    ],
    visualSceneId: "existing-transform-space",
    representationNotes:
      "The plane shows the xy block acting on a unit square and a probe. The z coordinate is omitted from this 2D drawing. The optional cube shows the full block 3×3 map and signed volume factor z(ad−bc); its SVG fallback is a labeled projection. This is not a general eigensolver.",
    intuition:
      "A basis is a small set of standard moves. In the plane, e₁=(1,0) and e₂=(0,1). The first matrix column says where e₁ goes; the second says where e₂ goes. Every point follows by combining those new moves. The determinant tells how signed area changes. A negative sign reverses orientation; zero collapses a dimension.",
    assumptions: [
      "The map is linear, with real coordinates and column vectors.",
      "Signed area is normalized, alternating and bilinear in its edge vectors.",
    ],
    claim:
      "A(xe₁+ye₂)=xAe₁+yAe₂. For columns (a,c),(b,d), the signed area factor is ad−bc.",
    derivationSteps: [
      step(
        "v=xe₁+ye₂",
        "Reconstruct a vector using the standard basis.",
        "definition",
        "columns",
      ),
      step(
        "Av=xAe₁+yAe₂",
        "Apply additivity and homogeneity of the linear map.",
        "algebra",
        "columns",
      ),
      step(
        "Ae₁=(a,c), Ae₂=(b,d)",
        "Multiplication by a basis column selects the matching matrix column.",
        "calculation",
        "columns",
      ),
      step(
        "D(ae₁+ce₂,be₁+de₂)",
        "Signed area D is evaluated on the two image edges.",
        "definition",
        "area",
      ),
      step(
        "D=abD(e₁,e₁)+adD(e₁,e₂)+cbD(e₂,e₁)+cdD(e₂,e₂)",
        "Expand by bilinearity in both arguments.",
        "algebra",
        "area",
      ),
      step(
        "D=ad−bc",
        "Alternation gives D(eᵢ,eᵢ)=0 and D(e₂,e₁)=−1; normalization gives D(e₁,e₂)=1.",
        "algebra",
        "area",
      ),
      step(
        "det(A₃ᴅ)=z(ad−bc)",
        "For the displayed block map, a separate z stretch scales the signed volume by z. The geometric determinant theorem extends this to general 3×3 maps.",
        "theorem",
        "volume",
      ),
    ],
    proofOrCounterexample:
      "The shear [[1,1],[0,1]] has determinant 1 but sends (0,1) to (1,1), changing length from 1 to √2. A singular map can send distinct vectors to the same image, so no inverse can recover both.",
    workedExamples: [
      {
        title: "Stretch and shear",
        state: { values: [2, 1, 0, 1, 1, 1, 2, 3], mode: "matrix" },
        steps: [
          "A has rows (2,1,0), (0,1,0), (0,0,1). v=(1,2,3).",
          "Av=1(2,0,0)+2(1,1,0)+3(0,0,1)=(4,2,3).",
          "det(A)=2×1−1×0=2. Signed volume doubles.",
        ],
      },
      {
        title: "Reflect and stretch",
        state: { values: [-1, 0, 0, 2, 1, 2, -1, 3], mode: "matrix" },
        steps: [
          "A=diag(−1,2,1), v=(2,−1,3).",
          "Av=(−2,−2,3). det(A)=−2.",
          "Volume magnitude doubles; orientation reverses. The inverse recovers the input.",
        ],
      },
    ],
    independentAssessmentIds: ["matrix-action-volume"],
    applicationIds: ["robot"],
    sourceRefs: [
      "https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/",
    ],
    contentStatus: "machine-checked",
    rigorous:
      "If RᵀR=I, then ‖Rv‖²=(Rv)ᵀ(Rv)=vᵀRᵀRv=vᵀv for every real v. Thus orthogonal maps preserve length. det(R)=+1 additionally selects proper orientation; reflections are orthogonal too. For invertible A, A⁻¹A=I implies A⁻¹(Av)=v. Singularity invalidates the inverse assumption. AB need not equal BA, although some pairs (including identity) commute.",
    application:
      "Graphics and robotics: compare world-frame rotation order in the existing camera mission. AB applies B first; not every pair of matrices fails to commute.",
  },
  derivatives: {
    id: "derivatives",
    subject: "calculus",
    title: "Derivative workshop",
    entryQuestion: "What does a slope mean when the gap becomes tiny?",
    learningObjectives: [
      "Read a function as input → output",
      "Distinguish a finite secant from a derivative limit",
      "Diagnose a jump and a nondifferentiable cusp",
    ],
    prerequisiteIds: [],
    glossary: [
      { symbol: "f(x)", meaning: "The output produced by the input x" },
      {
        symbol: "h",
        meaning: "Signed change in input; the quotient requires h≠0",
      },
      {
        symbol: "f′(x)",
        meaning: "Limit of local average rates, when it exists",
      },
      {
        symbol: "ε,δ",
        meaning: "Chosen output tolerance and sufficient input distance",
      },
    ],
    visualSceneId: "curve-limit-extension",
    representationNotes:
      "A one-input function uses a 2D graph. The core x² quantities are unitless. Numerical samples illustrate a limit; the algebra and ε–δ reasoning justify it.",
    intuition:
      "A function turns an input into an output: for x², input 2 gives output 4. A slope compares a change in output with a change in input. A secant joins two graph points, so it measures an average rate over a nonzero gap. A derivative asks what those rates approach as the gap shrinks from either side. It does not divide by zero.",
    assumptions: [
      "For the square-function derivation, x and h are real and h≠0 before cancellation.",
      "A two-sided derivative requires the two one-sided quotient limits to agree.",
    ],
    claim: "For every real x, the derivative of f(x)=x² exists and equals 2x.",
    derivationSteps: [
      step(
        "f′(x)=limₕ→₀ [f(x+h)−f(x)]/h",
        "This is the derivative definition when the finite quotient approaches one value.",
        "definition",
        "secant",
      ),
      step(
        "[(x+h)²−x²]/h",
        "Substitute the specified function.",
        "algebra",
        "secant",
      ),
      step(
        "[x²+2xh+h²−x²]/h",
        "Expand the square; no term is omitted.",
        "algebra",
        "secant",
      ),
      step(
        "h(2x+h)/h=2x+h, h≠0",
        "Cancel h only for nonzero h. The original quotient at h=0 is undefined.",
        "algebra",
        "secant",
      ),
      step(
        "limₕ→₀(2x+h)=2x",
        "For every ε>0 choose δ=ε: 0<|h|<δ implies |(2x+h)−2x|=|h|<ε.",
        "limit",
        "tangent",
      ),
    ],
    proofOrCounterexample:
      "A jump can have different left and right function limits even if f(0) is defined. The cusp |x| is continuous at 0, yet its left and right derivative limits are −1 and +1. Continuity alone does not imply differentiability.",
    workedExamples: [
      {
        title: "Average and instantaneous rate",
        state: { values: [2, 0.5, 0.2], mode: "square" },
        steps: [
          "At x=2, f(x)=4. At x+h=2.5, f=6.25.",
          "Secant=(6.25−4)/0.5=4.5.",
          "Derivative=2×2=4; finite-gap error=0.5.",
        ],
      },
      {
        title: "A negative input",
        state: { values: [-1, 0.25, 0.2], mode: "square" },
        steps: [
          "At x=−1, f=1. At x+h=−0.75, f=0.5625.",
          "Secant=(0.5625−1)/0.25=−1.75.",
          "Derivative=−2. The secant tends to −2 as h tends to zero.",
        ],
      },
    ],
    independentAssessmentIds: ["square-slope", "jump-limit", "cusp-derivative"],
    applicationIds: ["quadratic-cost"],
    sourceRefs: [
      "https://openstax.org/details/books/calculus-volume-1",
      "https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/",
    ],
    contentStatus: "machine-checked",
    rigorous:
      "For the function limit at c, |x²−c²|=|x−c||x+c|. Given ε>0, choose δ=min(1, ε/(2|c|+1)). If 0<|x−c|<δ then |x+c|<2|c|+1, hence |x²−c²|<ε. For the derivative quotient, cancellation is valid on the punctured domain h≠0 and the error from 2x is exactly |h|, so δ=ε proves the limit. The stable implementation evaluates 2x+h; direct subtraction of nearly equal squares can lose floating-point precision.",
    application:
      "Business: a derivative compares marginal change with total cost. If the numerical input represents time in seconds and x² represents meters, its coefficient carries m/s² and the derivative carries m/s. Noisy measured differences are estimates, not exact analytic derivatives.",
  },
  gradients: {
    id: "gradients",
    subject: "calculus",
    title: "Gradient mountain",
    entryQuestion: "Which small move lowers a two-input energy?",
    learningObjectives: [
      "Take partial derivatives one coordinate at a time",
      "Explain a gradient step and its step-size assumption",
      "Distinguish a saddle from a minimum",
    ],
    prerequisiteIds: ["vectors", "derivatives"],
    glossary: [
      {
        symbol: "E(x,y)",
        meaning: "One energy value for two input coordinates",
      },
      { symbol: "∂E/∂x", meaning: "Rate of change in x while y stays fixed" },
      {
        symbol: "∇E",
        meaning:
          "Vector of partial derivatives; when nonzero, steepest local increase in Euclidean coordinates",
      },
      {
        symbol: "α",
        meaning: "Positive step size; its safe range depends on the objective",
      },
    ],
    visualSceneId: "existing-energy-landscape",
    representationNotes:
      "This is a real two-parameter surface z=E(x,y), not a full neural-network loss landscape. The descent arrow lies in the xy parameter plane; mesh cells approximate a smooth analytic formula.",
    intuition:
      "First look along one coordinate while holding the other still: that gives one slope, called a partial derivative. Collect the x and y slopes into a vector, the gradient. Away from a stationary point, a sufficiently small opposite move reduces this differentiable objective's energy. The word small matters. A point with zero slopes may be a minimum, a maximum, or a saddle.",
    assumptions: [
      "E=(x²+2y²)/2 is differentiable on R²; displayed controls use [−2.5,2.5]².",
      "The convergence statement below uses a fixed step 0<α<1 for this particular bowl.",
    ],
    claim:
      "For E=(x²+2y²)/2, ∇E=(x,2y); fixed-step descent converges for 0<α<1.",
    derivationSteps: [
      step(
        "E=x²/2+y²",
        "Rewrite the sum before differentiating.",
        "algebra",
        "surface",
      ),
      step(
        "∂E/∂x=x",
        "Hold y fixed; derivative of x²/2 is x and of the fixed y term is zero.",
        "calculation",
        "x-slice",
      ),
      step(
        "∂E/∂y=2y",
        "Hold x fixed; derivative of y² is 2y.",
        "calculation",
        "y-slice",
      ),
      step(
        "∇E=(x,2y)",
        "The gradient collects the partial derivatives in coordinate order.",
        "definition",
        "gradient",
      ),
      step(
        "(xₙ₊₁,yₙ₊₁)=((1−α)xₙ,(1−2α)yₙ)",
        "Substitute the gradient into pₙ₊₁=pₙ−α∇E(pₙ).",
        "algebra",
        "gradient",
      ),
      step(
        "|1−α|<1 and |1−2α|<1 when 0<α<1",
        "Both coordinate factors are contractions, so xₙ and yₙ tend to zero and energy tends to its minimum.",
        "algebra",
        "surface",
      ),
    ],
    proofOrCounterexample:
      "For F=(x²−1)²/4+y²/2, the origin has zero gradient but is a saddle: F(t,0)<1/4 and F(0,t)>1/4 for small nonzero t. On the bowl, α=1.2 at (0,1) increases energy from 1 to 1.96.",
    workedExamples: [
      {
        title: "One safe step",
        state: { values: [1, 1, 0.25], mode: "bowl" },
        steps: [
          "At (1,1), E=1.5 and ∇E=(1,2).",
          "Subtract 0.25(1,2) to reach (0.75,0.5).",
          "E(next)=0.75²/2+0.5²=0.53125.",
        ],
      },
      {
        title: "A different starting point",
        state: { values: [-2, 0.5, 0.1], mode: "bowl" },
        steps: [
          "At (−2,0.5), E=2.25 and ∇E=(−2,1).",
          "With α=0.1, next=(−1.8,0.4).",
          "E(next)=1.78. This observation agrees with the contraction proof for this bowl.",
        ],
      },
    ],
    independentAssessmentIds: [
      "quadratic-gradient",
      "safe-step",
      "saddle-check",
    ],
    applicationIds: ["business", "prediction"],
    sourceRefs: [
      "https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/",
    ],
    contentStatus: "machine-checked",
    rigorous:
      "The Hessian of the bowl is diag(1,2), positive definite. For any nonzero p and fixed 0<α<1, E(p_next)=((1−α)²x²+2(1−2α)²y²)/2<E(p). Iterating the coordinate factors proves convergence. At the two-valley origin the Hessian is diag(−1,1), so negative and positive curvature directions coexist. For differentiable f and a unit direction u, the first-order expansion f(p+tu)=f(p)+t∇f(p)·u+o(t) gives Dᵤf=∇f·u. Differentiability and unit normalization matter.",
    application:
      "Optimization and ML: train small predictive models with a declared objective, validation, and failure checks in Prediction Studio. This geometric bowl explains one update; it is not evidence that a real model generalizes.",
  },
};
export function proofSteps(
  id: ConceptId,
  state: SemanticState,
): DerivationStep[] {
  if (id === "vectors" && state.mode === "projection")
    return [
      step(
        "p=t w, w≠0",
        "A projection onto the line spanned by w lies on that line.",
        "definition",
        "projection",
      ),
      step(
        "(u−t w)·w=0",
        "The residual must be perpendicular to the direction.",
        "definition",
        "residual",
      ),
      step(
        "u·w−t(w·w)=0",
        "Distribute the dot product.",
        "algebra",
        "residual",
      ),
      step(
        "t=(u·w)/(w·w)",
        "For nonzero w the denominator is positive, so division is allowed.",
        "algebra",
        "projection",
      ),
      step(
        "p=[(u·w)/(w·w)]w",
        "Substitute t. The residual's dot product with w is exactly zero in real arithmetic.",
        "algebra",
        "projection",
      ),
    ];
  if (id === "derivatives" && state.mode !== "square")
    return state.mode === "jump"
      ? [
          step(
            "limₓ→₀⁻ f(x)=−1",
            "All negative inputs have output −1.",
            "definition",
            "left",
          ),
          step(
            "limₓ→₀⁺ f(x)=1",
            "All positive inputs have output +1.",
            "definition",
            "right",
          ),
          step(
            "−1≠1 ⇒ no two-sided limit at 0",
            "A two-sided limit requires agreement of both one-sided limits. f(0) does not change them.",
            "theorem",
            "jump",
          ),
        ]
      : [
          step(
            "[|h|−0]/h, h≠0",
            "Use the derivative definition at 0.",
            "definition",
            "secant",
          ),
          step("h<0 ⇒ |h|/h=−1", "For negative h, |h|=−h.", "algebra", "left"),
          step("h>0 ⇒ |h|/h=1", "For positive h, |h|=h.", "algebra", "right"),
          step(
            "−1≠1 ⇒ f′(0) does not exist",
            "The one-sided derivative limits differ, despite continuity of |x| at 0.",
            "theorem",
            "cusp",
          ),
        ];
  return concepts[id].derivationSteps;
}
export function examplesFor(
  id: ConceptId,
  state: SemanticState,
): WorkedExample[] {
  if (id === "vectors" && state.mode === "projection")
    return [
      {
        title: "Project onto a horizontal line",
        state: { values: [0, 0, 3, 4, 2, 0, 0, 0], mode: "projection" },
        steps: [
          "u=(3,4), w=(2,0). u·w=6; w·w=4.",
          "t=6/4=1.5, so p=(3,0).",
          "Residual u−p=(0,4), with residual·w=0.",
        ],
      },
      {
        title: "An oblique direction",
        state: { values: [0, 0, 4, 2, 1, 1, 0, 0], mode: "projection" },
        steps: [
          "u=(4,2), w=(1,1). t=6/2=3.",
          "p=(3,3), residual=(1,−1).",
          "(1,−1)·(1,1)=0. The residual is perpendicular.",
        ],
      },
    ];
  return concepts[id].workedExamples;
}
export function claimFor(id: ConceptId, s: SemanticState) {
  if (id === "vectors" && s.mode === "projection")
    return "For a nonzero direction w, p=[(u·w)/(w·w)]w is on its line and u−p is perpendicular to w.";
  if (id === "derivatives" && s.mode === "jump")
    return "At x=0, the jump's unequal one-sided limits prevent a two-sided limit.";
  if (id === "derivatives" && s.mode === "cusp")
    return "At x=0, |x| is continuous but its derivative does not exist.";
  if (id === "gradients" && s.mode === "valleys")
    return "At the origin, F=(x²−1)²/4+y²/2 has zero gradient but is a saddle.";
  return concepts[id].claim;
}
export function derivationFor(id: ConceptId, s: SemanticState) {
  if (id === "gradients" && s.mode === "valleys")
    return [
      step(
        "F=(x²−1)²/4+y²/2",
        "This is the two-valley polynomial, a different objective from the convex bowl.",
        "definition",
        "surface",
      ),
      step(
        "∇F=(x(x²−1),y)",
        "Take the partial derivatives, holding the other variable fixed.",
        "calculation",
        "gradient",
      ),
      step(
        "∇F(0,0)=(0,0), F(0,0)=1/4",
        "Substitute the origin. Stationarity alone is not a minimum test.",
        "calculation",
        "origin",
      ),
      step(
        "F(t,0)=1/4−t²/2+t⁴/4<1/4 for 0<|t|<1",
        "Small nonzero moves along x lower the value.",
        "algebra",
        "x-slice",
      ),
      step(
        "F(0,t)=1/4+t²/2>1/4 for t≠0",
        "Small nonzero moves along y raise the value.",
        "algebra",
        "y-slice",
      ),
      step(
        "The origin is neither a local minimum nor a local maximum",
        "Arbitrarily nearby lower and higher values establish a saddle.",
        "definition",
        "origin",
      ),
    ];
  return proofSteps(id, s);
}

export function assumptionsFor(id: ConceptId, state: SemanticState): string[] {
  if (id === "vectors" && state.mode === "projection")
    return [
      "Coordinates use the same Euclidean frame and compatible units.",
      "The direction must be nonzero. A numerically tiny direction can be declined at the documented squared-norm threshold.",
    ];
  if (id === "derivatives" && state.mode === "jump")
    return [
      "This counterexample is at x=0, with f(x)=−1 for x<0 and f(x)=1 for x≥0.",
      "A two-sided function limit exists only if its two one-sided limits agree.",
    ];
  if (id === "derivatives" && state.mode === "cusp")
    return [
      "This counterexample is f(x)=|x| at x=0; h remains nonzero inside each difference quotient.",
      "A two-sided derivative exists only if the one-sided quotient limits agree.",
    ];
  if (id === "gradients" && state.mode === "valleys")
    return [
      "F is a differentiable polynomial. The saddle claim concerns the origin.",
      "Arbitrarily small moves along x and y provide lower and higher values; no bowl step-size guarantee is being applied to F.",
    ];
  return concepts[id].assumptions;
}
export function rigorousFor(id: ConceptId, state: SemanticState): string {
  if (id === "vectors" && state.mode === "projection")
    return "For nonzero w, put t*=(u·w)/(w·w) and r=u−t*w. Then r·w=0. For any real t, u−tw=r+(t*−t)w, so its squared Euclidean norm is ‖r‖²+(t*−t)²‖w‖². The nonnegative second term vanishes uniquely at t=t*. This establishes the closest point on span(w); a zero direction invalidates the division formula.";
  if (id === "derivatives" && state.mode === "jump")
    return "If a two-sided limit L existed at 0, the constant values on each side would force both L=−1 and L=1. Equivalently, choosing ε=1/2 gives disjoint required neighborhoods around these two outputs. No single L can satisfy both, so changing only f(0) cannot repair the limit.";
  if (id === "derivatives" && state.mode === "cusp")
    return "Continuity holds at 0 because ||x|−0|=|x|: choose δ=ε. But the derivative quotient |h|/h is exactly −1 for h<0 and +1 for h>0. Any two-sided derivative would have to equal both constants, which is impossible. This distinguishes a function limit from a quotient limit.";
  if (id === "gradients" && state.mode === "valleys")
    return "At the origin F=1/4 and ∇F=0. Given any neighborhood radius r>0, choose 0<|t|<min(1,r). Then F(t,0)=1/4−t²/2+t⁴/4<1/4, while F(0,t)=1/4+t²/2>1/4. Thus every neighborhood contains lower and higher values. The origin is neither a local minimum nor a local maximum; the Hessian diag(−1,1) agrees with this saddle classification.";
  return concepts[id].rigorous;
}

export function questionFor(id: ConceptId, state: SemanticState): string {
  if (id === "vectors" && state.mode === "projection")
    return "How much of one move lies along another direction?";
  if (id === "derivatives" && state.mode === "jump")
    return "Can approaching from two sides lead to different heights?";
  if (id === "derivatives" && state.mode === "cusp")
    return "Can a continuous curve still have no single tangent slope?";
  if (id === "gradients" && state.mode === "valleys")
    return "Does a zero gradient always mean the lowest point?";
  return concepts[id].entryQuestion;
}
export function intuitionFor(id: ConceptId, state: SemanticState): string {
  if (id === "vectors" && state.mode === "projection")
    return "Imagine moving only along a marked rail. The projection is the part of u that lies along the line in direction w. Write it as p=t w. The leftover move u−p must be perpendicular to the rail: its dot product with w is zero. Solve that condition for t. A zero vector cannot name a direction for this division formula.";
  if (id === "derivatives" && state.mode === "jump")
    return "Here the output is −1 to the left of zero and +1 on the right. Approach zero from each side and compare the heights. Those are function limits, not tangent slopes. A single two-sided limit would have to match both heights. Changing only the value at zero cannot close the jump.";
  if (id === "derivatives" && state.mode === "cusp")
    return "The curve |x| meets at zero without a gap, so it is continuous there. Now compare average slopes from zero: they are −1 on the left and +1 on the right. A derivative would require one common limiting slope. Continuity by itself does not guarantee that slope exists.";
  if (id === "gradients" && state.mode === "valleys")
    return "At the middle pass between two valleys, both coordinate slopes are zero. Moving a little along x lowers the height; moving along y raises it. A flat first-order signal does not tell you which kind of stationary point you found. Compare nearby values before calling it a minimum.";
  return concepts[id].intuition;
}
