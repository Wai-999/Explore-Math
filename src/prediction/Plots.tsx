import type { Observation } from "./data";
import { classificationMetrics } from "./metrics";
export function LossPlot({ values }: { values: number[] }) {
  if (!values.length)
    return (
      <div className="plot-empty">
        Take a training step to draw the loss curve.
      </div>
    );
  const max = Math.max(...values, 1e-6),
    points = values
      .map(
        (v, i) =>
          `${55 + (i * 490) / Math.max(1, values.length - 1)},${205 - (v / max) * 155}`,
      )
      .join(" ");
  return (
    <svg
      viewBox="0 0 590 255"
      className="studio-plot"
      role="img"
      aria-label={`Training objective over the last ${values.length} steps; latest value ${values.at(-1)?.toFixed(5)}. This is training loss, not test performance.`}
    >
      <path d="M55 30V205H550" className="plot-axis" />
      <text x="55" y="20">
        Training objective (standardized)
      </text>
      <text x="205" y="244">
        Recent gradient steps →
      </text>
      <text x="5" y="54">
        {max.toFixed(2)}
      </text>
      <text x="30" y="209">
        0
      </text>
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
      />
    </svg>
  );
}
export function PredictionPlot({
  rows,
  predicted,
  classification,
  threshold = 0.3,
  radius = 0,
}: {
  rows: Observation[];
  predicted: number[];
  classification: boolean;
  threshold?: number;
  radius?: number;
}) {
  if (classification) {
    const m = classificationMetrics(
      rows.map((r) => r.y),
      predicted,
      threshold,
    );
    return (
      <svg
        viewBox="0 0 590 315"
        className="studio-plot"
        role="img"
        aria-label="Validation probability calibration. Dashed diagonal is perfect agreement. Circles show mean prediction and observed failure rate; labels give bin sample sizes. Small bins are uncertain."
      >
        <path d="M60 30V255H550" className="plot-axis" />
        <line x1="60" y1="255" x2="550" y2="30" className="plot-ideal" />
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <text x={60 + 490 * v} y="278">
              {v}
            </text>
            <text x="28" y={255 - 225 * v}>
              {v}
            </text>
          </g>
        ))}
        {m.bins
          .filter((b) => b.n)
          .map((b) => (
            <g key={b.low}>
              <circle
                cx={60 + b.mean! * 490}
                cy={255 - b.observed! * 225}
                r={5 + Math.sqrt(b.n)}
                fill="var(--accent)"
                fillOpacity=".5"
                stroke="var(--accent)"
              />
              <text x={70 + b.mean! * 490} y={245 - b.observed! * 225}>
                n={b.n}
              </text>
            </g>
          ))}
        <text x="200" y="305">
          Mean predicted probability
        </text>
        <text x="60" y="20">
          Observed failure fraction
        </text>
      </svg>
    );
  }
  const min = Math.min(...rows.map((r) => r.y), ...predicted) - radius,
    max = Math.max(...rows.map((r) => r.y), ...predicted) + radius;
  const x = (i: number) => 60 + (490 * i) / Math.max(1, rows.length - 1),
    y = (v: number) => 255 - (220 * (v - min)) / Math.max(1, max - min);
  const groups = [...new Set(rows.map((r) => r.entity))].map((entity) => ({
    entity,
    indices: rows
      .map((r, i) => (r.entity === entity ? i : -1))
      .filter((i) => i >= 0),
  }));
  return (
    <svg
      viewBox="0 0 590 315"
      className="studio-plot"
      role="img"
      aria-label="Validation rows in chronological/store order. Solid line is observed demand or energy; dashed line is the prediction. Shaded band is an empirical validation residual radius, without a future coverage guarantee."
    >
      <path d="M60 30V255H550" className="plot-axis" />
      {groups.map(({ entity, indices }) => (
        <g key={entity}>
          {radius > 0 && (
            <polygon
              points={[
                ...indices.map((i) => `${x(i)},${y(predicted[i] + radius)}`),
                ...indices
                  .map((i) => `${x(i)},${y(predicted[i] - radius)}`)
                  .reverse(),
              ].join(" ")}
              fill="var(--accent)"
              fillOpacity=".1"
            />
          )}
          <polyline
            points={indices.map((i) => `${x(i)},${y(rows[i].y)}`).join(" ")}
            fill="none"
            stroke="var(--text)"
            strokeWidth="2"
          />
          <polyline
            points={indices.map((i) => `${x(i)},${y(predicted[i])}`).join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeDasharray="7 4"
          />
          {groups.length > 1 && (
            <text
              x={x(indices[Math.floor(indices.length / 2)])}
              y="278"
              textAnchor="middle"
            >
              {entity}
            </text>
          )}
        </g>
      ))}
      <text x="5" y="40">
        {Math.round(max)}
      </text>
      <text x="5" y="255">
        {Math.round(min)}
      </text>
      <text x="70" y="20">
        Outcome (original units)
      </text>
      <text x="205" y="301">
        Ordered validation observations →
      </text>
      {groups.length === 1 && (
        <text x="65" y="278">
          Solid: observed · dashed: prediction
        </text>
      )}
    </svg>
  );
}
