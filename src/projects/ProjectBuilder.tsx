import { useId, useRef, useState } from "react";
import { Formula } from "../components/Formula";
import { fmt } from "../math/linear";
import {
  MAX_PROJECT_BYTES,
  MAX_PROJECTS,
  PARAMETER_RULES,
  parseProject,
  serializeProject,
  validParameters,
  validProject,
  type ProjectSpec,
  type TemplateId,
} from "./schema";
import {
  TEMPLATE_INFO,
  costModel,
  newProject,
  projectCode,
  projectReport,
  vectorModel,
} from "./templates";
import "../styles/projects.css";

function download(text: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = (p: ProjectSpec) =>
  new Date(
    Math.max(Date.now(), Date.parse(p.createdAt), Date.parse(p.updatedAt)),
  ).toISOString();
const pair = (v: number[]) => `(${fmt(v[0], 2)}, ${fmt(v[1], 2)})`;
function VectorScene({
  parameters,
  onBegin,
  onChange,
}: {
  parameters: Record<string, number>;
  onBegin: () => void;
  onChange: (x: number, y: number) => void;
}) {
  const model = vectorModel(parameters),
    svg = useRef<SVGSVGElement>(null),
    dragging = useRef(false);
  const id = `project-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const extent =
    Math.max(
      6,
      ...[model.start, model.afterControl, model.landing, model.target].flatMap(
        (p) => p.slice(0, 2).map(Math.abs),
      ),
    ) + 2;
  const width = 0.008 * extent,
    text = 0.075 * extent;
  function move(clientX: number, clientY: number) {
    const root = svg.current,
      matrix = root?.getScreenCTM();
    if (!root || !matrix) return;
    const point = root.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(matrix.inverse());
    onChange(local.x - model.start[0], -local.y - model.start[1]);
  }
  const segments = [
    { from: [0, 0], to: model.start, kind: "start", label: "Start P" },
    {
      from: model.start,
      to: model.afterControl,
      kind: "control",
      label: "Control u",
    },
    {
      from: model.afterControl,
      to: model.landing,
      kind: "wind",
      label: "Wind w",
    },
  ];
  return (
    <figure className="project-figure">
      <svg
        ref={svg}
        className="builder-vector-svg"
        viewBox={`${-extent} ${-extent} ${2 * extent} ${2 * extent}`}
        role="group"
        aria-label={`Navigation map in meters. Start ${pair(model.start)}, control ${pair(model.control)}, wind ${pair(model.wind)}, landing ${pair(model.landing)}, destination ${pair(model.target)}. Error ${fmt(model.error, 3)} meters.`}
      >
        <defs>
          <marker
            id={id}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6" fill="none" stroke="context-stroke" />
          </marker>
        </defs>
        <line
          className="project-axis"
          style={{ strokeWidth: extent * 0.003 }}
          x1={-extent}
          y1="0"
          x2={extent}
          y2="0"
        />
        <line
          className="project-axis"
          style={{ strokeWidth: extent * 0.003 }}
          x1="0"
          y1={-extent}
          x2="0"
          y2={extent}
        />
        <text x={extent * 0.75} y={text * 1.3} fontSize={text}>
          x (m)
        </text>
        <text x={text * 0.7} y={-extent * 0.85} fontSize={text}>
          y (m)
        </text>
        {[-0.5, 0.5].map((f) => (
          <g key={f}>
            <line
              className="project-grid"
              style={{ strokeWidth: extent * 0.002 }}
              x1={extent * f}
              y1={-extent}
              x2={extent * f}
              y2={extent}
            />
            <line
              className="project-grid"
              style={{ strokeWidth: extent * 0.002 }}
              x1={-extent}
              y1={extent * f}
              x2={extent}
              y2={extent * f}
            />
            <text x={extent * f} y={text * 1.3} fontSize={text * 0.8}>
              {fmt(extent * f, 1)}
            </text>
            <text x={text * 0.3} y={-extent * f} fontSize={text * 0.8}>
              {fmt(extent * f, 1)}
            </text>
          </g>
        ))}
        {segments.map((s) => (
          <line
            key={s.kind}
            className={`project-vector ${s.kind}`}
            x1={s.from[0]}
            y1={-s.from[1]}
            x2={s.to[0]}
            y2={-s.to[1]}
            strokeWidth={width * 2}
            markerEnd={`url(#${id})`}
          >
            <title>{s.label}</title>
          </line>
        ))}
        <circle
          className="project-target-zone"
          cx={model.target[0]}
          cy={-model.target[1]}
          r="0.15"
          strokeWidth={width}
        />
        <path
          className="project-target"
          strokeWidth={width * 2}
          d={`M${model.target[0] - 0.15 * extent},${-model.target[1]}h${0.3 * extent} M${model.target[0]},${-model.target[1] - 0.15 * extent}v${0.3 * extent}`}
        />
        <circle
          className="project-landing"
          cx={model.landing[0]}
          cy={-model.landing[1]}
          r={extent * 0.025}
        />
        <text
          x={model.start[0] + text * 0.4}
          y={-model.start[1] - text * 0.5}
          fontSize={text}
        >
          P
        </text>
        <text
          x={model.target[0] + text * 0.5}
          y={-model.target[1] - text * 0.5}
          fontSize={text}
        >
          Target
        </text>
        <text
          x={model.landing[0] + text * 0.5}
          y={-model.landing[1] + text * 1.1}
          fontSize={text}
        >
          Landing
        </text>
        <circle
          className="project-control-handle"
          cx={model.afterControl[0]}
          cy={-model.afterControl[1]}
          r={extent * 0.05}
          role="button"
          tabIndex={0}
          aria-label="Move control endpoint. Arrow keys change displacement by 0.1 meters. Coordinate inputs are also available."
          onPointerDown={(e) => {
            e.preventDefault();
            dragging.current = true;
            onBegin();
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragging.current) move(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            dragging.current = false;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          onKeyDown={(e) => {
            const delta: { [key: string]: [number, number] } = {
              ArrowLeft: [-0.1, 0],
              ArrowRight: [0.1, 0],
              ArrowUp: [0, 0.1],
              ArrowDown: [0, -0.1],
            };
            if (delta[e.key]) {
              e.preventDefault();
              onBegin();
              onChange(
                parameters.controlX + delta[e.key][0],
                parameters.controlY + delta[e.key][1],
              );
            }
          }}
        />
      </svg>
      <figcaption>
        Fixed-frame 2D map, meters on both axes. Solid control arrow, dashed
        wind arrow, cross marks destination. Drag the ring or use coordinates;
        camera motion is not involved. The target-zone radius is exactly 0.15 m.
      </figcaption>
    </figure>
  );
}
function CostScene({ parameters }: { parameters: Record<string, number> }) {
  const model = costModel(parameters),
    values = model.curve.map((p) => p.cost);
  const min = Math.min(...values) - 20,
    max = Math.max(...values) + 20;
  const x = (q: number) => 50 + q * 25,
    y = (v: number) => 305 - ((v - min) / (max - min)) * 265;
  return (
    <figure className="project-figure">
      <svg
        className="builder-cost-svg"
        viewBox="-15 0 640 360"
        role="img"
        aria-label={`Synthetic cost curve C(q). At quantity ${parameters.q}, cost ${fmt(model.value, 2)} dollars. Feasible minimum ${fmt(model.minimum, 2)} dollars at quantity ${fmt(model.optimum, 3)}. Domain zero to twenty continuous units.`}
      >
        {[0, 5, 10, 15, 20].map((q) => (
          <g key={q}>
            <line
              className="project-grid"
              x1={x(q)}
              y1="40"
              x2={x(q)}
              y2="305"
            />
            <text x={x(q)} y="325" textAnchor="middle">
              {q}
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              className="project-grid"
              x1="50"
              y1={y(min + f * (max - min))}
              x2="550"
              y2={y(min + f * (max - min))}
            />
            <text x="43" y={y(min + f * (max - min)) + 4} textAnchor="end">
              {fmt(min + f * (max - min), 0)}
            </text>
          </g>
        ))}
        <polyline
          className="project-cost-curve"
          points={model.curve.map((p) => `${x(p.q)},${y(p.cost)}`).join(" ")}
        />
        <line
          className="project-selected"
          x1={x(parameters.q)}
          y1="40"
          x2={x(parameters.q)}
          y2="305"
        />
        <circle
          className="project-landing"
          cx={x(parameters.q)}
          cy={y(model.value)}
          r="6"
        />
        <text
          x={Math.min(510, x(parameters.q) + 10)}
          y={Math.max(28, y(model.value) - 12)}
        >
          Your q
        </text>
        <text x="300" y="353" textAnchor="middle">
          Production quantity (continuous units per batch)
        </text>
        <text x="50" y="21">
          Cost ($ / batch); vertical scale follows the curve
        </text>
      </svg>
      <figcaption>
        Change q numerically to move along the same exact quadratic used in the
        calculations. The line is sampled at 101 points for drawing; costs,
        derivative, and optimum use analytic formulas.
      </figcaption>
    </figure>
  );
}
export default function ProjectBuilder({
  projects,
  onChange,
  initialTemplate = "vector-navigation",
  initialProjectId,
}: {
  projects: ProjectSpec[];
  onChange: (projects: ProjectSpec[]) => void;
  initialTemplate?: TemplateId;
  initialProjectId?: string;
}) {
  const [draft, setDraft] = useState<ProjectSpec>(() => {
    const saved = projects.find(
      (p) => p.id === initialProjectId && p.template === initialTemplate,
    );
    return saved ? structuredClone(saved) : newProject(initialTemplate);
  });
  const [step, setStep] = useState(0),
    [notice, setNotice] = useState(""),
    [undo, setUndo] = useState<Record<string, number>[]>([]),
    [redo, setRedo] = useState<Record<string, number>[]>([]),
    [compare, setCompare] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    info = TEMPLATE_INFO[draft.template],
    rules = PARAMETER_RULES[draft.template];
  const vector =
    draft.template === "vector-navigation"
      ? vectorModel(draft.parameters)
      : null;
  const cost =
    draft.template === "quadratic-cost" ? costModel(draft.parameters) : null;
  function patch(fields: Partial<ProjectSpec>) {
    setDraft((p) => ({ ...p, ...fields, updatedAt: stamp(p) }));
    setNotice("");
  }
  function remember() {
    setUndo((v) => [...v.slice(-29), { ...draft.parameters }]);
    setRedo([]);
  }
  function changeParameters(
    parameters: Record<string, number>,
    rememberChange = true,
  ) {
    if (!validParameters(draft.template, parameters)) {
      setNotice(
        "That value is outside the labeled mathematical bounds. The model is unchanged.",
      );
      return;
    }
    if (rememberChange) remember();
    setDraft((p) => ({
      ...p,
      parameters,
      updatedAt: stamp(p),
      evidence: { ...p.evidence, goalMet: null, selfChecked: false },
    }));
    setNotice("");
  }
  function choose(template: TemplateId) {
    setDraft(newProject(template));
    setUndo([]);
    setRedo([]);
    setStep(0);
    setCompare(false);
    setNotice("New draft started. Existing saved projects are unchanged.");
  }
  function save() {
    if (!validProject(draft)) {
      setNotice(
        "A nonempty title and valid fields are required before saving.",
      );
      return;
    }
    const exists = projects.some((p) => p.id === draft.id);
    if (!exists && projects.length >= MAX_PROJECTS) {
      setNotice(
        `The local library holds at most ${MAX_PROJECTS} projects. Export or edit an existing project before adding another.`,
      );
      return;
    }
    onChange(
      exists
        ? projects.map((p) => (p.id === draft.id ? structuredClone(draft) : p))
        : [...projects, structuredClone(draft)],
    );
    setNotice(
      "Project saved on this device and included in your learning backup. This is an experiment record, not a mastery claim.",
    );
  }
  function duplicate() {
    const copy = {
      ...structuredClone(draft),
      id: crypto.randomUUID(),
      title: `${draft.title.slice(0, 74)} copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence: {
        attempts: 0,
        hintUsed: true,
        goalMet: null,
        selfChecked: false,
        checkedAt: null,
      },
    } as ProjectSpec;
    setDraft(copy);
    setUndo([]);
    setRedo([]);
    setNotice(
      "A remixed draft was created. It is marked guided; save it to keep it.",
    );
  }
  function markGuided() {
    if (draft.evidence.hintUsed) return;
    setDraft((p) => ({
      ...p,
      updatedAt: stamp(p),
      evidence: { ...p.evidence, hintUsed: true },
    }));
    if (projects.some((p) => p.id === draft.id))
      onChange(
        projects.map((p) =>
          p.id === draft.id
            ? {
                ...p,
                updatedAt: stamp(p),
                evidence: { ...p.evidence, hintUsed: true },
              }
            : p,
        ),
      );
  }
  function check() {
    if (draft.evidence.attempts >= 10000) {
      setNotice(
        "This project's 10,000-check record limit is reached. Export the record and start a fresh project.",
      );
      return;
    }
    if (!validProject(draft)) {
      setNotice("Give this project a title before checking its goal.");
      return;
    }
    const goalMet = vector ? vector.goalMet : cost!.goalMet;
    setDraft((p) => ({
      ...p,
      updatedAt: stamp(p),
      evidence: {
        ...p.evidence,
        attempts: p.evidence.attempts + 1,
        goalMet,
        checkedAt: new Date().toISOString(),
      },
    }));
    setNotice(
      goalMet
        ? "The numeric goal is met in this model. Review your explanation and assumptions; this does not establish general mastery."
        : vector
          ? `Landing error is ${fmt(vector.error, 3)} m. Compare the component equation with the destination.`
          : `Cost is $${fmt(cost!.gap, 3)} above the feasible minimum. Compare the derivative and boundary candidates.`,
    );
  }
  function exportFile(kind: "json" | "report" | "code") {
    try {
      const exported =
        kind === "json"
          ? draft
          : { ...draft, evidence: { ...draft.evidence, hintUsed: true } };
      if (kind !== "json") markGuided();
      download(
        kind === "json"
          ? serializeProject(exported)
          : kind === "report"
            ? projectReport(exported)
            : projectCode(exported),
        `${draft.id}.${kind === "json" ? "json" : kind === "report" ? "md" : "py"}`,
        kind === "json" ? "application/json" : "text/plain",
      );
      setNotice("Download prepared from the current draft.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  const solution = vector
    ? `u = target − start − wind = ${pair(vector.required)} m.`
    : `Check q = ${cost!.candidates.map((p) => fmt(p.quantity, 3)).join(", ")}; the feasible minimum is at q = ${fmt(cost!.optimum, 3)}, C = $${fmt(cost!.minimum, 2)}.`;
  return (
    <div className="project-builder">
      <header className="builder-heading">
        <span className="eyebrow">APPLICATIONS / PROJECT BUILDER</span>
        <h1>Make an idea your own.</h1>
        <p>
          Choose a tested model, make a prediction, change its inputs, and
          explain the result. Your projects stay on this device.
        </p>
      </header>
      <nav className="builder-steps" aria-label="Project creation stages">
        {["Frame your question", "Run an experiment", "Reflect & save"].map(
          (label, i) => (
            <button
              key={label}
              className={step === i ? "active" : ""}
              aria-current={step === i ? "step" : undefined}
              onClick={() => {
                setStep(i);
                setNotice("");
              }}
            >
              {i + 1}. {label}
            </button>
          ),
        )}
      </nav>
      <section className="builder-stage" aria-labelledby="builder-stage-title">
        <div className="builder-stage-heading">
          <span>STEP {step + 1} OF 3</span>
          <h2 id="builder-stage-title">
            {
              ["Frame your question", "Run an experiment", "Reflect & save"][
                step
              ]
            }
          </h2>
          <p>{info.goal}</p>
        </div>
        {step === 0 && (
          <>
            <fieldset className="builder-template-options">
              <legend>Choose a mathematical template</legend>
              {(["vector-navigation", "quadratic-cost"] as TemplateId[]).map(
                (template) => (
                  <label
                    key={template}
                    className={draft.template === template ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="project-template"
                      checked={draft.template === template}
                      onChange={() => choose(template)}
                    />
                    <strong>
                      {template === "vector-navigation"
                        ? "Vector navigation"
                        : "Business cost curve"}
                    </strong>
                    <span>
                      {template === "vector-navigation"
                        ? "Counter a known wind displacement."
                        : "Minimize a convex cost on a bounded interval."}
                    </span>
                  </label>
                ),
              )}
            </fieldset>
            <label className="builder-label" htmlFor="project-title">
              Project name
            </label>
            <input
              id="project-title"
              value={draft.title}
              maxLength={80}
              onChange={(e) => patch({ title: e.target.value })}
            />
            <label className="builder-label" htmlFor="project-scenario">
              Scenario and units
            </label>
            <textarea
              id="project-scenario"
              value={draft.scenario}
              maxLength={240}
              onChange={(e) => patch({ scenario: e.target.value })}
            />
            <p className="builder-caption">
              Units are fixed by this template:{" "}
              {draft.units === "m"
                ? "meters in one coordinate frame"
                : "dollars per batch and continuous production units"}
              . Renaming the story does not change its mathematical assumptions.
            </p>
            <label className="builder-label" htmlFor="project-question">
              Your question
            </label>
            <textarea
              id="project-question"
              value={draft.question}
              maxLength={2000}
              onChange={(e) =>
                patch({
                  question: e.target.value,
                  evidence: { ...draft.evidence, selfChecked: false },
                })
              }
            />
            <label className="builder-label" htmlFor="project-prediction">
              What do you predict before changing an input?
            </label>
            <textarea
              id="project-prediction"
              placeholder="Name one change and the effect you expect…"
              value={draft.prediction}
              maxLength={2000}
              onChange={(e) =>
                patch({
                  prediction: e.target.value,
                  evidence: { ...draft.evidence, selfChecked: false },
                })
              }
            />
            <details>
              <summary>Model assumptions</summary>
              <ul>
                {info.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
          </>
        )}
        {step === 1 && (
          <>
            <p className="builder-question">
              {draft.question || info.question}
            </p>
            {vector ? (
              <VectorScene
                parameters={draft.parameters}
                onBegin={remember}
                onChange={(x, y) =>
                  changeParameters(
                    { ...draft.parameters, controlX: x, controlY: y },
                    false,
                  )
                }
              />
            ) : (
              <CostScene parameters={draft.parameters} />
            )}
            <div className="builder-equation">
              {vector ? (
                <Formula
                  tex={String.raw`P+u+w=(${fmt(vector.landing[0], 2)},${fmt(vector.landing[1], 2)})\;\mathrm{m}`}
                />
              ) : (
                <Formula
                  tex={String.raw`C(q)=${draft.parameters.a}q^2+(${draft.parameters.b})q+${draft.parameters.c},\quad C'(q)=2(${draft.parameters.a})q+(${draft.parameters.b})`}
                />
              )}
            </div>
            <p className="builder-interpretation">
              {vector
                ? `The control first moves the drone to ${pair(vector.afterControl)} m; wind then moves it to ${pair(vector.landing)} m. The destination is ${pair(vector.target)} m.`
                : `At q=${fmt(draft.parameters.q, 2)}, cost is $${fmt(cost!.value, 2)} per batch and the local marginal rate is $${fmt(cost!.derivative, 2)} per additional production unit.`}
            </p>
            <div className="builder-parameters">
              {rules.map((rule) => (
                <label key={rule.key}>
                  {rule.label}
                  <span>
                    {rule.unit} · {rule.min} to {rule.max}
                  </span>
                  <input
                    type="number"
                    aria-label={`${rule.label} (${rule.unit})`}
                    value={draft.parameters[rule.key]}
                    min={rule.min}
                    max={rule.max}
                    step={rule.step}
                    onChange={(e) =>
                      changeParameters({
                        ...draft.parameters,
                        [rule.key]: Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <details>
              <summary>Experiment tools: undo, reset, compare</summary>
              <div className="builder-actions">
                <button
                  className="secondary"
                  disabled={!undo.length}
                  onClick={() => {
                    const previous = undo[undo.length - 1];
                    setRedo((v) => [...v, draft.parameters]);
                    setUndo((v) => v.slice(0, -1));
                    changeParameters(previous, false);
                  }}
                >
                  Undo change
                </button>
                <button
                  className="secondary"
                  disabled={!redo.length}
                  onClick={() => {
                    const next = redo[redo.length - 1];
                    setUndo((v) => [...v, draft.parameters]);
                    setRedo((v) => v.slice(0, -1));
                    changeParameters(next, false);
                  }}
                >
                  Redo change
                </button>
                <button
                  className="text-button"
                  onClick={() => changeParameters({ ...info.defaults })}
                >
                  Reset model inputs
                </button>
                <button
                  className="text-button"
                  disabled={!undo.length}
                  onClick={() => setCompare(!compare)}
                >
                  Compare previous inputs
                </button>
              </div>
              {compare && undo.length > 0 && (
                <div className="builder-table">
                  <table>
                    <caption>
                      Last parameter state compared with this state
                    </caption>
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Before</th>
                        <th>Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((r) => (
                        <tr key={r.key}>
                          <th>{r.label}</th>
                          <td>{fmt(undo[undo.length - 1][r.key], 3)}</td>
                          <td>{fmt(draft.parameters[r.key], 3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
            <details
              onToggle={(e) => {
                if (e.currentTarget.open) markGuided();
              }}
            >
              <summary>Trace the worked calculation (marks guided)</summary>
              {vector ? (
                <ol>
                  <li>
                    Start P = {pair(vector.start)} m describes a location.
                  </li>
                  <li>
                    Apply control u = {pair(vector.control)} m: P+u ={" "}
                    {pair(vector.afterControl)} m.
                  </li>
                  <li>
                    Add wind w = {pair(vector.wind)} m component by component:
                    landing = {pair(vector.landing)} m.
                  </li>
                  <li>
                    Error is the Euclidean distance between landing and
                    destination: {fmt(vector.error, 3)} m.
                  </li>
                  <li>
                    Solving target = P+u+w by subtracting P and w gives
                    u=target−P−w. This uses fixed-frame coordinate addition; it
                    is not a dynamics theorem.
                  </li>
                </ol>
              ) : (
                <>
                  <ol>
                    <li>C′(q)=2aq+b by the power and sum rules.</li>
                    <li>
                      An interior stationary candidate satisfies 2aq+b=0, so
                      q=−b/(2a)={fmt(cost!.stationary, 3)}.{" "}
                      {cost!.stationary < 0 || cost!.stationary > 20
                        ? "This is outside [0,20], so it is excluded."
                        : "This is inside [0,20], so it is compared with the boundaries."}
                    </li>
                    <li>
                      Compare that candidate, if feasible, with q=0 and q=20.
                    </li>
                    <li>
                      C″(q)=2a&gt;0 throughout this interval. Strict convexity
                      makes the lowest feasible candidate the unique minimum.
                    </li>
                  </ol>
                  <div className="builder-table">
                    <table>
                      <caption>
                        Candidate calculations in the current model
                      </caption>
                      <thead>
                        <tr>
                          <th>Feasible q</th>
                          <th>C(q), $/batch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cost!.candidates.map((candidate) => (
                          <tr key={candidate.quantity}>
                            <td>{fmt(candidate.quantity, 3)}</td>
                            <td>{fmt(candidate.cost, 3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </details>
            <div className="builder-goal">
              <strong>
                Current objective:{" "}
                {vector
                  ? `${fmt(vector.error, 3)} m position error`
                  : `$${fmt(cost!.gap, 3)} above the feasible minimum`}
              </strong>
              <p>{info.goal}</p>
              <button className="primary" onClick={check}>
                Check numeric goal
              </button>
              <button
                className="text-button"
                onClick={() => {
                  markGuided();
                  setNotice(
                    "The mathematical solution is now visible. This project is marked guided, including after reset or save.",
                  );
                }}
              >
                Show mathematical solution
              </button>
              {draft.evidence.hintUsed && (
                <p className="builder-solution">Guided solution: {solution}</p>
              )}
            </div>
            <label className="builder-label" htmlFor="project-observation">
              What changed, and what did you observe?
            </label>
            <textarea
              id="project-observation"
              value={draft.observation}
              maxLength={2000}
              onChange={(e) =>
                patch({
                  observation: e.target.value,
                  evidence: { ...draft.evidence, selfChecked: false },
                })
              }
            />
          </>
        )}
        {step === 2 && (
          <>
            <h3>{draft.title || "Untitled draft"}</h3>
            <p>
              {draft.evidence.attempts
                ? `${draft.evidence.attempts} numeric check(s); ${draft.evidence.goalMet === null ? "current parameters have not been rechecked" : draft.evidence.goalMet ? "the current numeric goal was met" : "the last numeric goal was not met"}.`
                : "The numeric goal has not been checked yet."}{" "}
              {draft.evidence.hintUsed
                ? "Solution or remix guidance was used."
                : "No solution was revealed in this draft."}
            </p>
            <label className="builder-label" htmlFor="project-reflection">
              Your decision, explanation, limitations, and next experiment
            </label>
            <textarea
              id="project-reflection"
              placeholder="Connect the calculation to your decision. Which assumption matters, and what would you test next?"
              value={draft.reflection}
              maxLength={2000}
              onChange={(e) =>
                patch({
                  reflection: e.target.value,
                  evidence: { ...draft.evidence, selfChecked: false },
                })
              }
            />
            <details open>
              <summary>Reasoning self-check rubric</summary>
              <ul>
                <li>
                  I defined the variables, coordinate frame or domain, and
                  units.
                </li>
                <li>
                  I explained a calculation step and connected it to the
                  drawing.
                </li>
                <li>
                  I tested a zero/boundary case and stated an important omitted
                  effect.
                </li>
                <li>I stated a conditional decision and a new experiment.</li>
              </ul>
              <label className="builder-check">
                <input
                  type="checkbox"
                  checked={draft.evidence.selfChecked}
                  disabled={draft.reflection.trim().length < 20}
                  onChange={(e) =>
                    patch({
                      evidence: {
                        ...draft.evidence,
                        selfChecked: e.target.checked,
                      },
                    })
                  }
                />
                I reviewed my explanation using this rubric.
              </label>
              <p className="builder-caption">
                A short reflection enables this self-check. It is a learner
                report, not an automatic proof score or independent human
                review.
              </p>
            </details>
            <details>
              <summary>Assumptions and model limitations</summary>
              <ul>
                {info.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
            <div className="builder-actions">
              <button className="primary" onClick={save}>
                Save project
              </button>
              <button className="secondary" onClick={duplicate}>
                Duplicate as a guided remix
              </button>
            </div>
            <details>
              <summary>Portable project files</summary>
              <p>
                Export the current specification, or a report containing worked
                calculations. Narrative text is never executable code.
              </p>
              <div className="builder-actions">
                <button
                  className="secondary"
                  onClick={() => exportFile("json")}
                >
                  Export project JSON
                </button>
                <button
                  className="secondary"
                  onClick={() => exportFile("report")}
                >
                  Download project report (marks guided)
                </button>
              </div>
              <details
                onToggle={(e) => {
                  if (e.currentTarget.open) markGuided();
                }}
              >
                <summary>Show me the code (marks guided)</summary>
                <p>
                  Python is generated only from audited templates and finite
                  numeric inputs. It includes the mathematical solution
                  procedure.
                </p>
                <pre>
                  <code>
                    {validProject(draft)
                      ? projectCode(draft)
                      : "# Give this project a valid name before generating code."}
                  </code>
                </pre>
                <button
                  className="secondary"
                  onClick={() => exportFile("code")}
                >
                  Download Python example
                </button>
                <p className="builder-caption">
                  Run the downloaded .py file with Python 3 locally. It uses
                  only the standard library. The output should match these model
                  values; it does not connect to real drones, markets, or
                  production systems.
                </p>
              </details>
            </details>
          </>
        )}
        <footer className="builder-stage-footer">
          <button
            className="text-button"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            ← Previous
          </button>
          <span>{step + 1} / 3</span>
          {step < 2 && (
            <button className="primary" onClick={() => setStep(step + 1)}>
              {step === 0 ? "Run my experiment" : "Reflect on the result"} →
            </button>
          )}
        </footer>
      </section>
      {notice && (
        <p className="builder-notice" role="status">
          {notice}
        </p>
      )}
      <section className="builder-library">
        <details>
          <summary>
            Saved projects ({projects.length}/{MAX_PROJECTS}) and import
          </summary>
          <p>
            Open a saved record to rename or revise it. A draft is kept only
            after Save project. Import never replaces a saved record
            automatically.
          </p>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            aria-label="Import a project JSON file"
            onChange={async (e) => {
              const selected = e.target.files?.[0];
              e.target.value = "";
              if (!selected) return;
              try {
                if (selected.size > MAX_PROJECT_BYTES)
                  throw Error("Project exceeds the 250 KB import limit.");
                let imported = parseProject(await selected.text());
                if (projects.some((p) => p.id === imported.id)) {
                  const now = new Date().toISOString();
                  imported = {
                    ...imported,
                    id: crypto.randomUUID(),
                    title: `${imported.title.slice(0, 70)} imported`,
                    createdAt: now,
                    updatedAt: now,
                    evidence: {
                      attempts: 0,
                      hintUsed: true,
                      goalMet: null,
                      selfChecked: false,
                      checkedAt: null,
                    },
                  };
                }
                setDraft(imported);
                setUndo([]);
                setRedo([]);
                setStep(0);
                setNotice(
                  "Imported into a draft. Save it to keep it locally. Imported attempt records are user-supplied evidence, not a verified qualification.",
                );
              } catch (error) {
                setNotice((error as Error).message);
              }
            }}
          />
          <ul>
            {projects.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>{p.title}</strong>
                  <span>
                    {p.template === "vector-navigation"
                      ? "Vector navigation"
                      : "Business cost"}{" "}
                    · updated {new Date(p.updatedAt).toLocaleDateString()} ·{" "}
                    {p.evidence.hintUsed
                      ? "guided record"
                      : "no solution revealed in this draft"}
                  </span>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    location.hash = `#/applications/builder/${p.template}/${p.id}`;
                    setDraft(structuredClone(p));
                    setUndo([]);
                    setRedo([]);
                    setStep(0);
                    setNotice(
                      "Opened saved project. Edits remain a draft until saved.",
                    );
                  }}
                >
                  Open {p.title}
                </button>
              </li>
            ))}
          </ul>
          {!projects.length && (
            <p>
              No projects saved yet. Create a draft, test its goal, and save it
              here.
            </p>
          )}
        </details>
      </section>
      <p className="builder-caption">
        No account, private-data upload, arbitrary code execution, or remote
        compute. A solved numeric goal is evidence for this attempt only.
        Explanation, transfer, and delayed retention need further review.
      </p>
    </div>
  );
}
