import { useState } from "react";
import type { DerivationStep } from "../content/concepts";
export function DerivationStepper({
  steps,
  index,
  onStep,
  onCheck,
}: {
  steps: DerivationStep[];
  index: number;
  onStep: (n: number) => void;
  onCheck: (rule: string, correct: boolean) => void;
}) {
  const current = Math.min(index, steps.length - 1),
    line = steps[current];
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  return (
    <section
      className="derivation-stepper"
      aria-label="Mathematical derivation"
    >
      <p className="evidence-kind">
        Derivation from stated assumptions · not an inference from animation
      </p>
      <p className="step-count">
        Step {current + 1} of {steps.length}
      </p>
      <ol start={current + 1}>
        <li>
          <p className="proof-statement">{line.statement}</p>
          <p>
            <strong>{line.rule}:</strong> {line.justification}
          </p>
          <p className="caption">
            Linked quantity: {line.linkedVisualState}. The scene and live
            calculation use the experiment's current values.
          </p>
        </li>
      </ol>
      <div className="journey-actions">
        <button
          className="secondary"
          disabled={current === 0}
          onClick={() => {
            onStep(current - 1);
            setFeedback("");
          }}
        >
          Previous proof step
        </button>
        <button
          className="secondary"
          disabled={current === steps.length - 1}
          onClick={() => {
            onStep(current + 1);
            setFeedback("");
          }}
        >
          Next proof step
        </button>
      </div>
      <details>
        <summary>Practice a missing justification</summary>
        <p>
          For “{steps[1]?.statement || line.statement}”, which kind of
          justification is used? This is guided retrieval after a worked
          derivation.
        </p>
        <label htmlFor="proof-reason">Justification category</label>
        <select
          id="proof-reason"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        >
          <option value="">Choose a reason</option>
          {[
            "definition",
            "algebra",
            "theorem",
            "calculation",
            "limit",
            "example",
          ].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          className="secondary"
          disabled={!answer}
          onClick={() => {
            const correct = answer === (steps[1] || line).rule;
            onCheck(answer, correct);
            setFeedback(
              correct
                ? "That rule fits this step. Explain in your own words why its assumptions hold."
                : "Revisit the step's rule and assumptions. A numerical example does not establish a general identity.",
            );
          }}
        >
          Check justification
        </button>
        <p role="status">{feedback}</p>
      </details>
    </section>
  );
}
