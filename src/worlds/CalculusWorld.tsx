import { Formula } from "../components/Formula";
import { useMemo, useState } from "react";
import {
  calculusModel,
  descent,
  energy,
  derivative,
  secant,
  integrate,
  type Point2,
  type Rule,
  type SurfaceKind,
} from "../math/calculus";
import { fmt, tuple } from "../math/linear";
import { SceneFrame } from "../engine/SceneFrame";
import { CurveView } from "../engine/GeometryView";
import { Metric, Prediction, Range } from "../components/Controls";
import { Icon } from "../components/Icon";
import { useLearning } from "../app/LearningContext";
import { LessonExplanation } from "./Shared";
import { lessons } from "../content/lessons";
export default function CalculusWorld() {
  const [mode, setMode] = useState<"surface" | "curve">("surface"),
    [surface, setSurface] = useState<SurfaceKind>("bowl"),
    [point, setPoint] = useState<Point2>([1.6, 1.1]),
    [path, setPath] = useState<Point2[]>([[1.6, 1.1]]),
    [step, setStep] = useState(0.25),
    [prediction, setPrediction] = useState(""),
    [feedback, setFeedback] = useState(""),
    [steps, setSteps] = useState(0),
    [n, setN] = useState(8),
    [rule, setRule] = useState<Rule>("midpoint"),
    [x, setX] = useState(1),
    [h, setH] = useState(0.5),
    [numbers, setNumbers] = useState(false);
  const model = useMemo(() => calculusModel(surface, point), [surface, point]),
    approx = useMemo(() => integrate(0, 2, n, rule), [n, rule]);
  const { record } = useLearning();
  function reset(kind: SurfaceKind = surface) {
    setSurface(kind);
    setPoint([1.6, 1.1]);
    setPath([[1.6, 1.1]]);
    setSteps(0);
    setPrediction("");
    setFeedback("Predict the direction, then take one descent step.");
    setX(1);
    setH(0.5);
    setN(8);
  }
  function move(p: Point2) {
    setPoint(p);
    setPath([p]);
    setSteps(0);
  }
  function takeStep() {
    const next = descent(surface, point, step);
    if (next.status === "boundary") {
      setFeedback(
        "Step rejected: it leaves the displayed domain [−2.5, 2.5]². Lower the step size; no value was silently clamped.",
      );
      return;
    }
    setPoint(next.point);
    setPath((p) => [...p.slice(-99), next.point]);
    setSteps((s) => s + 1);
    setFeedback(
      next.after < next.before
        ? `Energy fell from ${fmt(next.before)} to ${fmt(next.after)}. The negative gradient led downhill.`
        : next.after > next.before
          ? "Energy increased. This step overshot; try a smaller learning rate."
          : "No change: the gradient is zero or too small at this precision.",
    );
  }
  function check() {
    const pass =
      surface === "bowl" &&
      energy(surface, point) < 0.01 &&
      steps >= 3 &&
      energy(surface, path[0]) >= 0.5 &&
      prediction === "Opposite the gradient";
    record("energy-bowl", 1, pass);
    setFeedback(
      pass
        ? "Solved independently. You reached E < 0.01 in at least three steps. Now test a different starting point in the two-valley landscape."
        : "Reach E < 0.01 on the bowl using at least three descent steps, and predict the descent direction. Move both coordinates to choose a new starting point.",
    );
  }
  return (
    <>
      <div className="world-heading">
        <div>
          <span className="eyebrow">WORLD 02 / CALCULUS</span>
          <h1>
            Touch change<span className="accent-dot">.</span>
          </h1>
          <p>
            Follow a slope. Find a minimum. Discover how tiny changes add up.
          </p>
        </div>
        <button className="secondary" onClick={() => reset()}>
          <Icon name="RotateCcw" size={16} /> Reset experiment
        </button>
      </div>
      <div className="segmented mode-switch">
        <button
          className={mode === "surface" ? "active" : ""}
          onClick={() => setMode("surface")}
        >
          Energy landscape
        </button>
        <button
          className={mode === "curve" ? "active" : ""}
          onClick={() => setMode("curve")}
        >
          Slope & accumulation
        </button>
      </div>
      <div className="lab-layout">
        <section className="lab-main">
          {mode === "surface" ? (
            <>
              <SceneFrame
                title="THE ENERGY LANDSCAPE"
                scene={{ kind: "calculus", surface, point, path }}
              />
              <div className="metrics">
                <Metric
                  label="Energy E(x, y)"
                  value={fmt(model.value)}
                  detail="unitless model"
                />
                <Metric
                  label="Gradient ∇E"
                  value={tuple(model.gradient)}
                  detail="direction of steepest ascent"
                />
                <Metric
                  label="Finite-step error"
                  value={model.error.toExponential(2)}
                  detail="central difference · h = 0.001"
                />
              </div>
            </>
          ) : (
            <>
              <div className="scene-frame curve-stage">
                <div className="scene-topline">
                  <span>
                    <i /> CHANGE & ACCUMULATION
                  </span>
                  <span className="scene-live">LIVE MODEL</span>
                </div>
                <CurveView x={x} h={h} n={n} rule={rule} />
                <div className="scene-bottomline">
                  <span>Green: x² · teal: secant · purple: tangent</span>
                </div>
              </div>
              <div className="metrics">
                <Metric label="Exact slope 2x" value={fmt(derivative(x))} />
                <Metric
                  label="Secant slope"
                  value={fmt(secant(x, h))}
                  detail={`error ${fmt(Math.abs(secant(x, h) - derivative(x)))}`}
                />
                <Metric
                  label="Integral estimate"
                  value={fmt(approx)}
                  detail={`exact 8/3 · error ${fmt(Math.abs(approx - 8 / 3))}`}
                />
              </div>
            </>
          )}
          <button
            className="text-button numbers-toggle"
            onClick={() => setNumbers(!numbers)}
          >
            {numbers ? "Hide numbers" : "View numbers & geometry"}
          </button>
          {numbers && (
            <div className="numbers-panel">
              <h3>Compare calculations</h3>
              {mode === "surface" ? (
                <>
                  <table>
                    <caption>
                      Gradient components, same state as the particle
                    </caption>
                    <thead>
                      <tr>
                        <th>Coordinate</th>
                        <th>Analytic</th>
                        <th>Central difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["x", "y"].map((a, i) => (
                        <tr key={a}>
                          <th>
                            {a} = {fmt(point[i])}
                          </th>
                          <td>{fmt(model.gradient[i], 6)}</td>
                          <td>{fmt(model.numeric[i], 6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    Domain: x,y ∈ [−2.5, 2.5]. No height clipping. Surface
                    resolution: 40 × 40 cells. Derivatives use the analytic
                    surface, not the tessellation.
                  </p>
                  <p>
                    The last 100 path points are drawn. Descent steps taken:{" "}
                    {steps}. Arrow is −0.4∇E in the parameter plane. Purple
                    patch: tangent plane at the particle.
                  </p>
                </>
              ) : (
                <p>
                  Signed integral ∫₀² x² dx = 8/3. {rule} rule, n = {n}, width
                  Δx = {fmt(2 / n)}. Estimate = {fmt(approx, 6)}. The integral
                  is positive here because x² ≥ 0 and the bounds increase.
                </p>
              )}
            </div>
          )}
          <LessonExplanation lesson={lessons.calculus} />
        </section>
        <aside className="interact-panel">
          <div className="panel-title">
            <Icon name="SlidersHorizontal" size={18} />
            <h2>Your experiment</h2>
            <span>02</span>
          </div>
          {mode === "surface" ? (
            <>
              <label className="select-label" htmlFor="surface">
                Choose a landscape
              </label>
              <select
                id="surface"
                value={surface}
                onChange={(e) => reset(e.target.value as SurfaceKind)}
              >
                <option value="bowl">Convex bowl · one minimum</option>
                <option value="valleys">Two valleys · two minima</option>
              </select>
              <Range
                label="Particle x"
                value={point[0]}
                min={-2.5}
                max={2.5}
                step={0.05}
                onChange={(v) => move([v, point[1]])}
              />
              <Range
                label="Particle y"
                value={point[1]}
                min={-2.5}
                max={2.5}
                step={0.05}
                onChange={(v) => move([point[0], v])}
              />
              <Range
                label="Learning rate α"
                value={step}
                min={0.05}
                max={1.2}
                step={0.05}
                onChange={setStep}
              />
              <button className="primary full" onClick={takeStep}>
                Take a descent step <Icon name="ArrowDown" size={17} />
              </button>
              <Formula
                tex={
                  surface === "bowl"
                    ? "E(x,y)=\\frac{x^2+2y^2}{2}"
                    : "E(x,y)=\\frac{(x^2-1)^2}{4}+\\frac{y^2}{2}"
                }
              />
              <Formula tex={"\\mathbf p_{next}=\\mathbf p-\\alpha\\nabla E"} />
              <p className="caption">
                All variables are unitless. For this bowl, 0 &lt; α &lt; 1
                guarantees convergence. Large steps can overshoot.
              </p>
            </>
          ) : (
            <>
              <Range
                label="Point x"
                value={x}
                min={0}
                max={2}
                step={0.05}
                onChange={setX}
              />
              <Range
                label="Secant gap h"
                value={h}
                min={0.01}
                max={1}
                step={0.01}
                onChange={setH}
              />
              <Range
                label="Integration intervals"
                value={n}
                min={2}
                max={64}
                step={1}
                onChange={setN}
              />
              <label className="select-label" htmlFor="rule">
                Approximation rule
              </label>
              <select
                id="rule"
                value={rule}
                onChange={(e) => setRule(e.target.value as Rule)}
              >
                {["left", "right", "midpoint", "trapezoid"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <Formula tex={"f(x)=x^2,\\quad f'(x)=2x"} />
              <Formula tex={"\\int_0^2 x^2\\,dx=\\frac83"} />
              <p className="caption">
                The secant uses [x, x+h]. Its slope is 2x+h, so its error tends
                to zero as h → 0. Shaded pieces approximate accumulation over
                [0,2].
              </p>
            </>
          )}
        </aside>
      </div>
      <section className="mission-panel">
        <div className="mission-intro">
          <span className="eyebrow">YOUR MISSION / INDEPENDENT CHALLENGE</span>
          <h2>Find the lowest energy route</h2>
          <p>
            On the convex bowl, reach <strong>E &lt; 0.01</strong> using at
            least three descent steps. Then compare the two-valley landscape
            from x &gt; 0 and x &lt; 0.
          </p>
          <details>
            <summary>Worked example & transfer</summary>
            <p>
              From (1,1) on the bowl, ∇E = (1,2). With α = 0.25, the next point
              is (0.75,0.5), and energy falls from 1.5 to 0.53125. Try starting
              at (−1.5, 1) without copying this point.
            </p>
            <p>
              Two valleys lead to different minima because their basins differ.
              Starting exactly at the saddle (0,0) produces no motion even
              though lower points exist.
            </p>
          </details>
        </div>
        <div className="mission-action">
          <Prediction
            value={prediction}
            onChange={setPrediction}
            question="Which direction should a small downhill step follow?"
            options={[
              "Opposite the gradient",
              "Along the gradient",
              "Always toward x = 0",
            ]}
          />
          <button className="primary" onClick={check}>
            Check my route <Icon name="ArrowUpRight" size={17} />
          </button>
          <p role="status" className="feedback">
            {feedback}
          </p>
        </div>
      </section>
    </>
  );
}
