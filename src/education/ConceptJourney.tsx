import { useState } from "react";
import { useLearning } from "../app/LearningContext";
import { Formula } from "../components/Formula";
import { Metric } from "../components/Controls";
import { SceneFrame } from "../engine/SceneFrame";
import { fmt, multiply, transform, IDENTITY, type Mat3 } from "../math/linear";
import { energy } from "../math/calculus";
import {
  concepts,
  claimFor,
  assumptionsFor,
  rigorousFor,
  derivationFor,
  examplesFor,
  questionFor,
  intuitionFor,
} from "../content/concepts";
import {
  defaults,
  validState,
  vectorModel,
  matrixModel,
  slopeModel,
  gradientModel,
  makePractice,
  gradePractice,
  type ConceptId,
  type Lens,
  type SemanticState,
} from "./model";
import {
  freshJourney,
  appendEvidence,
  recordGuidance,
  problemWasGuided,
  type JourneySession,
} from "./session";
import { MatrixPlaneScene } from "./MatrixPlaneScene";
import { VectorScene, DerivativeScene } from "./Scenes";
import { DerivationStepper } from "./DerivationStepper";
import { WorkedExample } from "./WorkedExample";
import "../styles/education.css";
const tuple = (v: number[]) => `(${v.map((x) => fmt(x, 3)).join(", ")})`;
const lenses: [Lens, string][] = [
  ["discover", "Discover"],
  ["understand", "Understand"],
  ["justify", "Why is it true?"],
  ["apply", "Use it"],
];
const depths = [
  ["intuition", "New"],
  ["foundations", "Building"],
  ["advanced", "Deep"],
  ["research", "Rigorous"],
] as const;
const depthNotes: Record<ConceptId, { foundations: string; advanced: string }> =
  {
    vectors: {
      foundations:
        "Coordinates are coefficients of unit-axis moves: (x,y)=x e₁+y e₂. Add only quantities in the same frame and units. The dot product adds coordinatewise products; orthogonality here means that dot product is zero.",
      advanced:
        "For nonzero w, the projection p minimizes Euclidean squared distance to the line span(w). Orthogonality gives ‖u−tw‖²=‖u−p‖²+(t−t*)²‖w‖², with t*=(u·w)/(w·w). A zero direction invalidates the division; a numerically tiny one requires care.",
    },
    matrices: {
      foundations:
        "With column vectors, the first row computes the first output coordinate and the first column is Ae₁. AB applies B first. The displayed map keeps z separate, so its signed volume factor is z(ad−bc).",
      advanced:
        "Rank counts independent image directions; a null-space direction is lost. det=0 prevents an inverse, while a nearly singular inverse can amplify input error. The existing sandbox labels its Frobenius condition bound separately from a spectral condition number; a complete interactive SVD remains planned.",
    },
    derivatives: {
      foundations:
        "A derivative is a limit of output-change/input-change. The gap may approach from either sign, but cannot be zero inside the quotient. Function-limit ε and δ bound output and input distances; the derivative-quotient proof separately uses δ=ε because its error is |h|.",
      advanced:
        "Differentiability implies continuity, but the converse fails at |x|'s cusp. The algebraically simplified square secant avoids subtracting nearly equal numbers. A finite difference from noisy data is an estimate, and a few matching samples cannot establish a general limit.",
    },
    gradients: {
      foundations:
        "A partial derivative changes one coordinate while the others stay fixed. The gradient collects these slopes; multiplying by alpha makes a displacement in parameter space. Local change is not the same claim as global minimization.",
      advanced:
        "The bowl Hessian diag(1,2) is positive definite. Its fixed-step coordinate factors contract for 0<alpha<1. The two-valley Hessian at the origin is diag(−1,1), with opposite curvature signs. For a differentiable function and unit u, Dᵤf=∇f·u; normalization and differentiability matter.",
    },
  };
function NumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const valid =
    draft.trim() !== "" &&
    Number.isFinite(Number(draft)) &&
    Number(draft) >= min &&
    Number(draft) <= max;
  return (
    <label className="journey-number">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={draft}
        aria-invalid={!valid}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const n = Number(raw);
          if (raw.trim() !== "" && Number.isFinite(n) && n >= min && n <= max)
            onChange(n);
        }}
        onBlur={() => {
          if (!valid) setDraft(String(value));
        }}
      />
      <small>
        {valid
          ? `${min} to ${max}`
          : "Not applied: enter a finite value inside the range."}
      </small>
    </label>
  );
}
export default function ConceptJourney({ id }: { id: ConceptId }) {
  const { learning, update } = useLearning(),
    c = concepts[id],
    s = learning.journeys[id] || freshJourney(id),
    state = s.state;
  const [feedback, setFeedback] = useState(""),
    [worked, setWorked] = useState<number | null>(null),
    [controlsRevision, setControlsRevision] = useState(0),
    [past, setPast] = useState<SemanticState[]>([]),
    [future, setFuture] = useState<SemanticState[]>([]),
    [compare, setCompare] = useState<SemanticState | null>(null),
    [observation, setObservation] = useState(""),
    [reflection, setReflection] = useState(""),
    [guideStep, setGuideStep] = useState(0),
    [matrixVolumeOpen, setMatrixVolumeOpen] = useState(false);
  const steps = derivationFor(id, state),
    proofIndex = Math.min(s.step, steps.length - 1),
    highlight = s.lens === "justify" ? steps[proofIndex].linkedVisualState : "";
  const practice = makePractice(id, s.seed),
    examples = examplesFor(id, state),
    lastPractice = s.attempts
      .filter((a) => a.activity === "practice" && a.seed === s.seed)
      .at(-1);
  function save(next: JourneySession) {
    update({ ...learning, journeys: { ...learning.journeys, [id]: next } });
  }
  function patch(change: Partial<JourneySession>) {
    save({ ...s, ...change, updatedAt: new Date().toISOString() });
  }
  function change(next: SemanticState, resetInputs = true) {
    if (!validState(id, next)) {
      setFeedback(
        "Change rejected: the values leave the stated finite domain. No value was clamped.",
      );
      return;
    }
    setPast([...past.slice(-19), structuredClone(state)]);
    setFuture([]);
    setWorked(null);
    if (resetInputs) setControlsRevision((r) => r + 1);
    patch({ state: next });
    setFeedback("");
  }
  function value(i: number, n: number) {
    const values = [...state.values];
    values[i] = n;
    change({ ...state, values }, false);
  }
  function mode(next: string) {
    let values = [...state.values];
    if (id === "derivatives" && next !== "square") values[0] = 0;
    if (id === "gradients" && next === "valleys")
      values = [0, 0, state.values[2]];
    change({ values, mode: next });
    patch({ ...s, state: { values, mode: next }, step: 0 });
  }
  function loadExample(index: number) {
    const e = examples[index];
    change(structuredClone(e.state));
    setWorked(index);
    patch({ state: structuredClone(e.state), lens: "understand", step: 0 });
  }
  function counterexample() {
    if (id === "vectors")
      change({ values: [0, 0, 3, 4, 0, 0, 4, 4], mode: "projection" });
    else if (id === "matrices")
      change({ values: [1, 1, 0, 1, 1, 0, 1, 0], mode: "matrix" });
    else if (id === "derivatives")
      change({
        values: [0, 0.25, state.values[2]],
        mode: state.mode === "jump" ? "cusp" : "jump",
      });
    else
      change(
        state.mode === "valleys"
          ? { values: [0, 0, state.values[2]], mode: "valleys" }
          : { values: [0, 1, 1.2], mode: "bowl" },
      );
  }
  function history(direction: "undo" | "redo") {
    const from = direction === "undo" ? past : future;
    if (!from.length) return;
    const next = from[from.length - 1];
    if (direction === "undo") {
      setPast(from.slice(0, -1));
      setFuture([...future, state]);
    } else {
      setFuture(from.slice(0, -1));
      setPast([...past, state]);
    }
    setWorked(null);
    setControlsRevision((r) => r + 1);
    patch({ state: next });
  }
  function check() {
    try {
      const guided = problemWasGuided(s);
      const correct = gradePractice(practice, s.answers, s.rule);
      save(
        appendEvidence(s, {
          activity: "practice",
          correct,
          guided,
          response: s.answers,
          rule: s.rule,
          reasoning: "unreviewed",
        }),
      );
      setFeedback(
        correct
          ? `Objective check passed for seed ${s.seed}. ${guided ? "This attempt is guided (including any earlier hint on the same problem)." : "No hint was used before this attempt."} Your explanation still needs the rubric or human feedback.`
          : "Not yet. Check the coordinate order, stated assumptions, and units. A blank, nonfinite, or out-of-tolerance answer cannot pass.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Could not record this attempt.",
      );
    }
  }
  function resultRows(input = state): [string, string][] {
    if (id === "vectors") {
      const m = vectorModel(input.values);
      return input.mode === "projection"
        ? [
            [
              "Projection p",
              m.projected
                ? tuple(m.projected.slice(0, 2)) + " m"
                : "undefined at zero/tiny direction",
            ],
            [
              "Residual·direction",
              m.orthogonality === null
                ? "undefined"
                : fmt(m.orthogonality, 6) + " m²",
            ],
          ]
        : [
            ["Landing", tuple(m.landing.slice(0, 2)) + " m"],
            ["Target error", fmt(m.error, 3) + " m"],
          ];
    }
    if (id === "matrices") {
      const m = matrixModel(input.values);
      return [
        ["Signed volume scale", fmt(m.det)],
        ["Image of probe", tuple(m.image)],
        ["Signed xy area scale", fmt(m.area)],
      ];
    }
    if (id === "derivatives") {
      const m = slopeModel(input);
      return [
        ["Function value", fmt(m.y)],
        [
          "Nonzero-gap secant",
          m.secant === null ? "undefined at h=0" : fmt(m.secant, 6),
        ],
        [
          "Derivative at probe",
          m.slope === null ? "does not exist here" : fmt(m.slope, 6),
        ],
      ];
    }
    const m = gradientModel(input);
    return [
      ["Energy", fmt(m.value, 6)],
      ["Gradient", tuple(m.gradient)],
      [
        "Next energy",
        m.step.status === "boundary"
          ? "step rejected at domain boundary"
          : fmt(m.step.after, 6),
      ],
    ];
  }
  const rows = resultRows();
  const labels =
    id === "vectors"
      ? [
          "Start x (m)",
          "Start y (m)",
          "Control x (m)",
          "Control y (m)",
          "Wind x (m)",
          "Wind y (m)",
          "Target x (m)",
          "Target y (m)",
        ]
      : id === "matrices"
        ? [
            "Matrix a (row 1 column 1)",
            "Matrix b (row 1 column 2)",
            "Matrix c (row 2 column 1)",
            "Matrix d (row 2 column 2)",
            "Separate z scale",
            "Probe x",
            "Probe y",
            "Probe z",
          ]
        : id === "derivatives"
          ? [
              "Probe x (unitless)",
              "Signed gap h (unitless)",
              "Output tolerance epsilon",
            ]
          : ["Particle x", "Particle y", "Step size alpha"];
  const basic =
    id === "vectors"
      ? [2, 3, 4, 5]
      : id === "matrices"
        ? [0, 1, 2, 3]
        : id === "derivatives"
          ? [0, 1]
          : [0, 1, 2];
  function field(i: number) {
    const min =
        id === "vectors"
          ? -10
          : id === "matrices"
            ? -3
            : id === "derivatives"
              ? i === 2
                ? 0.01
                : i === 1
                  ? -1
                  : -2
              : i === 2
                ? 0.05
                : -2.5,
      max =
        id === "vectors"
          ? 10
          : id === "matrices"
            ? 3
            : id === "derivatives"
              ? i === 2
                ? 1
                : i === 1
                  ? 1
                  : 2
              : i === 2
                ? 1.2
                : 2.5;
    return id === "derivatives" && i === 0 && state.mode !== "square" ? (
      <p key={i} className="caption">
        Counterexample fixed at x=0; change h to approach from either side.
      </p>
    ) : (
      <NumberField
        key={`${controlsRevision}-${i}`}
        label={labels[i]}
        value={state.values[i]}
        min={min}
        max={max}
        step={
          id === "derivatives" || (i === 2 && id === "gradients") ? 0.05 : 0.1
        }
        onChange={(n) => value(i, n)}
      />
    );
  }
  function equation() {
    if (id === "vectors") {
      const m = vectorModel(state.values);
      return state.mode === "projection"
        ? String.raw`p=\frac{u\cdot w}{w\cdot w}w,\quad w\ne0`
        : String.raw`P+u+w=${tuple(m.landing.slice(0, 2))}\;\mathrm m`;
    }
    if (id === "matrices") {
      const m = matrixModel(state.values);
      return String.raw`Av=${tuple(m.image)},\quad \det A=${fmt(m.det)}`;
    }
    if (id === "derivatives")
      return state.mode === "square"
        ? String.raw`\frac{(x+h)^2-x^2}{h}=2x+h\ (h\ne0),\quad f'(x)=2x`
        : state.mode === "cusp"
          ? String.raw`f(x)=|x|,\quad f'_-(0)=-1\ne1=f'_+(0)`
          : String.raw`\lim_{x\to0^-}f(x)=-1\ne1=\lim_{x\to0^+}f(x)`;
    return state.mode === "bowl"
      ? String.raw`E=\frac{x^2+2y^2}{2},\quad\nabla E=(x,2y)`
      : String.raw`F=\frac{(x^2-1)^2}{4}+\frac{y^2}{2},\quad\nabla F=(x(x^2-1),y)`;
  }
  const guide = [
    "Read the axes first: a coordinate is a signed number along a named direction. The numeric fields change the same model as the drawing. Keyboard: Tab moves between controls; Safari on macOS may require Option+Tab.",
    id === "vectors"
      ? "Drag a labeled arrow tip to change a displacement, or enter its coordinates below. This 2D view has no camera to orbit."
      : id === "derivatives"
        ? "Drag the approach point to change h, or use its signed-gap input. A moving secant is an average rate; shrinking h suggests a limit."
        : id === "matrices"
          ? "Drag a column tip in the plane or edit its coordinates. Open the optional 3D volume view to orbit the cube; orbiting changes the camera, not the matrix."
          : "Drag empty 3D space to orbit the camera; this changes your view, not the math. Labeled point inputs change the mathematical model.",
    "Write a prediction, change one value, and compare the equation and table. Understand supplies worked examples; Why is it true? supplies the assumptions and justified steps. You can skip ahead.",
  ];
  return (
    <div className="concept-journey" data-concept={id}>
      <header className="journey-heading">
        <div>
          <span className="eyebrow">
            {c.subject === "calculus" ? "TOUCH CHANGE" : "TRANSFORM SPACE"} /
            GUIDED JOURNEY
          </span>
          <h1>{c.title}</h1>
          <p>{questionFor(id, state)}</p>
        </div>
        <a
          className="secondary"
          href={`#/explore/${c.subject === "calculus" ? "calculus" : "linear"}`}
        >
          Explore freely
        </a>
      </header>
      <div className="journey-preferences">
        <label>
          Choose a concept{" "}
          <select
            aria-label="Choose a concept"
            value={id}
            onChange={(e) => {
              const next = e.target.value as ConceptId;
              location.hash = `#/explore/${concepts[next].subject === "calculus" ? "calculus" : "linear"}/${next}`;
            }}
          >
            {Object.values(concepts).map((m) => (
              <option value={m.id} key={m.id}>
                {m.title} · Available
              </option>
            ))}
          </select>
        </label>
        <label>
          Explanation depth{" "}
          <select
            aria-label="Explanation depth"
            value={learning.depth}
            onChange={(e) =>
              update({
                ...learning,
                depth: e.target.value as typeof learning.depth,
              })
            }
          >
            {depths.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!s.guideDismissed && (
        <aside
          className="journey-guide"
          aria-label="Skippable first-world guide"
        >
          <span className="eyebrow">
            A SHORT GUIDE · ABOUT A MINUTE AT YOUR OWN PACE
          </span>
          <p>{guide[guideStep]}</p>
          <div className="journey-actions">
            <button
              className="secondary"
              onClick={() => {
                if (guideStep === 2) patch({ guideDismissed: true });
                else setGuideStep(guideStep + 1);
              }}
            >
              {guideStep === 2 ? "Finish guide" : "Next guide tip"}
            </button>
            <button
              className="text-button"
              onClick={() => patch({ guideDismissed: true })}
            >
              Skip tutorial
            </button>
          </div>
        </aside>
      )}
      <nav className="journey-lenses" aria-label="Learning lenses">
        {lenses.map(([key, label], i) => (
          <button
            key={key}
            aria-pressed={s.lens === key}
            onClick={() => {
              patch({ lens: key });
              setFeedback("");
            }}
          >
            <span>0{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="journey-layout">
        <section className="journey-card" aria-label="Current learning task">
          {s.lens === "discover" && (
            <>
              <span className="eyebrow">ONE QUESTION · ONE EXPERIMENT</span>
              <h2>Make a prediction.</h2>
              <p>{intuitionFor(id, state)}</p>
              <label htmlFor="journey-prediction">
                Before changing a value, what do you predict?
              </label>
              <textarea
                id="journey-prediction"
                value={s.prediction}
                maxLength={1000}
                onChange={(e) => patch({ prediction: e.target.value })}
              />
              <p className="caption">
                A prediction is a testable expectation. Changing controls or
                opening this page does not earn mastery.
              </p>
              <details>
                <summary>Show assumptions and scope</summary>
                <ul>
                  {assumptionsFor(id, state).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </details>
            </>
          )}
          {s.lens === "understand" && (
            <>
              <span className="eyebrow">DEFINITIONS → WORKED NUMBERS</span>
              <h2>Connect the moves to the symbols.</h2>
              <table>
                <caption>Just-in-time vocabulary</caption>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Meaning</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {c.glossary.map((g) => (
                    <tr key={g.symbol}>
                      <th>{g.symbol}</th>
                      <td>{g.meaning}</td>
                      <td>{g.unit || "unitless core"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Load a verified worked case into the same scene, then follow one
                justified step at a time.
              </p>
              <div className="journey-actions">
                {examples.map((e, i) => (
                  <button
                    className="secondary"
                    key={e.title}
                    onClick={() => loadExample(i)}
                  >
                    Load worked example {i + 1}
                  </button>
                ))}
              </div>
              {worked !== null && examples[worked] && (
                <WorkedExample
                  key={`${id}-${worked}-${state.mode}`}
                  example={examples[worked]}
                />
              )}
              <p className="caption">
                Worked examples teach the method. Independent practice uses a
                fresh seeded case whose solution remains hidden.
              </p>
            </>
          )}
          {s.lens === "justify" && (
            <>
              <span className="eyebrow">CLAIM → CONDITIONS → REASONS</span>
              <h2>{claimFor(id, state)}</h2>
              <ul>
                {assumptionsFor(id, state).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              {id === "vectors" &&
                state.mode === "projection" &&
                !vectorModel(state.values).projected && (
                  <p className="journey-warning">
                    The current direction is zero or below the numerical
                    threshold. The division step's nonzero assumption fails
                    here.
                  </p>
                )}
              {id === "gradients" &&
                state.mode === "bowl" &&
                state.values[2] >= 1 && (
                  <p className="journey-warning">
                    The contraction guarantee requires 0&lt;α&lt;1. It does not
                    apply to the current step size.
                  </p>
                )}
              <DerivationStepper
                key={`${id}-${state.mode}`}
                steps={steps}
                index={proofIndex}
                onStep={(step) => patch({ step })}
                onCheck={(rule, correct) => {
                  try {
                    save(
                      appendEvidence(s, {
                        activity: "proof-check",
                        correct,
                        guided: true,
                        response: [],
                        rule,
                        reasoning: "unreviewed",
                      }),
                    );
                  } catch (error) {
                    setFeedback(
                      error instanceof Error
                        ? error.message
                        : "Could not record this proof check.",
                    );
                  }
                }}
              />
              <h3>Test a stronger guess.</h3>
              <p>{c.proofOrCounterexample}</p>
              <button className="secondary" onClick={counterexample}>
                Load a counterexample
              </button>
              {learning.depth === "research" && (
                <details open>
                  <summary>Rigorous extension and assumptions</summary>
                  <p>{rigorousFor(id, state)}</p>
                </details>
              )}
              {id === "matrices" && (
                <details>
                  <summary>Compare AB and BA</summary>
                  {(() => {
                    const a: Mat3 = [1, 1, 0, 0, 1, 0, 0, 0, 1],
                      b: Mat3 = [2, 0, 0, 0, 1, 0, 0, 0, 1];
                    return (
                      <p>
                        For the displayed shear A and x-stretch B, AB(0,1,0)=
                        {tuple(transform(multiply(a, b), [0, 1, 0]))},
                        BA(0,1,0)={tuple(transform(multiply(b, a), [0, 1, 0]))}.
                        Identity commutes with every matrix: det(I)=
                        {fmt(
                          matrixModel([IDENTITY[0], 0, 0, 1, 1, 0, 1, 0]).det,
                        )}
                        . One noncommuting pair does not make every pair
                        noncommuting.
                      </p>
                    );
                  })()}
                </details>
              )}
              <p className="caption">
                Numerical/content fixtures are machine-checked. This is not a
                mechanically verified formal proof or completed independent
                human teaching review.
              </p>
            </>
          )}
          {s.lens === "apply" && (
            <>
              <span className="eyebrow">SOLVE → EXPLAIN → TRANSFER</span>
              <h2>A fresh case · seed {s.seed}</h2>
              <p>{practice.question}</p>
              <p className="caption">
                The practice case uses the new numbers above; the main scene
                retains your experiment. Each numeric answer has tolerance
                ±0.025. A tool-assisted solution is useful practice, not proof
                of broad mastery.
              </p>
              {practice.labels.map((label, i) => (
                <label key={`${s.seed}-${i}`}>
                  {label}
                  <input
                    type="number"
                    aria-label={label}
                    value={s.answers[i] || ""}
                    onChange={(e) => {
                      const answers = Array.from(
                        { length: practice.labels.length },
                        (_, j) => s.answers[j] || "",
                      );
                      answers[i] = e.target.value.slice(0, 100);
                      patch({ answers });
                    }}
                  />
                </label>
              ))}
              <fieldset>
                <legend>{practice.ruleQuestion}</legend>
                {practice.ruleOptions.map(([key, label]) => (
                  <label key={key} className="journey-radio">
                    <input
                      type="radio"
                      name="practice-rule"
                      checked={s.rule === key}
                      onChange={() => patch({ rule: key })}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <button className="primary" onClick={check}>
                Check this fresh case
              </button>
              <div className="journey-actions">
                <button
                  className="text-button"
                  onClick={() => {
                    save(recordGuidance(s));
                    setFeedback(practice.hint);
                  }}
                >
                  Give a conceptual hint
                </button>
                <button
                  className="text-button"
                  disabled={!lastPractice}
                  onClick={() => {
                    save(recordGuidance(s));
                    setFeedback(practice.solution);
                  }}
                >
                  Reveal this solution after an attempt
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    if (s.seed + 17 >= 1e9) {
                      setFeedback(
                        "The supported seed range is exhausted; keep this record and choose a different concept.",
                      );
                      return;
                    }
                    patch({
                      seed: s.seed + 17,
                      answers: [],
                      rule: "",
                      hintUsed: false,
                      explanation: "",
                    });
                    setFeedback("");
                  }}
                >
                  Try fresh parameters
                </button>
              </div>
              <p>
                {problemWasGuided(s)
                  ? "Current case is guided; earlier help on an identical problem stays recorded even after its seed changes."
                  : "No hint or solution revealed for this case."}
              </p>
              <label htmlFor="journey-explanation">
                Explain why your method applies
              </label>
              <textarea
                id="journey-explanation"
                maxLength={1000}
                value={s.explanation}
                onChange={(e) => patch({ explanation: e.target.value })}
              />
              <details>
                <summary>Reasoning rubric · human or self-check</summary>
                <p>
                  {practice.rubric} Equivalent explanations are welcome. Free
                  text is saved, not automatically graded.
                </p>
                <button
                  className="secondary"
                  disabled={!lastPractice}
                  onClick={() => {
                    const attempts = [...s.attempts];
                    let index = -1;
                    for (let i = attempts.length - 1; i >= 0; i--) {
                      if (
                        attempts[i].activity === "practice" &&
                        attempts[i].seed === s.seed
                      ) {
                        index = i;
                        break;
                      }
                    }
                    if (index >= 0)
                      attempts[index] = {
                        ...attempts[index],
                        reasoning: "self-checked",
                        explanation: s.explanation,
                      };
                    patch({ attempts });
                    setFeedback(
                      "Self-check recorded. This is not an independent human review.",
                    );
                  }}
                >
                  Record a reasoning self-check
                </button>
              </details>
              <h3>Build something with the idea.</h3>
              <p>{c.application}</p>
              <a
                className="secondary"
                href={
                  id === "vectors"
                    ? "#/applications/builder/vector-navigation"
                    : id === "matrices"
                      ? "#/applications/robot"
                      : id === "derivatives"
                        ? "#/applications/builder/quadratic-cost"
                        : "#/explore/prediction/energy"
                }
              >
                {id === "vectors" || id === "derivatives"
                  ? "Create a project from this idea"
                  : "Open the applied mission"}
              </a>
              <p className="caption">
                Return later with a fresh case and no hints. Review dates are
                suggestions, not validated mastery or scheduled notifications.
              </p>
            </>
          )}
          {learning.depth !== "intuition" && (
            <section className="depth-extension">
              <h3>
                {learning.depth === "foundations"
                  ? "Building: connect the representations"
                  : learning.depth === "advanced"
                    ? "Deep: conditions and failure cases"
                    : "Rigorous: quantified reasoning"}
              </h3>
              <p>
                {learning.depth === "research"
                  ? rigorousFor(id, state)
                  : depthNotes[id][learning.depth]}
              </p>
              {id === "derivatives" &&
                state.mode === "square" &&
                learning.depth === "advanced" && (
                  <p className="caption">
                    Stable algebraic secant:{" "}
                    {slopeModel(state).secant === null
                      ? "undefined at h=0"
                      : fmt(slopeModel(state).secant!, 12)}
                    . Direct subtraction diagnostic:{" "}
                    {slopeModel(state).rawQuotient === null
                      ? "undefined at h=0"
                      : fmt(slopeModel(state).rawQuotient!, 12)}
                    . Floating-point cancellation can make these numerical
                    evaluations differ at tiny h.
                  </p>
                )}
            </section>
          )}
          <div className="journey-feedback" role="status">
            {feedback}
          </div>
        </section>
        <section
          className="journey-stage"
          aria-label="Synchronized mathematical experiment"
          data-highlight={highlight}
        >
          {id === "vectors" ? (
            <VectorScene
              state={state}
              onChange={change}
              highlight={highlight}
            />
          ) : id === "derivatives" ? (
            <DerivativeScene
              state={state}
              onChange={change}
              highlight={highlight}
              showBands={s.lens === "justify" && learning.depth === "research"}
            />
          ) : id === "matrices" ? (
            <>
              <MatrixPlaneScene
                state={state}
                onChange={change}
                highlight={highlight}
              />
              <details
                onToggle={(e) => setMatrixVolumeOpen(e.currentTarget.open)}
              >
                <summary>Show the 3D volume view</summary>
                {matrixVolumeOpen && (
                  <SceneFrame
                    title="BASIS → GRID → SIGNED VOLUME"
                    scene={{
                      kind: "linear",
                      matrix: matrixModel(state.values).matrix,
                      highlight,
                      onMatrix: (m) => {
                        if (Math.abs(m[2]) + Math.abs(m[5]) > 1e-10) {
                          setFeedback(
                            "This guided map keeps z separate. Drag the first two basis tips; use Explore freely for a general 3×3 map.",
                          );
                          return;
                        }
                        const v = [...state.values];
                        [v[0], v[1], v[2], v[3], v[4]] = [
                          m[0],
                          m[1],
                          m[3],
                          m[4],
                          m[8],
                        ];
                        change({ ...state, values: v });
                      },
                    }}
                  />
                )}
              </details>
            </>
          ) : (
            <SceneFrame
              title="PARTIAL SLOPES → GRADIENT → UPDATE"
              scene={{
                kind: "calculus",
                surface: state.mode as "bowl" | "valleys",
                point: gradientModel(state).point,
                path: [gradientModel(state).point],
                highlight,
              }}
            />
          )}
          <div className="metrics">
            {rows.map(([label, value]) => (
              <Metric key={label} label={label} value={value} />
            ))}
          </div>
          <Formula tex={equation()} />
          <p className="journey-interpretation">
            {id === "vectors"
              ? state.mode === "projection"
                ? "The residual is what remains after removing movement along the chosen direction."
                : `Your chosen moves land ${fmt(vectorModel(state.values).error)} meters from the target. This is a displacement model, not a physical flight simulation.`
              : id === "matrices"
                ? matrixModel(state.values).det === 0
                  ? "A direction collapses; an inverse cannot recover every input."
                  : `Signed volume scales by ${fmt(matrixModel(state.values).det)}. This number alone does not determine length changes.`
                : id === "derivatives"
                  ? slopeModel(state).secant === null
                    ? "At h=0 the finite quotient is undefined. The derivative is obtained by a limit, not division by zero."
                    : "The finite gap gives an average rate. A derivative requires agreement of limiting rates from both sides."
                  : gradientModel(state).step.after > gradientModel(state).value
                    ? "This step raises energy. The selected step size or objective does not support the simple downhill expectation."
                    : "The gradient describes local change. A zero gradient by itself does not classify the point."}
          </p>
          <details>
            <summary>Coordinates, live values, and representation</summary>
            <table>
              <caption>
                One semantic state drives the drawing, equation, table, and
                checks.
              </caption>
              <tbody>
                {labels.map((label, i) => (
                  <tr key={label}>
                    <th>{label}</th>
                    <td>{fmt(state.values[i], 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>{c.representationNotes}</p>
            {id === "gradients" && (
              <>
                <table>
                  <caption>
                    Analytic slices through the current point; the other
                    coordinate stays fixed.
                  </caption>
                  <thead>
                    <tr>
                      <th>Move</th>
                      <th>Energy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [-0.1, 0],
                      [0.1, 0],
                      [0, -0.1],
                      [0, 0.1],
                    ].map(([dx, dy]) => (
                      <tr key={`${dx},${dy}`}>
                        <th>
                          {tuple([state.values[0] + dx, state.values[1] + dy])}
                        </th>
                        <td>
                          {fmt(
                            energy(state.mode as "bowl" | "valleys", [
                              state.values[0] + dx,
                              state.values[1] + dy,
                            ]),
                            6,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  Hessian:{" "}
                  {gradientModel(state)
                    .hessian.map((row) => `[${row.join(", ")}]`)
                    .join(" ")}
                  . The 3D mesh samples an analytic two-variable function.
                </p>
              </>
            )}
          </details>
          <section className="journey-controls">
            <h2>Change one thing</h2>
            {id === "vectors" && (
              <label>
                Vector question{" "}
                <select
                  aria-label="Vector question"
                  value={state.mode}
                  onChange={(e) => mode(e.target.value)}
                >
                  <option value="addition">Add moves / rescue drone</option>
                  <option value="projection">Project onto a direction</option>
                </select>
              </label>
            )}
            {id === "derivatives" && (
              <label>
                Function case{" "}
                <select
                  aria-label="Function case"
                  value={state.mode}
                  onChange={(e) => mode(e.target.value)}
                >
                  <option value="square">Smooth square x²</option>
                  <option value="jump">Jump: unequal one-sided limits</option>
                  <option value="cusp">
                    Cusp: continuous, no derivative at 0
                  </option>
                </select>
              </label>
            )}
            {id === "gradients" && (
              <label>
                Objective{" "}
                <select
                  aria-label="Objective"
                  value={state.mode}
                  onChange={(e) => mode(e.target.value)}
                >
                  <option value="bowl">Convex quadratic bowl</option>
                  <option value="valleys">Two valleys and a saddle</option>
                </select>
              </label>
            )}
            <div className="journey-fields">{basic.map(field)}</div>
            {id === "gradients" && (
              <button
                className="secondary"
                onClick={() => {
                  const m = gradientModel(state);
                  if (m.step.status === "boundary") {
                    setFeedback(
                      "Step rejected outside [−2.5,2.5]². Reduce alpha; no point was clamped.",
                    );
                    return;
                  }
                  change({
                    mode: state.mode,
                    values: [...m.step.point, state.values[2]],
                  });
                  setFeedback(
                    `Energy ${fmt(m.value, 6)} → ${fmt(m.step.after, 6)}. Compare this observation with the stated assumptions.`,
                  );
                }}
              >
                Take a gradient step
              </button>
            )}
            <details>
              <summary>More parameters and experiment tools</summary>
              <div className="journey-fields">
                {labels.map((_, i) => (basic.includes(i) ? null : field(i)))}
              </div>
              <div className="journey-actions">
                <button
                  className="secondary"
                  disabled={!past.length}
                  onClick={() => history("undo")}
                >
                  Undo
                </button>
                <button
                  className="secondary"
                  disabled={!future.length}
                  onClick={() => history("redo")}
                >
                  Redo
                </button>
                <button
                  className="secondary"
                  onClick={() => change(structuredClone(defaults[id]))}
                >
                  Reset experiment
                </button>
                <button
                  className="secondary"
                  onClick={() => setCompare(structuredClone(state))}
                >
                  Mark before state
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setGuideStep(0);
                    patch({ guideDismissed: false });
                  }}
                >
                  Replay guide
                </button>
              </div>
              {compare && (
                <table>
                  <caption>
                    Before/current comparison of calculated quantities
                  </caption>
                  <thead>
                    <tr>
                      <th>Quantity</th>
                      <th>Before</th>
                      <th>Now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([label, result], i) => (
                      <tr key={label}>
                        <th>{label}</th>
                        <td>{resultRows(compare)[i]?.[1]}</td>
                        <td>{result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </details>
          </section>
        </section>
      </div>
      <div className="journey-next">
        <span>{lenses.findIndex(([key]) => key === s.lens) + 1} / 4</span>
        {s.lens !== "apply" && (
          <button
            className="primary"
            onClick={() =>
              patch({
                lens: lenses[
                  lenses.findIndex(([key]) => key === s.lens) + 1
                ][0],
              })
            }
          >
            Next: {lenses[lenses.findIndex(([key]) => key === s.lens) + 1][1]} →
          </button>
        )}
      </div>
      <details className="journey-notebook">
        <summary>Take a snapshot and reflect</summary>
        <label>
          Observation
          <textarea
            value={observation}
            maxLength={1000}
            onChange={(e) => setObservation(e.target.value)}
          />
        </label>
        <label>
          Reflection / next experiment
          <textarea
            value={reflection}
            maxLength={1000}
            onChange={(e) => setReflection(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          onClick={() => {
            patch({
              snapshots: [
                ...s.snapshots.slice(-9),
                {
                  at: new Date().toISOString(),
                  state: structuredClone(state),
                  prediction: s.prediction,
                  observation,
                  reflection,
                  dataVersion: "r1-v1",
                },
              ],
            });
            setFeedback(
              "Experiment card saved in My Learning and included in backups.",
            );
          }}
        >
          Save experiment snapshot
        </button>
        <p>
          Last 10 snapshots and 60 attempts per concept are retained. Your
          recorded explanation is not an automatic score.
        </p>
      </details>
      <details className="journey-map">
        <summary>Prerequisites, deeper layers, and sources</summary>
        <p>
          {c.prerequisiteIds.length
            ? "Suggested earlier concepts:"
            : "No earlier lesson is required; the guide and glossary supply the entry definitions."}
        </p>
        {c.prerequisiteIds.map((key) => (
          <a
            key={key}
            href={`#/explore/${concepts[key].subject === "calculus" ? "calculus" : "linear"}/${key}`}
          >
            {concepts[key].title} · Available{" "}
          </a>
        ))}
        <p>
          Available now: vectors/projection, matrix action/determinant, square
          derivative/limits, and quadratic gradients. Systems, chain rule,
          integral/FTC journeys, spectral tools, constraints, and vector fields
          remain planned or partial; the existing sandboxes are still available.
        </p>
        <ul>
          {c.sourceRefs.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                Study reference: {new URL(url).hostname}
              </a>
            </li>
          ))}
        </ul>
        <p>
          Original teaching content. Source inspiration is not external approval
          of this lesson. Human novice, educator, screen-reader, physical-touch,
          and low-end-device reviews remain pending.
        </p>
      </details>
    </div>
  );
}
