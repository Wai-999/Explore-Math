import { useMemo, useState } from "react";
import { useLearning } from "../app/LearningContext";
import { Icon } from "../components/Icon";
import { Metric, Range } from "../components/Controls";
import { Formula } from "../components/Formula";
import { fmt } from "../math/linear";
import {
  makeDataset,
  partition,
  rollingOrigins,
  splitAudit,
  type ProjectId,
  type Observation,
} from "./data";
import {
  fit,
  fitStump,
  objective,
  originalCoefficients,
  predict,
  predictStump,
  prepare,
  trainSteps,
  type Model,
} from "./model";
import {
  classificationMetrics,
  regressionMetrics,
  residualRadius,
} from "./metrics";
import {
  canFreeze,
  freezeSession,
  freshSession,
  mutateSession,
  testSession,
  type StudioSession,
} from "./session";
import { perspectives, projects, stages } from "./curriculum";
import { LossPlot, PredictionPlot } from "./Plots";
import { StudioBacklog } from "./StudioLinks";
import "../styles/prediction.css";
const percentage = (n: number | null) =>
  n === null ? "undefined" : `${fmt(n * 100, 1)}%`;
function Choice({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="studio-choice">
      <legend>{name}</legend>
      {options.map(([id, label]) => (
        <label key={id}>
          <input
            type="radio"
            name={name}
            checked={value === id}
            onChange={() => onChange(id)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
export default function PredictionStudio() {
  const { learning, update, record } = useLearning();
  const [id, setId] = useState<ProjectId>(() => {
      const key = location.hash.split("/")[3];
      return ["energy", "maintenance", "demand"].includes(key)
        ? (key as ProjectId)
        : "demand";
    }),
    [feedback, setFeedback] = useState(""),
    [showData, setShowData] = useState(false),
    [benchmarks, setBenchmarks] = useState<
      { name: string; score: number }[] | null
    >(null),
    [perspective, setPerspective] = useState(0);
  const project = projects[id],
    session = learning.studio[id] || freshSession(),
    stage = session.stage;
  const data = useMemo(
    () => makeDataset(id, session.seed, session.shift),
    [id, session.seed, session.shift],
  );
  const training = useMemo(() => partition(data, "train"), [data]),
    validation = useMemo(() => partition(data, "validation"), [data]),
    testing = useMemo(() => partition(data, "test"), [data]),
    audit = useMemo(() => splitAudit(data), [data]);
  const backtestResults = useMemo(
    () =>
      rollingOrigins(data).map((fold) => {
        const fitted = fit(fold.train);
        return {
          ...fold,
          mae: regressionMetrics(
            fold.validation.map((r) => r.y),
            fold.validation.map((r) => predict(fitted, r)),
          ).mae,
        };
      }),
    [data],
  );
  const model = session.model;
  const stump = useMemo(
    () =>
      session.method === "stump"
        ? fitStump(training, data.classification)
        : null,
    [session.method, training, data.classification],
  );
  const predictions = (rows: Observation[], m: Model | null = model) =>
    rows.map((r) =>
      stump ? predictStump(stump, r) : m ? predict(m, r) : r.baseline,
    );
  const valPred = predictions(validation),
    valY = validation.map((r) => r.y);
  const valReg = regressionMetrics(valY, valPred),
    valClass = data.classification
      ? classificationMetrics(valY, valPred, session.threshold)
      : null;
  const radius = data.classification ? 0 : residualRadius(valY, valPred);
  const finalPred = session.tested ? predictions(testing) : null;
  const finalReg = finalPred
    ? regressionMetrics(
        testing.map((r) => r.y),
        finalPred,
      )
    : null;
  const finalClass =
    finalPred && data.classification
      ? classificationMetrics(
          testing.map((r) => r.y),
          finalPred,
          session.threshold,
        )
      : null;
  const baselineReg = regressionMetrics(
    (session.tested ? testing : validation).map((r) => r.y),
    (session.tested ? testing : validation).map((r) => r.baseline),
  );
  const baselineClass = data.classification
    ? classificationMetrics(
        (session.tested ? testing : validation).map((r) => r.y),
        (session.tested ? testing : validation).map((r) => r.baseline),
        session.threshold,
      )
    : null;
  const safeDecision =
    session.tested &&
    (data.classification
      ? finalClass!.cost < baselineClass!.cost && finalClass!.reviewCount <= 12
      : finalReg!.mae < baselineReg.mae && Math.abs(finalReg!.bias) < 10) &&
    !session.shift;
  function save(next: StudioSession) {
    update({ ...learning, studio: { ...learning.studio, [id]: next } });
  }
  function edit(patch: Partial<StudioSession>) {
    try {
      save(mutateSession(session, patch));
      setFeedback("");
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }
  function answer(key: string, value: string) {
    edit({ answers: { ...session.answers, [key]: value } });
  }
  function changeProject(value: ProjectId) {
    history.replaceState(null, "", `#/explore/prediction/${value}`);
    setId(value);
    setFeedback("");
    setShowData(false);
    setBenchmarks(null);
  }
  function newExperiment() {
    const history = session.tested
      ? [
          ...learning.studioHistory,
          {
            project: id,
            seed: session.seed,
            at: session.testedAt!,
            hypothesis: session.hypothesis,
            interpretation: session.interpretation,
            decision: session.decision,
            guided: session.hintUsed,
          },
        ].slice(-100)
      : learning.studioHistory;
    update({
      ...learning,
      studioHistory: history,
      studio: { ...learning.studio, [id]: freshSession(session.seed + 17) },
    });
    setFeedback(
      "A fresh seed creates a new synthetic dataset. It is another sample of the same generator, not an independent real-world replication.",
    );
    setBenchmarks(null);
  }
  function train(steps: number) {
    const start = model || prepare(training, data.classification, session.leak);
    const next =
      session.method === "stump"
        ? { ...start, iterations: 1, losses: [], status: "ready" as const }
        : trainSteps(start, training, steps, session.rate, session.lambda);
    edit({ model: next });
  }
  function resetModel(patch: Partial<StudioSession>) {
    edit({ ...patch, model: null });
    setBenchmarks(null);
  }
  function compare() {
    const score = (p: number[]) =>
      data.classification
        ? classificationMetrics(valY, p, session.threshold).logLoss
        : regressionMetrics(valY, p).mae;
    const st = fitStump(training, data.classification);
    setBenchmarks([
      { name: "Baseline", score: score(validation.map((r) => r.baseline)) },
      ...[0, 0.1, 1].map((lambda) => {
        const m = fit(training, data.classification, false, lambda);
        return {
          name: lambda ? `Ridge λ=${lambda}` : "Linear / logistic",
          score: score(validation.map((r) => predict(m, r))),
        };
      }),
      {
        name: "One-split tree",
        score: score(validation.map((r) => predictStump(st, r))),
      },
    ]);
  }
  const n1 = 2 + (session.seed % 5),
    n2 = 4 + (session.seed % 7),
    expectedMAE = (n1 + n2) / 2;
  function checkTransfer() {
    const eligible = project.features
      .map((f, i) => (f.available ? String(i) : ""))
      .filter(Boolean)
      .join(",");
    const answerFeatures = project.features
      .map((_, i) =>
        session.answers[`feature-${i}`] === "yes" ? String(i) : "",
      )
      .filter(Boolean)
      .join(",");
    const splitOK =
      session.answers.split === (data.classification ? "group" : "time");
    const numerical =
      Math.abs(Number(session.answers.mae) - expectedMAE) < 0.015 &&
      session.answers.mae?.trim() !== "";
    const decisionOK =
      session.answers.recommendation === (safeDecision ? "pilot" : "hold");
    const pass =
      answerFeatures === eligible &&
      splitOK &&
      numerical &&
      decisionOK &&
      session.interpretation.trim().length >= 40 &&
      session.tested;
    const misconceptions = [
      ...(answerFeatures !== eligible
        ? ["Availability time differs from event time."]
        : []),
      ...(!splitOK
        ? ["Evaluation must represent the deployment population."]
        : []),
      ...(!numerical
        ? ["MAE averages absolute errors in the original units."]
        : []),
      ...(!decisionOK
        ? [
            "An operating recommendation must follow the frozen evidence and guardrails.",
          ]
        : []),
    ];
    save({ ...session, misconceptions });
    if (!session.hintUsed)
      record(`prediction-${id}-${session.seed}`, session.seed, pass);
    setFeedback(
      pass
        ? session.hintUsed
          ? "Structured checks passed with guidance. Your written rationale is saved for human review."
          : "Structured checks passed on this seed. Your rationale is saved for human review; this is evidence of an example, not mastery."
        : "Review feature availability, split choice, the MAE calculation, and the evidence behind your recommendation. Complete a frozen final evaluation and write at least 40 characters of interpretation. No solution has been revealed.",
    );
  }
  const depth = learning.depth,
    explanation =
      depth === "intuition"
        ? project.intuition
        : depth === "foundations"
          ? project.foundations
          : depth === "advanced"
            ? project.advanced
            : project.research;
  return (
    <>
      <div className="studio-heading">
        <div>
          <span className="eyebrow">PREDICTION STUDIO / BUILD & TEACH</span>
          <h1>
            Think it through.
            <br />
            <span>Then build it.</span>
          </h1>
          <p>Question → data → assumptions → model → evidence → decision.</p>
        </div>
        <div className="review-badge">
          <Icon name="FlaskConical" size={20} />
          <span>
            Review candidate<strong>Human learning review pending</strong>
          </span>
        </div>
      </div>
      <div
        className="project-tabs"
        role="group"
        aria-label="Prediction learning project"
      >
        {(["demand", "energy", "maintenance"] as ProjectId[]).map((k) => (
          <button
            key={k}
            aria-pressed={id === k}
            className={id === k ? "active" : ""}
            onClick={() => changeProject(k)}
          >
            <Icon name={projects[k].icon} size={19} />
            <span>
              {projects[k].title}
              <small>{projects[k].domain}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="studio-workspace">
        <nav className="lesson-steps" aria-label="Learning stages">
          {stages.map((title, i) => (
            <button
              key={title}
              className={stage === i ? "active" : ""}
              aria-current={stage === i ? "step" : undefined}
              onClick={() => edit({ stage: i })}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {title}
              {i === 5 && session.tested && <Icon name="Check" size={14} />}
            </button>
          ))}
          <div className="session-meta">
            Experiment seed <strong>{session.seed}</strong>
            <span>
              {session.tested
                ? "Final test opened · protocol locked"
                : session.frozen
                  ? "Protocol frozen"
                  : "Development · test hidden"}
            </span>
            <button className="text-button" onClick={newExperiment}>
              Fresh experiment <Icon name="RotateCcw" size={14} />
            </button>
          </div>
        </nav>
        <section className="lesson-stage">
          <div className="lesson-stage-heading">
            <span className="eyebrow">
              {project.domain} · STEP {stage + 1} OF 8
            </span>
            <h2>{stages[stage]}</h2>
            <p>{project.subtitle}</p>
          </div>
          {stage === 0 && (
            <>
              <div className="teaching-callout">
                <span>THE QUESTION</span>
                <h3>
                  {id === "demand"
                    ? "What can we know by Sunday night?"
                    : id === "energy"
                      ? "What makes tomorrow different from a typical day?"
                      : "Which risks are worth acting on?"}
                </h3>
                <p>{project.intuition}</p>
              </div>
              <dl className="prediction-contract">
                {project.contract.map(([term, detail]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>
              <label className="studio-label" htmlFor="hypothesis">
                Your working hypothesis
              </label>
              <textarea
                id="hypothesis"
                maxLength={5000}
                value={session.hypothesis}
                disabled={session.frozen}
                placeholder="I expect this information to improve on the baseline because…"
                onChange={(e) => edit({ hypothesis: e.target.value })}
              />
              <p className="caption">
                Write at least 20 characters before freezing. A hypothesis
                explains a testable expectation; it is not proof.
              </p>
            </>
          )}
          {stage === 1 && (
            <>
              <p className="lesson-lead">
                Feature means input. Eligibility depends on when information
                becomes available, not just when its event happened.
              </p>
              <div className="feature-audit">
                {project.features.map((feature, i) => (
                  <div key={feature.label}>
                    <h3>{feature.label}</h3>
                    <Choice
                      name={`Available at the cutoff? ${i + 1}`}
                      value={session.answers[`feature-${i}`] || ""}
                      options={[
                        ["yes", "Available"],
                        ["no", "Unavailable"],
                      ]}
                      onChange={(v) => answer(`feature-${i}`, v)}
                    />
                  </div>
                ))}
              </div>
              <div className="data-quality-note">
                <Icon name="Layers3" size={20} />
                <p>
                  <strong>Synthetic dataset v1 · seed {session.seed}.</strong>{" "}
                  No missing values or duplicate row IDs are generated. This
                  intentionally clean example does not represent a completed
                  real data-quality investigation. Check join grain,
                  missingness, censoring, and label maturity in your own data;
                  the mechanism of missingness cannot be inferred from blanks
                  alone.
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => setShowData(!showData)}
              >
                {showData ? "Hide training sample" : "Inspect training rows"}
              </button>
              {showData && (
                <div className="studio-table">
                  <table>
                    <caption>
                      First six training observations only; final labels stay
                      hidden.
                    </caption>
                    <thead>
                      <tr>
                        <th>Row / entity</th>
                        <th>Inputs</th>
                        <th>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {training.slice(0, 6).map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.id}
                            <small>{r.entity}</small>
                          </td>
                          <td>{r.x.map((x) => fmt(x, 2)).join(", ")}</td>
                          <td>{fmt(r.y, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="caption">
                    Input order: {data.features.join(" · ")}. Outcome units:{" "}
                    {data.units}. Data is original, deterministic synthetic
                    teaching material, MIT licensed with this project.
                  </p>
                </div>
              )}
            </>
          )}
          {stage === 2 && (
            <>
              <p className="lesson-lead">
                Evaluation is a rehearsal of deployment. Choose what “new” means
                before comparing models.
              </p>
              <div
                className="split-timeline"
                aria-label={`Train ${audit.counts[0]}, validation ${audit.counts[1]}, hidden test ${audit.counts[2]} observations`}
              >
                <div>
                  TRAIN<strong>{audit.counts[0]} rows</strong>
                  <small>Fit preprocessing & coefficients</small>
                </div>
                <div>
                  VALIDATION<strong>{audit.counts[1]} rows</strong>
                  <small>Choose model & policy</small>
                </div>
                <div>
                  FINAL TEST<strong>{audit.counts[2]} rows</strong>
                  <small>
                    {session.tested ? "Opened once" : "Hidden until frozen"}
                  </small>
                </div>
              </div>
              <p>{project.split}</p>
              <Choice
                name="Which evaluation best matches this deployment?"
                value={session.answers.split || ""}
                options={[
                  ["random", "Randomly shuffle individual rows"],
                  ["time", "Train on earlier time; evaluate later"],
                  ["group", "Separate whole machines"],
                ]}
                onChange={(v) => answer("split", v)}
              />
              <div className="teaching-callout">
                <span>WHY THIS CHOICE MATTERS</span>
                <p>
                  {data.classification
                    ? `Entity overlap across the prescribed partitions: ${audit.groupOverlap}. Keeping all snapshots from one machine together tests unseen machines. It does not by itself solve future label maturity.`
                    : `Prescribed partitions are chronological: ${audit.chronological ? "yes" : "no"}. Random shuffling would let later patterns influence earlier forecasts.`}
                </p>
              </div>
              <details>
                <summary>
                  Cross-validation, nested evaluation, and dependent data
                </summary>
                <p>
                  Repeated development folds estimate how choices behave across
                  available periods or entities. Fit every preprocessing step
                  inside each training fold. If tuning and evaluation share the
                  same folds, model selection can bias reported performance; an
                  outer evaluation loop can separate them. Split sizes depend on
                  the available evidence and forecast horizon, not a universal
                  80/20 rule.
                </p>
                <p>
                  For overlapping target windows or reporting delays, leave a
                  sufficient gap. For spatial deployment, consider spatial
                  blocks. A standard deviation across folds is not automatically
                  a confidence interval.
                </p>
              </details>
            </>
          )}
          {stage === 3 && (
            <>
              <p className="lesson-lead">
                Build a small model. Watch each parameter update reduce a
                defined training objective.
              </p>
              <p className="baseline-note">
                <strong>Baseline:</strong> {project.baseline}
              </p>
              <div className="training-controls">
                <label>
                  Model family
                  <select
                    aria-label="Model family"
                    value={session.method}
                    disabled={session.frozen}
                    onChange={(e) =>
                      resetModel({
                        method: e.target.value as StudioSession["method"],
                        leak: false,
                      })
                    }
                  >
                    <option value="gradient">
                      {data.classification
                        ? "Logistic regression"
                        : "Linear / ridge regression"}
                    </option>
                    <option value="stump">One-split decision tree</option>
                  </select>
                </label>
                <label>
                  Ridge penalty λ
                  <select
                    aria-label="Ridge penalty"
                    value={session.lambda}
                    disabled={session.frozen || session.method === "stump"}
                    onChange={(e) =>
                      resetModel({ lambda: Number(e.target.value) })
                    }
                  >
                    {[0, 0.01, 0.1, 1].map((v) => (
                      <option value={v} key={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={session.frozen ? "locked-controls" : ""}>
                <Range
                  label="Learning rate"
                  disabled={session.frozen}
                  value={session.rate}
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  onChange={(v) => !session.frozen && edit({ rate: v })}
                />
              </div>
              <label className="leak-toggle">
                <input
                  type="checkbox"
                  checked={session.leak}
                  disabled={session.frozen || session.method === "stump"}
                  onChange={(e) => resetModel({ leak: e.target.checked })}
                />{" "}
                Deliberately add the future outcome (leakage experiment)
              </label>
              <div className="training-actions">
                <button
                  className="secondary"
                  disabled={session.frozen}
                  onClick={() => train(1)}
                >
                  One update
                </button>
                <button
                  className="primary"
                  disabled={session.frozen}
                  onClick={() => train(200)}
                >
                  Train 200 updates <Icon name="ArrowRight" size={17} />
                </button>
              </div>
              {model && session.method === "gradient" ? (
                <>
                  <LossPlot values={model.losses} />
                  <div className="metrics">
                    <Metric label="Updates" value={String(model.iterations)} />
                    <Metric
                      label="Training objective"
                      value={fmt(objective(model, training), 5)}
                      detail="standardized loss + penalty"
                    />
                    <Metric label="Current status" value={model.status} />
                  </div>
                  <div className="coefficient-strip">
                    <span>Standardized coefficients:</span>
                    {model.weights.map((w, i) => (
                      <code key={i}>
                        {i ? `w${i}` : "b"} = {fmt(w, 4)}
                      </code>
                    ))}
                  </div>
                </>
              ) : (
                <p className="caption">
                  A one-split tree greedily chooses one feature and threshold
                  using training squared error. It is an intentionally small
                  baseline, not a random forest.
                </p>
              )}
              {model &&
                !data.classification &&
                originalCoefficients(model) &&
                session.method === "gradient" && (
                  <p className="caption">
                    Original-scale intercept:{" "}
                    {fmt(originalCoefficients(model)!.intercept)}. Slopes:{" "}
                    {originalCoefficients(model)!
                      .slopes.map((x) => fmt(x))
                      .join(", ")}
                    . Predictions are displayed in {data.units}.
                  </p>
                )}
              <Formula
                tex={
                  data.classification
                    ? "p=\\sigma(b+\\mathbf w^T\\mathbf x),\\quad L=\\mathrm{logloss}+\\frac\\lambda2\\|\\mathbf w\\|^2"
                    : "\\hat y=b+\\mathbf w^T\\mathbf x,\\quad L=\\frac1{2n}\\sum(\\hat z_i-z_i)^2+\\frac\\lambda2\\|\\mathbf w\\|^2"
                }
              />
              <p className="caption">
                z is the target standardized with training-only statistics. For
                logistic regression the target remains binary. The intercept is
                not penalized.
              </p>
              <details>
                <summary>Hand calculation → pseudocode → Python</summary>
                <p>{project.worked}</p>
                <pre>
                  <code>{`# Conceptual gradient loop; full tested pipeline is downloadable below.\nfor step in range(200):\n    prediction = model(features)\n    gradient = loss_gradient(prediction, target)\n    weights -= learning_rate * gradient\n\n# Professional pipeline: split first, fit preprocessing on train only.\npipeline.fit(X_train, y_train)\nvalidation_prediction = pipeline.predict(X_validation)`}</code>
                </pre>
                <p>
                  Train chooses parameters. Validation chooses the experiment.
                  The final test does neither. The accompanying notebooks show
                  every step using actual runnable Python, including a fitted
                  scikit-learn Pipeline.
                </p>
              </details>
            </>
          )}
          {stage === 4 && (
            <>
              <p className="lesson-lead">
                A smaller training loss is an observation. Diagnose whether the
                model learned a useful pattern.
              </p>
              {!model && (
                <p className="studio-alert">
                  Train in step 4 first. The values below currently show the
                  baseline.
                </p>
              )}
              <PredictionPlot
                rows={validation}
                predicted={valPred}
                classification={data.classification}
                threshold={session.threshold}
                radius={radius}
              />
              {valClass ? (
                <>
                  <div className="metrics">
                    <Metric
                      label="Validation log loss"
                      value={fmt(valClass.logLoss, 4)}
                    />
                    <Metric
                      label="Recall / precision"
                      value={`${percentage(valClass.recall)} / ${percentage(valClass.precision)}`}
                    />
                    <Metric
                      label="Validation cost"
                      value={fmt(valClass.cost)}
                      detail={`${valClass.reviewCount} alerts / 40 rows`}
                    />
                  </div>
                  <div className={session.frozen ? "locked-controls" : ""}>
                    <Range
                      label="Inspection threshold"
                      disabled={session.frozen}
                      value={session.threshold}
                      min={0.05}
                      max={0.95}
                      step={0.05}
                      onChange={(v) =>
                        !session.frozen && edit({ threshold: v })
                      }
                    />
                  </div>
                  <div className="studio-table">
                    <table>
                      <caption>
                        Validation confusion matrix: counts, threshold{" "}
                        {fmt(session.threshold)}
                      </caption>
                      <tbody>
                        <tr>
                          <th>True positive</th>
                          <td>{valClass.tp}</td>
                          <th>False positive</th>
                          <td>{valClass.fp}</td>
                        </tr>
                        <tr>
                          <th>False negative</th>
                          <td>{valClass.fn}</td>
                          <th>True negative</th>
                          <td>{valClass.tn}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="caption">
                    Miss = 10 cost units; false alarm = 1. Brier{" "}
                    {fmt(valClass.brier, 4)} · AP{" "}
                    {fmt(valClass.averagePrecision ?? NaN, 3)} · ROC-AUC{" "}
                    {fmt(valClass.auc ?? NaN, 3)}. Undefined denominators are
                    shown explicitly. Threshold changes do not change the
                    probabilities or calibration bins.
                  </p>
                </>
              ) : (
                <>
                  <div className="metrics">
                    <Metric
                      label="Validation MAE"
                      value={fmt(valReg.mae, 2)}
                      detail={data.units}
                    />
                    <Metric
                      label="Validation RMSE"
                      value={fmt(valReg.rmse, 2)}
                      detail={data.units}
                    />
                    <Metric
                      label="Signed bias"
                      value={fmt(valReg.bias, 2)}
                      detail="prediction − actual"
                    />
                  </div>
                  <p className="caption">
                    Empirical 90th percentile of absolute validation residuals:
                    ±{fmt(radius, 2)} {data.units}. This descriptive band is not
                    a calibrated guarantee. R² ={" "}
                    {valReg.r2 === null
                      ? "undefined (constant target)"
                      : fmt(valReg.r2)}
                    ; MAPE can break on zero/small outcomes.
                  </p>
                </>
              )}
              <div className="studio-table">
                <table>
                  <caption>
                    Validation error slices with explicit sample counts
                  </caption>
                  <thead>
                    <tr>
                      <th>Slice</th>
                      <th>Rows</th>
                      <th>{data.classification ? "Log loss" : "MAE"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Set(validation.map((r) => r.segment))].map(
                      (segment) => {
                        const rs = validation.filter(
                            (r) => r.segment === segment,
                          ),
                          p = predictions(rs);
                        return (
                          <tr key={segment}>
                            <th>{segment}</th>
                            <td>{rs.length}</td>
                            <td>
                              {fmt(
                                data.classification
                                  ? classificationMetrics(
                                      rs.map((r) => r.y),
                                      p,
                                      session.threshold,
                                    ).logLoss
                                  : regressionMetrics(
                                      rs.map((r) => r.y),
                                      p,
                                    ).mae,
                                3,
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
              <button className="secondary" onClick={compare}>
                Compare development models
              </button>
              {benchmarks && (
                <div className="studio-table">
                  <table>
                    <caption>
                      Same validation observations;{" "}
                      {data.classification ? "log loss" : "MAE"} (lower is
                      better). No final test used.
                    </caption>
                    <tbody>
                      {benchmarks.map((b) => (
                        <tr key={b.name}>
                          <th>{b.name}</th>
                          <td>{fmt(b.score, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="caption">
                    This is a recorded five-candidate development search.
                    Differences on one synthetic validation sample are not
                    statistically established rankings. Ensembles/boosting and
                    nested model selection are demonstrated in the Python
                    companion.
                  </p>
                </div>
              )}
              <details>
                <summary>Bias, variance, stability, and interpretation</summary>
                <p>
                  Compare training and validation loss before adding capacity.
                  Large training error can reflect weak features, optimization
                  failure, noise, or a restrictive model. Low training error
                  with poor validation suggests overfitting, shift, leakage, or
                  an unsuitable split. Use ablations, learning curves, repeated
                  seeds, and label audits to distinguish them. Coefficients and
                  feature importance describe this fitted predictor; they do not
                  prove causal effects.
                </p>
              </details>
            </>
          )}
          {stage === 5 && (
            <>
              <p className="lesson-lead">
                Agree on the protocol before seeing the final outcomes. Opening
                the test locks this experiment, including after a reload.
              </p>
              <div className="freeze-card">
                <Icon name={session.frozen ? "Check" : "BookOpen"} size={27} />
                <div>
                  <h3>
                    {session.tested
                      ? "Final evidence opened"
                      : session.frozen
                        ? "Protocol frozen"
                        : "Final test remains hidden"}
                  </h3>
                  <p>
                    Seed {session.seed} · {session.method} · λ {session.lambda}{" "}
                    · {model?.iterations || 0} updates ·{" "}
                    {session.leak
                      ? "future leakage included"
                      : "prediction-time inputs only"}
                    {data.classification
                      ? ` · threshold ${fmt(session.threshold)}`
                      : ""}
                  </p>
                </div>
              </div>
              {!session.frozen && (
                <button
                  className="primary"
                  disabled={!canFreeze(session)}
                  onClick={() => {
                    try {
                      save(freezeSession(session));
                      setFeedback(
                        "Protocol frozen. Model and policy controls are now locked.",
                      );
                    } catch (e) {
                      setFeedback((e as Error).message);
                    }
                  }}
                >
                  Freeze this experiment <Icon name="Check" size={17} />
                </button>
              )}
              {!canFreeze(session) && !session.frozen && (
                <p className="caption">
                  Train a stable model, remove the future-outcome feature, and
                  write a hypothesis of at least 20 characters in step 1.
                </p>
              )}
              {session.frozen && !session.tested && (
                <button
                  className="primary"
                  onClick={() => {
                    save(testSession(session));
                    setFeedback(
                      "Final test opened once. Interpret this evidence before starting a fresh experiment.",
                    );
                  }}
                >
                  Open final test once <Icon name="ArrowUpRight" size={17} />
                </button>
              )}
              {session.tested && finalReg && (
                <>
                  <div className="metrics">
                    {finalClass ? (
                      <>
                        <Metric
                          label="Final log loss"
                          value={fmt(finalClass.logLoss, 4)}
                        />
                        <Metric
                          label="Final error cost"
                          value={fmt(finalClass.cost)}
                          detail={`baseline ${baselineClass!.cost} cost units`}
                        />
                        <Metric
                          label="Alerts / capacity"
                          value={`${finalClass.reviewCount} / 12`}
                        />
                      </>
                    ) : (
                      <>
                        <Metric
                          label="Final MAE"
                          value={fmt(finalReg.mae, 2)}
                          detail={data.units}
                        />
                        <Metric
                          label="Baseline MAE"
                          value={fmt(baselineReg.mae, 2)}
                          detail="same test rows"
                        />
                        <Metric
                          label="Final bias"
                          value={fmt(finalReg.bias, 2)}
                          detail="prediction − actual"
                        />
                      </>
                    )}
                  </div>
                  {!data.classification && (
                    <p>
                      Empirical validation band covers{" "}
                      {percentage(
                        testing.filter(
                          (r, i) => Math.abs(r.y - finalPred![i]) <= radius,
                        ).length / testing.length,
                      )}{" "}
                      of final observations, at average width{" "}
                      {fmt(radius * 2, 2)} {data.units}. Coverage can
                      deteriorate under shift.
                    </p>
                  )}
                  <p className="caption">
                    The test is hidden by the learning workflow, not
                    cryptographic security: synthetic values ship in the static
                    bundle. A determined user can inspect them; this is not a
                    proctored benchmark.
                  </p>
                </>
              )}
              <details>
                <summary>What counts as an untouched test?</summary>
                <p>
                  If a test result guides a revision, that result has become
                  development feedback. Reopening the same values does not
                  restore independence. A fresh seed samples another synthetic
                  dataset from the same generator; it cannot establish
                  performance on a real factory, fleet, or store.
                </p>
              </details>
            </>
          )}
          {stage === 6 && (
            <>
              <p className="lesson-lead">
                Translate evidence into an operational recommendation with a
                fallback and monitoring plan.
              </p>
              <div className="teaching-callout">
                <span>
                  {session.tested
                    ? "CONDITIONAL READOUT"
                    : "FINAL EVIDENCE NOT OPENED"}
                </span>
                <h3>
                  {!session.tested
                    ? "Finish the frozen evaluation first"
                    : safeDecision
                      ? "A monitored pilot may be worth investigating"
                      : "Hold deployment and investigate"}
                </h3>
                <p>{project.decision}</p>
              </div>
              <p className="caption">
                Declared teaching rubric:{" "}
                {data.classification
                  ? "a pilot candidate must cost less than the prevalence baseline and produce at most 12 alerts per 40 evaluated snapshots"
                  : "a pilot candidate must beat baseline MAE and have absolute signed bias below 10 original outcome units"}
                . A known injected regime change requires investigation in this
                rubric. These are illustrative guardrails, not universal
                deployment rules.
              </p>
              <Choice
                name="Your recommendation from the frozen evidence"
                value={session.answers.recommendation || ""}
                options={[
                  ["pilot", "Consider a monitored pilot, with safeguards"],
                  ["hold", "Hold deployment and investigate"],
                ]}
                onChange={(v) => answer("recommendation", v)}
              />
              <label className="studio-label" htmlFor="interpretation">
                Evidence, assumptions, and what would change your decision
              </label>
              <textarea
                id="interpretation"
                value={session.interpretation}
                maxLength={5000}
                onChange={(e) => edit({ interpretation: e.target.value })}
                placeholder="Compare against baseline, discuss a failure slice, and state a limitation…"
              />
              <label className="studio-label" htmlFor="decision">
                Operating plan and rollback trigger
              </label>
              <textarea
                id="decision"
                value={session.decision}
                maxLength={5000}
                onChange={(e) => edit({ decision: e.target.value })}
                placeholder="Owner; manual fallback; label delay; monitoring cadence; rollback condition…"
              />
              <details>
                <summary>Monitoring and distribution shift experiment</summary>
                <p>
                  Before freezing a fresh experiment, inject a later regime
                  change. Only the final population changes; training and
                  validation stay fixed. The test will reveal whether the
                  previous pattern remains useful. This is a controlled
                  demonstration, not a drift detector or a prospective trial.
                </p>
                <label className="leak-toggle">
                  <input
                    type="checkbox"
                    disabled={session.frozen}
                    checked={session.shift}
                    onChange={(e) => resetModel({ shift: e.target.checked })}
                  />{" "}
                  Inject a final-period regime change
                </label>
                <p>
                  Monitoring needs schema/range checks, preprocessing/model
                  versions, missingness, latency, probability/feature shifts,
                  delayed outcome performance, and an accountable owner. Drift
                  is a warning, not proof of degraded predictive performance.
                  Retrain after a diagnosed change and re-evaluate with a new
                  protocol; preserve the previous artifact for rollback.
                </p>
              </details>
            </>
          )}
          {stage === 7 && (
            <>
              <p className="lesson-lead">
                Rebuild the idea without copying a worked answer. One completed
                example does not prove retained understanding.
              </p>
              <div className="teaching-callout">
                <span>TRANSFER TO A DIFFERENT SETTING</span>
                <p>{project.transfer}</p>
              </div>
              <label className="studio-label" htmlFor="mae-answer">
                A new numerical check: two absolute forecast errors are {n1} and{" "}
                {n2}. What is MAE?
              </label>
              <input
                className="studio-number"
                id="mae-answer"
                type="number"
                min="0"
                step=".01"
                value={session.answers.mae || ""}
                onChange={(e) => answer("mae", e.target.value)}
              />
              <p className="caption">
                Use the original outcome units. Tolerance ±0.015. Feature
                availability from step 2, split choice from step 3, and your
                evidence-based recommendation from step 7 are checked together.
              </p>
              <button className="primary" onClick={checkTransfer}>
                Check structured understanding <Icon name="Check" size={17} />
              </button>
              <button
                className="text-button hint-button"
                onClick={() => {
                  edit({ hintUsed: true });
                  setFeedback(
                    `Worked guidance: ${project.features.map((f, i) => `${i + 1}: ${f.available ? "available" : "unavailable"} — ${f.why}`).join(" ")} MAE is the sum of absolute errors divided by their count. This experiment is now marked guided.`,
                  );
                }}
              >
                Show guidance for this attempt
              </button>
              <div className="download-card">
                <Icon name="Download" size={29} />
                <div>
                  <h3>Rebuild it in Python.</h3>
                  <p>
                    Three executed notebooks, transparent algorithms,
                    scikit-learn pipelines, data dictionaries, tests, and answer
                    keys. Python runs on your computer, not on GitHub Pages.
                  </p>
                  <a
                    className="secondary"
                    href={`${import.meta.env.BASE_URL}workshops/prediction-workshops.zip`}
                    download
                  >
                    Download learning kit
                  </a>
                  <a
                    className="text-button"
                    href={`${import.meta.env.BASE_URL}workshops/${id}.ipynb`}
                    download
                  >
                    Download this notebook <Icon name="ArrowDown" size={15} />
                  </a>
                </div>
              </div>
              <details>
                <summary>Capstone brief: design your own prediction</summary>
                <p>
                  Choose a decision in a different domain. Write a prediction
                  contract and a feature-availability table. Justify random,
                  grouped, temporal, or combined evaluation. Establish a non-ML
                  baseline, fit a reproducible pipeline, record failures and
                  revisions, freeze the test protocol, and write a conditional
                  decision memo. Include who might be poorly represented and a
                  realistic monitoring/rollback plan. No automated mastery score
                  is assigned to this open project.
                </p>
              </details>
            </>
          )}
          <p className="studio-feedback" role="status">
            {feedback}
          </p>
          <div className="stage-navigation">
            <button
              className="secondary"
              disabled={stage === 0}
              onClick={() => edit({ stage: stage - 1 })}
            >
              ← Previous
            </button>
            <span>
              {stage + 1} / {stages.length}
            </span>
            <button
              className="primary"
              disabled={stage === 7}
              onClick={() => edit({ stage: stage + 1 })}
            >
              Next step <Icon name="ArrowRight" size={16} />
            </button>
          </div>
        </section>
        <aside className="thinking-panel">
          <span className="eyebrow">MAKE THE REASONING VISIBLE</span>
          <h3>The idea behind the step</h3>
          <p>{explanation}</p>
          <details>
            <summary>What can go wrong?</summary>
            <p>{project.pitfall}</p>
          </details>
          <label htmlFor="perspective" className="studio-label">
            Look through another lens
          </label>
          <select
            id="perspective"
            value={perspective}
            onChange={(e) => setPerspective(Number(e.target.value))}
          >
            {perspectives.map(([title], i) => (
              <option value={i} key={title}>
                {title}
              </option>
            ))}
          </select>
          <p>{perspectives[perspective][1]}</p>
          <a className="text-button" href="#/learning">
            Change explanation depth <Icon name="ArrowUpRight" size={14} />
          </a>
          <div className="thinking-note">
            OBSERVATION ≠ EXPLANATION ≠ CAUSAL EFFECT
            <br />
            Synthetic data · local computation · no account
          </div>
          <details>
            <summary>References and reproducibility</summary>
            <a
              href="https://scikit-learn.org/stable/common_pitfalls.html"
              target="_blank"
              rel="noreferrer"
            >
              scikit-learn: leakage and preprocessing
            </a>
            <a
              href="https://scikit-learn.org/stable/modules/cross_validation.html"
              target="_blank"
              rel="noreferrer"
            >
              scikit-learn: cross-validation
            </a>
            <a
              href="https://otexts.com/fpp3/toolbox.html"
              target="_blank"
              rel="noreferrer"
            >
              Forecasting: Principles and Practice
            </a>
            <p>
              The dataset generator and tested model kernels are in the source
              repository. Seeds reproduce the lesson; they do not remove
              uncertainty.
            </p>
          </details>
          {id === "demand" && (
            <details>
              <summary>Rolling-origin development backtests</summary>
              <p>
                Each fold fits a new model and training-only scaler before
                predicting the next six weeks. None reaches the final test
                period.
              </p>
              {backtestResults.map((fold) => (
                <p key={fold.cut}>
                  Cutoff week {fold.cut}: {fold.train.length} train /{" "}
                  {fold.validation.length} later rows · MAE {fmt(fold.mae, 2)}{" "}
                  packs/store-week.
                </p>
              ))}
            </details>
          )}
        </aside>
      </div>
      <StudioBacklog />
    </>
  );
}
