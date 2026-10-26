import { useState } from "react";
import type { WorkedExample as Example } from "../content/concepts";
export function WorkedExample({ example }: { example: Example }) {
  const [index, setIndex] = useState(0);
  return (
    <section className="worked-example" aria-label="Worked numerical example">
      <h3>{example.title}</h3>
      <p>
        Worked step {index + 1} of {example.steps.length}
      </p>
      <p className="proof-statement">{example.steps[index]}</p>
      <div className="journey-actions">
        <button
          className="secondary"
          disabled={!index}
          onClick={() => setIndex(index - 1)}
        >
          Previous example step
        </button>
        <button
          className="secondary"
          disabled={index === example.steps.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          Next example step
        </button>
      </div>
    </section>
  );
}
