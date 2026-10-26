import { useLearning } from "../app/LearningContext";
import { concepts } from "../content/concepts";
import { conceptIds } from "./model";
import "../styles/education.css";
import { journeyStatus } from "./session";
export default function JourneySummary() {
  const { learning } = useLearning();
  return (
    <section className="journey-summary learning-card">
      <span className="eyebrow">LEARN · EXPLAIN · RETURN</span>
      <h2>Your concept journeys</h2>
      <p>
        These records describe particular attempts. They do not establish
        general mastery, long-term retention, or externally reviewed proof
        ability.
      </p>
      <div className="journey-records">
        {conceptIds.map((id) => {
          const s = learning.journeys[id],
            c = concepts[id];
          return (
            <article key={id}>
              <h3>
                <a
                  href={`#/explore/${c.subject === "calculus" ? "calculus" : "linear"}/${id}`}
                >
                  {c.title}
                </a>
              </h3>
              <p>{s ? journeyStatus(s) : "Not started"}</p>
              {s && (
                <>
                  <p className="caption">
                    {s.attempts.length} recorded attempts · {s.snapshots.length}{" "}
                    saved experiments ·{" "}
                    {s.guideDismissed
                      ? "guide completed/skipped"
                      : "guide available"}
                  </p>
                  {s.reviewDueAt && (
                    <p className="caption">
                      Suggested review:{" "}
                      {new Date(s.reviewDueAt).toLocaleDateString()}. This is a
                      local date suggestion, not an automatic reminder.
                    </p>
                  )}
                  <ul>
                    {s.attempts
                      .slice(-3)
                      .reverse()
                      .map((a, i) => (
                        <li key={`${a.at}-${i}`}>
                          {a.activity} · seed {a.seed} · attempt{" "}
                          {a.attemptNumber} ·{" "}
                          {a.correct
                            ? "objective check passed"
                            : "revisit the rule"}{" "}
                          ·{" "}
                          {a.guided ? "guided" : "no hint before this attempt"}{" "}
                          · reasoning {a.reasoning}
                        </li>
                      ))}
                  </ul>
                  {s.snapshots.length > 0 && (
                    <details>
                      <summary>Saved experiment cards</summary>
                      {s.snapshots.map((snap, i) => (
                        <article key={`${snap.at}-${i}`}>
                          <p>
                            {new Date(snap.at).toLocaleString()} ·{" "}
                            {snap.dataVersion}
                          </p>
                          <p>
                            Parameters: {snap.state.values.join(", ")} ·{" "}
                            {snap.state.mode}
                          </p>
                          <p>Prediction: {snap.prediction || "not recorded"}</p>
                          <p>
                            Observation: {snap.observation || "not recorded"}
                          </p>
                          <p>Reflection: {snap.reflection || "not recorded"}</p>
                        </article>
                      ))}
                    </details>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
      <p>
        <a href="#/applications/builder">Open your project builder</a> · Backups
        include projects, attempts, and experiment cards.
      </p>
    </section>
  );
}
