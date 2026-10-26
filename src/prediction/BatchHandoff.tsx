import { useState } from "react";
import { fmt } from "../math/linear";
import {
  exampleBatch,
  monitorBatch,
  scoreBatch,
  type FrozenArtifact,
  type ScoredBatch,
} from "./handoff";
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BatchHandoff({ artifact }: { artifact: FrozenArtifact }) {
  const initial = exampleBatch(artifact);
  const [input, setInput] = useState(() => JSON.stringify(initial, null, 2));
  const [result, setResult] = useState<ScoredBatch | null>(null);
  const [labels, setLabels] = useState("[]");
  const [asOf, setAsOf] = useState(0);
  const [report, setReport] = useState<ReturnType<typeof monitorBatch> | null>(
    null,
  );
  const [error, setError] = useState("");
  function load(kind: "known" | "late" | "range") {
    const rows = exampleBatch(artifact),
      first = artifact.features[0];
    if (kind === "late") rows[0].features[first.key].availableAt = 1;
    if (kind === "range")
      rows[0].features[first.key].value =
        first.max + 2 * (first.max - first.min || 1);
    setInput(JSON.stringify(rows, null, 2));
    setResult(null);
    setReport(null);
    setError("");
  }
  function score() {
    try {
      const scored = scoreBatch(artifact, JSON.parse(input));
      setResult(scored);
      setReport(null);
      setError("");
      setAsOf(0);
      setLabels(
        JSON.stringify(
          scored.rows.map((r, i) => ({
            id: r.id,
            actual:
              artifact.project === "maintenance"
                ? i % 2
                : Math.max(0, r.prediction + (i % 2 ? -8 : 4)),
            availableAt: r.predictionTime + artifact.horizonHours + 24,
          })),
          null,
          2,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
      setReport(null);
    }
  }
  function review() {
    if (!result) return;
    try {
      setReport(monitorBatch(result, JSON.parse(labels), asOf));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setReport(null);
    }
  }
  return (
    <details className="batch-handoff">
      <summary>Use the frozen model on a new batch</summary>
      <h3>A fitted pipeline should travel with its inputs.</h3>
      <p>
        The artifact contains the exact coefficients or fitted tree,
        training-only scaling, feature names, units, horizon, and frozen
        threshold. Scoring does not fit anything. This is a small teaching
        format, not a general scikit-learn model format.
      </p>
      <div className="handoff-actions">
        <button
          className="secondary"
          onClick={() =>
            download(artifact, `${artifact.project}-frozen-model.json`)
          }
        >
          Download frozen model
        </button>
        <button
          className="text-button"
          onClick={() =>
            download(JSON.parse(input), `${artifact.project}-batch.json`)
          }
          disabled={!result}
        >
          Download scored inputs
        </button>
      </div>
      <p className="caption">
        Clock: elapsed hours relative to this hypothetical batch. Prediction is
        at hour 0. The outcome window ends after {artifact.horizonHours} hours.
        Every feature records its publication time; event time alone does not
        establish availability. These metadata must be truthful—the scorer
        cannot verify the source system.
      </p>
      <div className="handoff-actions" aria-label="Batch examples">
        <button className="text-button" onClick={() => load("known")}>
          Load known inputs
        </button>
        <button className="text-button" onClick={() => load("late")}>
          Load a late input
        </button>
        <button className="text-button" onClick={() => load("range")}>
          Load an input range change
        </button>
      </div>
      <label className="studio-label" htmlFor="batch-input">
        Batch inputs (JSON)
      </label>
      <textarea
        className="code-input"
        id="batch-input"
        value={input}
        maxLength={200000}
        spellCheck={false}
        onChange={(e) => {
          setInput(e.target.value);
          setResult(null);
          setReport(null);
          setError("");
        }}
      />
      <button className="secondary" onClick={score}>
        Validate &amp; score batch
      </button>
      {error && (
        <p role="alert" className="studio-feedback">
          {error}
        </p>
      )}
      {result && (
        <>
          <div className="studio-table">
            <table>
              <caption>
                New-batch predictions · {artifact.units}. A range flag is an
                investigation cue.
              </caption>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Prediction</th>
                  <th>Input check</th>
                  {artifact.project === "maintenance" && <th>Inspect?</th>}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <th>{r.id}</th>
                    <td>{fmt(r.prediction, 3)}</td>
                    <td>
                      {r.outsideTrainingRange.join(", ") ||
                        "Within training ranges"}
                    </td>
                    {r.alert !== null && <td>{r.alert ? "Yes" : "No"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="text-button"
            onClick={() =>
              download(result, `${artifact.project}-predictions.json`)
            }
          >
            Download predictions and model
          </button>
          <h3>Wait for outcomes before judging error.</h3>
          <p>
            These labels are deliberately fabricated for practice, not new
            validation evidence. Each scoring run resets them.{" "}
            {artifact.project === "maintenance"
              ? "The illustrative binary outcomes are 0 and 1."
              : "For the default inputs, errors have magnitudes 4 and 8; after both labels arrive, MAE is 6 original units."}{" "}
            Reports arrive 24 hours after the outcome window ends.
          </p>
          <label className="studio-label" htmlFor="batch-labels">
            Delayed outcomes (JSON)
          </label>
          <textarea
            className="code-input"
            id="batch-labels"
            value={labels}
            maxLength={200000}
            spellCheck={false}
            onChange={(e) => {
              setLabels(e.target.value);
              setReport(null);
            }}
          />
          <label className="studio-label" htmlFor="batch-review-time">
            Review as of (elapsed hours)
          </label>
          <input
            id="batch-review-time"
            type="number"
            min="0"
            max="1000000000"
            value={asOf}
            onChange={(e) => {
              setAsOf(Number(e.target.value));
              setReport(null);
            }}
          />
          <div className="handoff-actions">
            <button className="secondary" onClick={review}>
              Join available outcomes
            </button>
            <button
              className="text-button"
              onClick={() => {
                setAsOf(artifact.horizonHours + 24);
                setReport(null);
              }}
            >
              Advance to example label arrival
            </button>
            <button
              className="text-button"
              onClick={() =>
                download(JSON.parse(labels), `${artifact.project}-labels.json`)
              }
              disabled={!report}
            >
              Download reviewed labels
            </button>
          </div>
          {report && (
            <div className="teaching-callout" role="status">
              <span>AS OF HOUR {asOf}</span>
              <h3>
                {report.labeled} labeled · {report.pending} pending
              </h3>
              <p>
                {report.outsideTrainingRange} of {report.issued} issued rows
                have an input outside training ranges. This alone does not
                establish performance deterioration.
              </p>
              <p>
                {!report.metrics
                  ? "Outcome performance is unavailable until labels arrive. Missing labels are not zero error."
                  : "mae" in report.metrics
                    ? `Observed MAE ${fmt(report.metrics.mae, 3)} ${artifact.units}; bias ${fmt(report.metrics.bias, 3)}. Denominator: ${report.labeled} available outcomes.`
                    : `Observed error cost ${report.metrics.cost}; alerts ${report.metrics.reviewCount}. Denominator: ${report.labeled} available outcomes.`}
              </p>
              <p className="caption">
                A small or selectively labeled sample may misrepresent the
                population. Keep the old artifact for rollback; investigate
                schema, units, timing, and mature outcomes before deciding
                whether to retrain.
              </p>
            </div>
          )}
        </>
      )}
      <details>
        <summary>Rebuild the handoff in readable Python</summary>
        <p>
          Download the learning kit in step 8. Its standard-library scorer
          accepts these exact files; Python runs locally.
        </p>
        <pre>
          <code>{`python serve.py score ${artifact.project}-frozen-model.json ${artifact.project}-batch.json predictions.json\npython serve.py monitor predictions.json ${artifact.project}-labels.json ${artifact.horizonHours + 24} report.json`}</code>
        </pre>
        <p className="caption">
          Keep inputs, labels, the fitted artifact, software/data versions, and
          decision records together. The exported teaching artifact has no
          signature or authenticity guarantee. Refer to the separate handoff
          notebook for a broken-input exercise and its repair.
        </p>
      </details>
    </details>
  );
}
