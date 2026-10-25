import { useId } from "react";
import { fmt } from "../math/linear";
export function Range({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="range-control">
      <div>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {fmt(value)}
          {unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function Prediction({
  value,
  onChange,
  question,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  question: string;
  options: string[];
}) {
  return (
    <fieldset className="prediction">
      <legend>
        <span className="step-badge">01</span> Predict first
      </legend>
      <p>{question}</p>
      <div className="choice-group">
        {options.map((o) => (
          <label className={value === o ? "selected" : ""} key={o}>
            <input
              type="radio"
              name={question}
              value={o}
              checked={value === o}
              onChange={() => onChange(o)}
            />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
