import { Formula } from "../components/Formula";
import { useMemo, useState } from "react";
import {
  IDENTITY,
  fmt,
  linearModel,
  rotation,
  tuple,
  type Mat3,
} from "../math/linear";
import { gradeMatrix, satelliteChallenge } from "../assessment/challenges";
import { SceneFrame } from "../engine/SceneFrame";
import { Metric, Prediction, Range } from "../components/Controls";
import { Icon } from "../components/Icon";
import { useLearning } from "../app/LearningContext";
import { lessons } from "../content/lessons";
import { LessonExplanation } from "./Shared";
export default function LinearWorld() {
  const [matrix, setMatrix] = useState<Mat3>([1, 0.55, 0, 0, 1, 0, 0, 0, 1]),
    [angle, setAngle] = useState(0),
    [prediction, setPrediction] = useState(""),
    [numbers, setNumbers] = useState(false),
    [feedback, setFeedback] = useState(""),
    [seed, setSeed] = useState(42);
  const model = useMemo(() => linearModel(matrix), [matrix]),
    challenge = useMemo(() => satelliteChallenge(seed), [seed]);
  const { record } = useLearning();
  function reset() {
    setMatrix([...IDENTITY]);
    setAngle(0);
    setPrediction("");
    setFeedback("Start with a prediction, then change one basis arrow.");
  }
  function check() {
    if (!prediction) {
      setFeedback(
        "Make a prediction before checking your independent solution.",
      );
      return;
    }
    const pass =
      gradeMatrix(matrix, challenge.angle) && prediction === "Stays at 1";
    record(challenge.id, seed, pass);
    setFeedback(
      pass
        ? "Solved independently. The camera turns without stretching: det(A) = 1 and your matrix matches the target rotation."
        : "Keep experimenting. A pure rotation has determinant 1, perpendicular unit columns, and the requested angle. Volume alone is not enough.",
    );
  }
  return (
    <>
      <div className="world-heading">
        <div>
          <span className="eyebrow">WORLD 01 / LINEAR ALGEBRA</span>
          <h1>
            Transform space<span className="accent-dot">.</span>
          </h1>
          <p>
            Move a basis. Change a world. See the rules behind every
            transformation.
          </p>
        </div>
        <button className="secondary" onClick={reset}>
          <Icon name="RotateCcw" size={16} /> Reset experiment
        </button>
      </div>
      <div className="lab-layout">
        <section className="lab-main">
          <SceneFrame
            title="THE TRANSFORMATION STUDIO"
            scene={{ kind: "linear", matrix, onMatrix: setMatrix }}
          />
          <div className="metrics">
            <Metric
              label="Determinant"
              value={fmt(model.det)}
              detail="signed volume scale"
            />
            <Metric
              label="Orientation"
              value={model.orientation}
              detail={`rank ${model.rank} of 3`}
            />
            <Metric
              label="Point A(1, 1, 1)"
              value={tuple(model.point)}
              detail="transformed coordinates"
            />
          </div>
          <button
            className="text-button numbers-toggle"
            onClick={() => setNumbers(!numbers)}
          >
            <Icon name="Layers3" size={17} />
            {numbers ? "Hide numbers" : "View numbers & geometry"}
          </button>
          {numbers && (
            <div className="numbers-panel">
              <h3>Every vertex follows the same matrix</h3>
              <table>
                <caption>Basis coordinates and transformed test point</caption>
                <thead>
                  <tr>
                    <th>Vector</th>
                    <th>Original</th>
                    <th>After transformation</th>
                  </tr>
                </thead>
                <tbody>
                  {model.columns.map((c, i) => (
                    <tr key={i}>
                      <th>Basis b{i + 1}</th>
                      <td>{tuple(IDENTITY.slice(i * 3, i * 3 + 3))}</td>
                      <td>{tuple(c)}</td>
                    </tr>
                  ))}
                  <tr>
                    <th>Probe</th>
                    <td>(1, 1, 1)</td>
                    <td>{tuple(model.point)}</td>
                  </tr>
                </tbody>
              </table>
              <p>
                {model.inverse
                  ? "An inverse exists and can recover original coordinates."
                  : "No stable inverse is available: the determinant is zero or below a scale-relative 10⁻⁸ threshold."}
              </p>
              <p>
                Projection of b2 onto b1:{" "}
                {model.projection
                  ? tuple(model.projection)
                  : "undefined (b1 is zero)"}
                . Dot product: {fmt(model.dot)}. Cross product:{" "}
                {tuple(model.cross)}.
              </p>
              <p>
                {model.orthonormal
                  ? `Gram–Schmidt unit basis: ${tuple(model.orthonormal[0])}, ${tuple(model.orthonormal[1])}.`
                  : "The first two columns are dependent; a two-vector orthonormal basis cannot be formed."}
              </p>
              <p>
                Frobenius condition bound:{" "}
                {Number.isFinite(model.conditionBound)
                  ? fmt(model.conditionBound)
                  : "unbounded / singular"}
                . This is an upper bound, not the spectral condition number.
              </p>
              <p>
                {!model.eigen
                  ? "Real eigenpair inspection is limited to matrices with a separate invariant xy block."
                  : model.eigen.status === "complex"
                    ? "The xy block has complex eigenvalues. There are no real invariant arrows in that plane."
                    : `Real xy eigenpairs: ${model.eigen.pairs.map((p) => `λ = ${fmt(p.value)}, v = ${tuple(p.vector)}`).join("; ")}.`}
              </p>
              <p>
                Numerical nullity at the stated tolerance: {3 - model.rank}. A
                collapsed direction cannot be recovered.
              </p>
            </div>
          )}
          <LessonExplanation lesson={lessons.linear} />
        </section>
        <aside className="interact-panel">
          <div className="panel-title">
            <Icon name="SlidersHorizontal" size={18} />
            <h2>Your experiment</h2>
            <span>01</span>
          </div>
          <p className="control-intro">
            Each column is a basis arrow. Edit a number or drag an endpoint in
            the stage.
          </p>
          <div
            className="matrix-editor"
            role="group"
            aria-label="Transformation matrix"
          >
            <span className="matrix-bracket">[</span>
            <div className="matrix-cells">
              {matrix.map((v, i) => (
                <input
                  key={i}
                  type="number"
                  aria-label={`Matrix row ${Math.floor(i / 3) + 1} column ${(i % 3) + 1}`}
                  min="-3"
                  max="3"
                  step="0.05"
                  value={Number(v.toFixed(4))}
                  onChange={(e) => {
                    const x = Number(e.target.value);
                    if (!Number.isFinite(x) || x < -3 || x > 3) return;
                    const next = [...matrix] as Mat3;
                    next[i] = x;
                    setMatrix(next);
                  }}
                />
              ))}
            </div>
            <span className="matrix-bracket">]</span>
          </div>
          <div className="basis-key">
            <span>b1 / x</span>
            <span>b2 / y</span>
            <span>b3 / z</span>
          </div>
          <div className="preset-row">
            {[
              { label: "Identity", m: IDENTITY },
              { label: "Shear", m: [1, 0.7, 0, 0, 1, 0, 0, 0, 1] as Mat3 },
              { label: "Reflect", m: [-1, 0, 0, 0, 1, 0, 0, 0, 1] as Mat3 },
              { label: "Collapse", m: [1, 0, 0, 0, 1, 0, 0, 0, 0] as Mat3 },
            ].map((p) => (
              <button
                key={p.label}
                className="chip"
                onClick={() => setMatrix([...p.m])}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Range
            label="Rotate around z"
            unit="°"
            value={angle}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => {
              setAngle(v);
              setMatrix(rotation("z", v));
            }}
          />
          <div className="panel-note">
            <span className="tiny-dot" />{" "}
            {model.rank < 3
              ? "Numerically rank-deficient. A dimension is zero or tiny at this tolerance."
              : model.det < 0
                ? "Orientation flipped, like a mirror."
                : "The basis arrows define the transformed space."}
          </div>
          <Formula tex={"\\mathbf v_{new}=A\\mathbf v_{original}"} />
          <p className="caption">
            A is the matrix; v is a column vector. All coordinates are unitless.
          </p>
        </aside>
      </div>
      <section className="mission-panel">
        <div className="mission-intro">
          <span className="eyebrow">YOUR MISSION / INDEPENDENT CHALLENGE</span>
          <h2>Save the satellite orientation</h2>
          <p>
            Turn the camera <strong>{challenge.angle}° around z</strong>.
            Preserve its shape and volume. Match every matrix entry within
            0.025.
          </p>
          <button
            className="text-button"
            onClick={() => {
              setSeed((s) => s + 17);
              reset();
            }}
          >
            Try a new target <Icon name="ArrowRight" size={16} />
          </button>
        </div>
        <div className="mission-action">
          <Prediction
            value={prediction}
            onChange={setPrediction}
            question="What happens to the determinant during a pure rotation?"
            options={["Stays at 1", "Becomes 0", "Becomes negative"]}
          />
          <button className="primary" onClick={check}>
            Check my transformation <Icon name="ArrowUpRight" size={17} />
          </button>
          <p className="feedback" role="status">
            {feedback}
          </p>
        </div>
      </section>
    </>
  );
}
