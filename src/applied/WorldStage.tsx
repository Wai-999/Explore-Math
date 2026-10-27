import { useEffect, useMemo, useState } from "react";
import { useLearning } from "../app/LearningContext";
import { SceneFrame } from "../engine/SceneFrame";
import { Formula } from "../components/Formula";
import { DerivationStepper } from "../education/DerivationStepper";
import { WorkedExample } from "../education/WorkedExample";
import {
  emptyApplied,
  fresh,
  readProject,
  rules,
  validParams,
  type RecordState,
  type WorldProject,
} from "./schema";
import {
  csv,
  evidenceKey,
  finiteDifference,
  gradeMission,
  surfaceGeometry,
  unproject,
} from "./math";
import { f, pair, type Definition, type Rule, type Params } from "./types";
import "./applied.css";
const stages = [
  "Discover",
  "Predict",
  "Experiment",
  "Understand & Prove",
  "Mission",
  "Build",
];
function saveFile(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function NumberInput({
  rule,
  value,
  onChange,
  disabled = false,
}: {
  rule: Rule;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const valid =
    text.trim() !== "" &&
    Number.isFinite(Number(text)) &&
    Number(text) >= rule.min &&
    Number(text) <= rule.max &&
    (rule.key !== "route" || Number.isInteger(Number(text)));
  return (
    <label>
      {rule.label} <small>{rule.unit}</small>
      <input
        type="number"
        aria-label={`${rule.label} (${rule.unit})`}
        value={text}
        min={rule.min}
        max={rule.max}
        step={rule.step}
        disabled={disabled}
        aria-invalid={!valid}
        onChange={(e) => {
          setText(e.target.value);
          const raw = e.target.value,
            n = Number(raw);
          if (
            raw.trim() !== "" &&
            Number.isFinite(n) &&
            n >= rule.min &&
            n <= rule.max &&
            (rule.key !== "route" || Number.isInteger(n))
          )
            onChange(n);
        }}
        onBlur={() => {
          if (!valid) setText(String(value));
        }}
      />
      <small>
        {rule.min} to {rule.max}
        {!valid ? " · not applied: enter a finite in-range value" : ""}
      </small>
    </label>
  );
}
export default function WorldStage({
  definition: d,
  projectId,
  initialLevel,
}: {
  definition: Definition;
  projectId?: string;
  initialLevel?: number;
}) {
  const { learning, update } = useLearning(),
    applied = learning.applied || emptyApplied();
  const [r, setR] = useState<RecordState>(() => {
      const project = applied.projects.find(
        (p) => p.id === projectId && p.world === d.id,
      );
      const record = structuredClone(
        project?.record || applied.sessions[d.id] || fresh(d.id),
      );
      if (initialLevel) {
        record.level = initialLevel;
        record.stage = 0;
      }
      return record;
    }),
    [feedback, setFeedback] = useState(""),
    [rule, setRule] = useState(""),
    [proofIndex, setProofIndex] = useState(0),
    [example, setExample] = useState<number | null>(null),
    [past, setPast] = useState<Params[]>([]),
    [future, setFuture] = useState<Params[]>([]),
    [compare, setCompare] = useState<Params | null>(null),
    [revision, setRevision] = useState(0),
    [title, setTitle] = useState(
      applied.projects.find(
        (item) => item.id === projectId && item.world === d.id,
      )?.title || d.title + " · my scenario",
    ),
    [replay, setReplay] = useState(100),
    [playing, setPlaying] = useState(false);
  const p = r.params,
    m = useMemo(() => d.analyze(p), [d, p]),
    geometry = useMemo(() => surfaceGeometry(d, p), [d, p]),
    mission = useMemo(() => d.mission(r.seed, r.level), [d, r.seed, r.level]),
    key = evidenceKey(d, r.seed, r.level),
    guided =
      r.guidance.includes(key) ||
      r.guidance.length >= 1000 ||
      (d.id === "ml" && r.guidance.includes("ml:holdout"));
  const frozen = d.id === "ml" && !!r.frozen;
  const numeric = useMemo(
    () => finiteDifference((x, y) => d.scalar(p, x, y), p.x, p.y),
    [d, p],
  );
  useEffect(() => {
    if (applied.sessions[d.id] !== r)
      update({
        ...learning,
        applied: { ...applied, sessions: { ...applied.sessions, [d.id]: r } },
      });
  }, [r, d.id, applied, learning, update]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setReplay((v) => Math.min(100, v + 5)),
      150,
    );
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (replay === 100 && playing) queueMicrotask(() => setPlaying(false));
  }, [replay, playing]);
  function patch(v: Partial<RecordState>) {
    setR((old) => ({ ...old, ...v }));
  }
  function change(next: Params, syncInputs = true) {
    if (frozen) {
      setFeedback(
        "This model is frozen after held-out evaluation. Start guided development to change it.",
      );
      return;
    }
    if (!validParams(d.id, next)) {
      setFeedback(
        "Change rejected: a finite value must stay inside the stated bounds; the mathematics was not clamped.",
      );
      return;
    }
    setPast((v) => [...v.slice(-19), p]);
    setFuture([]);
    patch({ params: next });
    if (syncInputs) setRevision((v) => v + 1);
    setExample(null);
    setFeedback("");
  }
  function stage(index: number) {
    if (index === 4 && r.stage !== 4) {
      const params = { ...mission.params };
      patch({
        stage: index,
        params,
        visited: [...new Set([...r.visited, index])],
      });
      setRevision((v) => v + 1);
      setExample(null);
      setRule("");
    } else
      patch({ stage: index, visited: [...new Set([...r.visited, index])] });
    setFeedback("");
  }
  function guidance() {
    if (!r.guidance.includes(key) && r.guidance.length < 1000)
      patch({ guidance: [...r.guidance, key] });
  }
  function check() {
    if (d.id === "ml" && r.level === 3 && !r.frozen) {
      setFeedback(
        "Freeze the coefficients and evaluate the held-out set before checking this level.",
      );
      return;
    }
    const result = gradeMission(d, p, r.seed, r.level, rule);
    patch({
      attempts: [
        ...r.attempts.slice(-99),
        {
          at: new Date().toISOString(),
          seed: r.seed,
          level: r.level,
          correct: result.correct,
          guided,
          params: structuredClone(p),
          rule,
          reasoning: "unreviewed",
        },
      ],
    });
    setFeedback(
      result.feedback +
        (guided
          ? " Guided attempt."
          : " No hint revealed before this attempt.") +
        " Written explanations need self/human review.",
    );
  }
  function project(): WorldProject {
    return {
      kind: "applied-world-project",
      assumptions: [...d.assumptions, d.limit],
      version: 1,
      world: d.id,
      id: crypto.randomUUID(),
      title: title.trim() || d.title,
      createdAt: new Date().toISOString(),
      record: structuredClone(r),
    };
  }
  function saveProject() {
    if (applied.projects.length >= 20) {
      setFeedback(
        "Twenty-project limit reached. Export a backup; remove an unwanted saved copy before saving another.",
      );
      return;
    }
    const next = project();
    update({
      ...learning,
      applied: { ...applied, projects: [...applied.projects, next] },
    });
    setFeedback(
      "Project saved locally, including assumptions version, model inputs and evidence. Export a portable copy too.",
    );
  }
  const rendered = {
    ...geometry,
    lines: geometry.lines.map((line) => ({
      ...line,
      points: line.label.includes("path")
        ? line.points.slice(
            0,
            Math.max(2, Math.ceil((line.points.length * replay) / 100)),
          )
        : line.points,
    })),
  };
  const attempt = r.attempts
    .filter((a) => a.seed === r.seed && a.level === r.level)
    .at(-1);
  const derivation = d.derive(p),
    activeProof = Math.min(proofIndex, derivation.length - 1);
  function report() {
    return `# ${title}\n\nSynthetic teaching model · ${d.id} · version 1\n\n## Question\n${d.question}\n\n## Prediction\n${r.prediction}\n\n## Inputs\n${rules[d.id].map((q) => `${q.label}: ${p[q.key]} ${q.unit}`).join("\n")}\n\n## Calculations\n${m.metrics.map(([a, b]) => `${a}: ${b}`).join("\n")}\nGradient: ${m.gradient ? pair(m.gradient) : "undefined at boundary"}\n\n## Decision and next experiment\n${r.reflection}\n\n## Assumptions and limits\n${d.assumptions.join("\n")}\n${d.limit}\n\nObjective attempts: ${r.attempts.length}; current case ${guided ? "guided" : "no hint recorded"}. Explanations are not automatically graded.\n`;
  }
  return (
    <div className="applied-world" data-world={d.id}>
      <header className="page-heading">
        <a href="#/applications/worlds" className="text-button">
          ← Applied 3D Worlds
        </a>
        <span className="eyebrow">
          {d.id.toUpperCase()} · SYNTHETIC / ILLUSTRATIVE · HUMAN REVIEW PENDING
        </span>
        <h1>{d.title}</h1>
        <p>{d.question}</p>
      </header>
      <div className="applied-settings">
        <label>
          Explanation level
          <select
            aria-label="World explanation level"
            value={r.depth}
            onChange={(e) => patch({ depth: Number(e.target.value) })}
          >
            <option value="0">Foundation</option>
            <option value="1">Deeper</option>
            <option value="2">Advanced</option>
          </select>
        </label>
        <label>
          Mission level
          <select
            aria-label="Mission difficulty"
            value={r.level}
            onChange={(e) => {
              const level = Number(e.target.value);
              patch({
                level,
                params: r.stage === 4 ? d.mission(r.seed, level).params : p,
              });
              setRevision((v) => v + 1);
              setRule("");
            }}
          >
            <option value="1">Foundation</option>
            <option value="2">Deeper</option>
            <option value="3">Advanced</option>
          </select>
        </label>
      </div>
      <nav className="applied-stages" aria-label="Applied learning stages">
        {stages.map((s, i) => (
          <button
            key={s}
            className={r.stage === i ? "active" : ""}
            aria-current={r.stage === i ? "step" : undefined}
            onClick={() => stage(i)}
          >
            {i + 1}. {s}
          </button>
        ))}
      </nav>
      <p className="caption">
        Follow the suggested order or skip to any stage. Visited stages are not
        mastery scores.
      </p>
      <div className="applied-layout">
        <section className="applied-task" aria-label="Current world task">
          {r.stage === 0 && (
            <>
              <span className="eyebrow">ONE QUESTION</span>
              <h2>Make the decision tangible.</h2>
              <p>{d.analogy}</p>
              <p>
                First make a prediction. Then change one input, compare the
                numbers, and justify a choice. The geometry is a mathematical
                model, not real business evidence.
              </p>
            </>
          )}
          {r.stage === 1 && (
            <>
              <h2>Predict before experimenting.</h2>
              <p>{d.predict}</p>
              <fieldset>
                <legend>Your expectation</legend>
                {d.predictionChoices.map(([v, label]) => (
                  <label className="applied-choice" key={v}>
                    <input
                      type="radio"
                      name="world-prediction"
                      value={v}
                      checked={r.prediction === v}
                      onChange={() => patch({ prediction: v })}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <p className="caption">
                Your choice is saved. Experiment first; the derivation explains
                the principle.
              </p>
            </>
          )}
          {r.stage === 2 && (
            <>
              <h2>Change one thing.</h2>
              <p>
                Move the marker or edit its two coordinates. Read the equation,
                table and interpretation together. Drag empty 3D space to orbit;
                camera motion does not change your decision.
              </p>
              <p>
                Orange shows the analytic gradient direction where defined; its
                visible length is scaled. Dashed lines mark constraints. Gray
                surface cells are outside the feasible region.
              </p>
              {d.step && (
                <button
                  className="primary"
                  disabled={frozen}
                  onClick={() => {
                    const next = d.step!(p);
                    if (validParams(d.id, next)) change(next);
                    else
                      setFeedback(
                        "The analytic step leaves the displayed domain. It was not applied; reduce the learning rate.",
                      );
                  }}
                >
                  Take one model step
                </button>
              )}
              <p>
                {r.prediction
                  ? `Saved prediction: ${d.predictionChoices.find((c) => c[0] === r.prediction)?.[1] || r.prediction}. Compare it with the observed marginal changes.`
                  : "You can return to Predict at any time."}
              </p>
            </>
          )}
          {r.stage === 3 && (
            <>
              <h2>Why does this work?</h2>
              <p className="evidence-kind">
                Valid derivation under stated assumptions; the scene is visual
                intuition.
              </p>
              <ul>
                {d.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <DerivationStepper
                key={d.id}
                steps={derivation}
                index={activeProof}
                onStep={setProofIndex}
                onCheck={(_rule, correct) =>
                  setFeedback(
                    correct
                      ? "Local justification check passed; this is guided retrieval, not an independent proof grade."
                      : "Review the stated rule and assumption.",
                  )
                }
              />
              <div className="applied-actions">
                {d.examples.map((ex, i) => (
                  <button
                    className="secondary"
                    key={ex.title}
                    onClick={() => {
                      change({ ...fresh(d.id).params, ...ex.params });
                      setExample(i);
                    }}
                  >
                    Load worked example {i + 1}
                  </button>
                ))}
              </div>
              {example !== null && (
                <WorkedExample
                  key={example}
                  example={{
                    title: d.examples[example].title,
                    state: { mode: "applied", values: [] },
                    steps: d.examples[example].steps,
                  }}
                />
              )}
              <details open={r.depth > 0}>
                <summary>Check the math: numbers and units</summary>
                <p>
                  Analytic gradient:{" "}
                  {m.gradient
                    ? pair(m.gradient)
                    : "undefined at a piece boundary"}
                  . Central finite difference (h=0.0001 in each input unit):{" "}
                  {pair(numeric)}. A cross-boundary finite difference estimates
                  a secant, not a missing derivative.
                </p>
                <p>
                  Physical height range: {f(geometry.range[0])} to{" "}
                  {f(geometry.range[1])}. Surface rendering rescales height to
                  0–2.2 display units; the table retains physical units.
                </p>
                {r.depth === 2 && (
                  <p>
                    Numerical agreement is evidence for these inputs, not a
                    general proof. Optimization guarantees depend on the stated
                    function, feasible set and candidate checks. No
                    empirical/causal parameter validation is implied.
                  </p>
                )}
              </details>
              <button
                className="secondary"
                onClick={() => {
                  change({ ...fresh(d.id).params, ...d.edge.params });
                  setFeedback(d.edge.explanation);
                }}
              >
                {d.edge.title}
              </button>
              <p>{d.limit}</p>
            </>
          )}
          {r.stage === 4 && (
            <>
              <span className="eyebrow">
                SEEDED CASE {r.seed} · LEVEL {r.level}
              </span>
              <h2>Solve, then explain.</h2>
              <p>{mission.question}</p>
              <p className="caption">
                Only decision controls can change this seeded case. Other
                assumptions are frozen. Objective feedback checks the numerical
                state and principle; reasoning is self/human reviewed.
              </p>
              <fieldset>
                <legend>Which principle justifies your decision?</legend>
                {mission.choices.map(([v, label]) => (
                  <label className="applied-choice" key={v}>
                    <input
                      type="radio"
                      name="world-rule"
                      checked={rule === v}
                      onChange={() => setRule(v)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <button className="primary" onClick={check}>
                Check mission
              </button>
              <div className="applied-actions">
                <button
                  className="text-button"
                  onClick={() => {
                    guidance();
                    setFeedback(mission.hint);
                  }}
                >
                  Conceptual hint
                </button>
                <button
                  className="text-button"
                  disabled={!attempt}
                  onClick={() => {
                    guidance();
                    setFeedback(mission.solution);
                  }}
                >
                  Reveal after an attempt
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    if (r.seed + 17 > 1e8) {
                      setFeedback("Seed range exhausted; export this record.");
                      return;
                    }
                    const seed = r.seed + 17;
                    patch({ seed, params: d.mission(seed, r.level).params });
                    setRevision((v) => v + 1);
                    setRule("");
                    setFeedback("");
                  }}
                >
                  Fresh seeded case
                </button>
              </div>
              <p>
                {guided
                  ? "Current case is guided, including any earlier reveal on an identical scenario."
                  : "No hint revealed for this scenario."}
              </p>
              <p className="caption">
                {r.attempts.length} saved attempts. A correct case is evidence
                of that attempt only.
              </p>
            </>
          )}
          {r.stage === 5 && (
            <>
              <h2>Build a reusable experiment.</h2>
              <label>
                Project name
                <input
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <p>
                Remix the bounded non-sensitive assumptions below, compare
                scenarios, state a decision and save it locally. This is a model
                exploration, not an operational recommendation.
              </p>
              <div className="applied-actions">
                <button className="primary" onClick={saveProject}>
                  Save world project
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    saveFile(
                      d.id + "-project.json",
                      JSON.stringify(project(), null, 2),
                      "application/json",
                    )
                  }
                >
                  Export world JSON
                </button>
                <label className="secondary">
                  Import world JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        if (file.size > 128000)
                          throw Error("Project exceeds 128 KB.");
                        const data = readProject(await file.text());
                        if (data.world !== d.id)
                          throw Error(
                            "Open the matching world before importing this project.",
                          );
                        const guidedRecord = {
                          ...data.record,
                          guidance: [
                            ...new Set([
                              ...data.record.guidance,
                              evidenceKey(
                                d,
                                data.record.seed,
                                data.record.level,
                              ),
                            ]),
                          ].slice(0, 1000),
                          stage: 5,
                        };
                        setR(guidedRecord);
                        setTitle(data.title);
                        setRevision((v) => v + 1);
                        setFeedback(
                          "Project imported as a remix; this case is guided.",
                        );
                      } catch (err) {
                        setFeedback(
                          err instanceof Error ? err.message : "Invalid file",
                        );
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  className="secondary"
                  onClick={() =>
                    saveFile(
                      d.id + "-decision.csv",
                      csv(p, m.metrics),
                      "text/csv",
                    )
                  }
                >
                  Export decision CSV
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    saveFile(d.id + "-report.md", report(), "text/markdown")
                  }
                >
                  Export project report
                </button>
              </div>
              <details>
                <summary>Show reproducible Python</summary>
                <p>
                  Standalone standard-library script. It uses these exact finite
                  inputs and synthetic assumptions. It does not run arbitrary
                  code in your browser.
                </p>
                <pre>{d.python(p)}</pre>
                <button
                  className="secondary"
                  onClick={() => saveFile(d.id + "-model.py", d.python(p))}
                >
                  Download Python model
                </button>
              </details>
              <a className="text-button" href={d.related.url}>
                {d.related.label} →
              </a>
            </>
          )}
          {(r.stage === 4 || r.stage === 5) && (
            <>
              <label>
                Explain your decision and next experiment
                <textarea
                  maxLength={2000}
                  value={r.reflection}
                  onChange={(e) => patch({ reflection: e.target.value })}
                />
              </label>
              <details>
                <summary>Reasoning and experiment self-check</summary>
                <p>
                  State the question, units, rule, active constraints,
                  validation and a limitation. Explain what would change your
                  decision. Equivalent explanations are welcome; no automatic
                  free-text mastery score is assigned.
                </p>
                <p>
                  For a randomized experiment: define assignment unit,
                  treatment/control, outcome window, sample-size/uncertainty
                  caveats and possible interference. Observational association
                  alone does not establish incrementality.
                </p>
                {attempt && (
                  <button
                    className="secondary"
                    onClick={() =>
                      patch({
                        attempts: r.attempts.map((a) =>
                          a === attempt
                            ? { ...a, reasoning: "self-checked" }
                            : a,
                        ),
                      })
                    }
                  >
                    Mark my reasoning self-checked
                  </button>
                )}
              </details>
            </>
          )}
        </section>
        <section
          className="applied-experiment"
          aria-label="Computed world experiment"
        >
          <SceneFrame
            title={d.title.toUpperCase()}
            scene={{
              kind: "applied",
              geometry: rendered,
              onPoint:
                geometry.draggable && !frozen
                  ? (x, y) => {
                      const [a, b] = unproject(d, x, y);
                      change({ ...p, x: a, y: b });
                    }
                  : undefined,
            }}
          />
          <p className="caption">
            x: {geometry.labels[0]}; y: {geometry.labels[1]}; z:{" "}
            {geometry.labels[2]}.{" "}
            {geometry.draggable
              ? "Drag the decision sphere or use numeric inputs."
              : "Change joint angles with numeric inputs; the arm is planar inside a 3D frame."}{" "}
            Numeric values retain physical units; surface height is rescaled for
            visibility.
          </p>
          {geometry.lines.some((l) => l.label.includes("path")) && (
            <button
              className="secondary"
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                  return;
                }
                if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
                  setReplay(100);
                  setFeedback(
                    "Reduced motion: full computed path is shown without animation.",
                  );
                } else {
                  setReplay(0);
                  setPlaying(true);
                }
              }}
            >
              {playing ? "Pause path replay" : "Replay computed path"}
            </button>
          )}
          <Formula tex={d.formula} />
          <div className="applied-metrics">
            {m.metrics.map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <p className="journey-interpretation">{m.interpretation}</p>
          {m.warnings.map((w) => (
            <p className="applied-warning" key={w}>
              {w}
            </p>
          ))}
          <section
            className="applied-controls"
            aria-label="World numeric controls"
          >
            {rules[d.id].slice(0, 2).map((q) => (
              <NumberInput
                key={q.key + revision}
                rule={q}
                value={p[q.key]}
                disabled={frozen}
                onChange={(v) => change({ ...p, [q.key]: v }, false)}
              />
            ))}
            {d.id === "ml" && (
              <NumberInput
                key={"alpha" + revision}
                rule={rules.ml[2]}
                value={p.alpha}
                disabled={frozen}
                onChange={(v) => change({ ...p, alpha: v }, false)}
              />
            )}
            {d.id === "gis" && (
              <NumberInput
                key={"route" + revision}
                rule={rules.gis[2]}
                value={p.route}
                onChange={(v) => change({ ...p, route: v }, false)}
              />
            )}
          </section>
          <details>
            <summary>Assumptions, constraints and experiment tools</summary>
            <div className="applied-controls">
              {rules[d.id]
                .slice(2)
                .filter((q) => q.key !== "alpha" && q.key !== "route")
                .map((q) => (
                  <NumberInput
                    key={q.key + revision}
                    rule={q}
                    value={p[q.key]}
                    disabled={r.stage === 4 || frozen}
                    onChange={(v) => change({ ...p, [q.key]: v }, false)}
                  />
                ))}
            </div>
            <div className="applied-actions">
              <button
                className="secondary"
                disabled={!past.length || frozen}
                onClick={() => {
                  const prev = past.at(-1)!;
                  setPast(past.slice(0, -1));
                  setFuture([...future, p]);
                  patch({ params: prev });
                  setRevision((v) => v + 1);
                }}
              >
                Undo
              </button>
              <button
                className="secondary"
                disabled={!future.length || frozen}
                onClick={() => {
                  const next = future.at(-1)!;
                  setFuture(future.slice(0, -1));
                  setPast([...past, p]);
                  patch({ params: next });
                  setRevision((v) => v + 1);
                }}
              >
                Redo
              </button>
              <button
                className="secondary"
                onClick={() => {
                  if (frozen) {
                    patch({ frozen: undefined });
                    setFeedback(
                      "Guided development reopened. The fixed held-out set is consumed; later work is guided.",
                    );
                    return;
                  }
                  change(r.stage === 4 ? mission.params : fresh(d.id).params);
                }}
              >
                Reset experiment
              </button>
              <button
                className="secondary"
                onClick={() => setCompare(structuredClone(p))}
              >
                Capture comparison
              </button>
            </div>
            {compare && (
              <p>
                Saved comparison:{" "}
                {d
                  .analyze(compare)
                  .metrics.map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
                . Current physical value minus saved value:{" "}
                {f(m.value - d.analyze(compare).value)}.
              </p>
            )}
            <table>
              <caption>{m.matrixLabel}</caption>
              <tbody>
                {m.matrix.map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => (
                      <td key={j}>{f(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <dl>
              {d.glossary.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </details>
          {d.id === "ml" && (
            <button
              className="secondary"
              disabled={frozen}
              onClick={() => {
                const X = [
                    [1.5, 0.5],
                    [0.5, 2],
                    [2, 2],
                  ],
                  y = [4.7, 7.3, 9.8];
                const loss =
                  X.reduce(
                    (s, row, i) =>
                      s + (row[0] * p.x + row[1] * p.y - y[i]) ** 2,
                    0,
                  ) / 3;
                patch({
                  frozen: { params: structuredClone(p), seed: r.seed, loss },
                  guidance: [...new Set([...r.guidance, "ml:holdout"])],
                });
                setFeedback(
                  `Frozen model held-out MSE: ${f(loss, 6)} meals². Training loss is ${f(m.value)}. This fixed set is now consumed; changing the model afterward is guided development.`,
                );
              }}
            >
              Freeze coefficients and evaluate held-out data
            </button>
          )}
        </section>
      </div>
      <div className="applied-feedback" role="status">
        {feedback}
      </div>
      <div className="journey-next">
        <span>
          {r.stage + 1}/6 · {r.visited.length} stages visited
        </span>
        {r.stage < 5 && (
          <button className="primary" onClick={() => stage(r.stage + 1)}>
            Next: {stages[r.stage + 1]} →
          </button>
        )}
      </div>
    </div>
  );
}
