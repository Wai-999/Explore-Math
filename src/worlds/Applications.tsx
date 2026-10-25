import { Formula } from "../components/Formula";
import { useMemo, useState } from "react";
import { applicationCards } from "../content/lessons";
import { Icon } from "../components/Icon";
import { SceneFrame } from "../engine/SceneFrame";
import { business, regression, robot } from "../math/applications";
import { fmt, tuple } from "../math/linear";
import { Metric, Prediction, Range } from "../components/Controls";
import { useLearning } from "../app/LearningContext";
export type ApplicationId = "robot" | "business" | "regression";
export function ApplicationIndex() {
  const [domain, setDomain] = useState("All domains"),
    [subject, setSubject] = useState("All subjects"),
    [difficulty, setDifficulty] = useState("All levels");
  const cards = applicationCards.filter(
    (c) =>
      (domain === "All domains" || c.category === domain) &&
      (subject === "All subjects" || c.subject === subject) &&
      (difficulty === "All levels" || c.difficulty === difficulty),
  );
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">MATHEMATICS, OUT IN THE WORLD</span>
        <h1>
          Ideas with a purpose<span className="accent-dot">.</span>
        </h1>
        <p>
          A camera, a small business, a dataset. Different questions. The same
          powerful ideas.
        </p>
      </div>
      <div className="filter-row">
        <label>
          Domain
          <select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {["All domains", "ENGINEERING", "BUSINESS", "DATA SCIENCE"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Subject
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {["All subjects", "Linear algebra", "Calculus"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            {["All levels", "Foundations", "Advanced"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="application-grid">
        {cards.map((c, i) => (
          <a
            className={"application-card card-" + c.id}
            key={c.id}
            href={"#/applications/" + c.id}
          >
            <div className="application-art">
              <Icon name={c.icon} size={72} />
              <span>0{i + 1}</span>
            </div>
            <div className="application-copy">
              <span className="eyebrow">{c.category}</span>
              <h2>{c.title}</h2>
              <p>{c.description}</p>
              <div>
                <span>{c.tag}</span>
                <Icon name="ArrowUpRight" size={20} />
              </div>
            </div>
          </a>
        ))}
      </div>
      {cards.length === 0 && (
        <p>No missions match these filters. Try another subject or level.</p>
      )}
      <p className="quiet-note">
        Three complete, local simulations. All data and models are illustrative.
      </p>
    </>
  );
}
export default function ApplicationMission({ id }: { id: ApplicationId }) {
  const [yaw, setYaw] = useState(0),
    [tilt, setTilt] = useState(0),
    [order, setOrder] = useState<"yaw-first" | "tilt-first">("yaw-first"),
    [q, setQ] = useState(30),
    [demand, setDemand] = useState(120),
    [slope, setSlope] = useState(0.5),
    [intercept, setIntercept] = useState(0),
    [prediction, setPrediction] = useState(""),
    [feedback, setFeedback] = useState(""),
    [revealed, setRevealed] = useState(false),
    [numbers, setNumbers] = useState(false);
  const rm = useMemo(() => robot(yaw, tilt, order), [yaw, tilt, order]),
    bm = useMemo(() => business(q, demand), [q, demand]),
    lm = useMemo(() => regression(slope, intercept), [slope, intercept]);
  const target = useMemo(() => robot(45, 60, "yaw-first"), []),
    { record } = useLearning(),
    card = applicationCards.find((c) => c.id === id)!;
  function reset() {
    setYaw(0);
    setTilt(0);
    setOrder("yaw-first");
    setQ(30);
    setSlope(0.5);
    setIntercept(0);
    setPrediction("");
    setFeedback("");
    setRevealed(false);
  }
  const options =
    id === "robot"
      ? ["Order changes the direction", "Order never matters"]
      : id === "business"
        ? ["Profit rises, then falls", "More output always wins"]
        : ["Minimize squared residuals", "Force every residual to zero"];
  function check() {
    if (!prediction) {
      setFeedback("Make a prediction first, then test your decision.");
      return;
    }
    const pass =
      id === "robot"
        ? Math.hypot(...rm.direction.map((v, i) => v - target.direction[i])) <
            0.025 && prediction === options[0]
        : id === "business"
          ? Math.abs(bm.marginal) < 0.81 && prediction === options[0]
          : lm.train < 0.03 && prediction === options[0];
    if (!revealed)
      record(
        `${id}-${id === "business" ? demand : 1}`,
        id === "business" ? demand : 1,
        pass,
      );
    setFeedback(
      pass
        ? revealed
          ? "Correct with worked guidance. Try the next example without opening the solution to record independent evidence."
          : "Solved independently. " +
            (id === "robot"
              ? "Your camera points along the requested direction."
              : id === "business"
                ? `At ${fmt(q)} units/day, marginal profit is ${fmt(bm.marginal)} $/unit, close to zero.`
                : "Your line minimizes training error to within the target tolerance. Evaluate it on held-out observations next.")
        : "Keep exploring. " +
            (id === "robot"
              ? "Try yaw 45°, then tilt 60°. Reversing the order leaves a different viewing direction."
              : id === "business"
                ? "The peak occurs where marginal revenue equals marginal cost. Aim for marginal profit near zero."
                : "Look for balanced residuals on both sides of the line. Aim for training MSE below 0.030 unit²."),
    );
  }
  return (
    <>
      <a href="#/applications" className="back-link">
        ← All applications
      </a>
      <div className="world-heading">
        <div>
          <span className="eyebrow">{card.category} / APPLIED MISSION</span>
          <h1>
            {card.title}
            <span className="accent-dot">.</span>
          </h1>
          <p>{card.description}</p>
        </div>
        <button className="secondary" onClick={reset}>
          <Icon name="RotateCcw" size={16} /> Reset mission
        </button>
      </div>
      <div className="lab-layout">
        <section className="lab-main">
          <SceneFrame
            title={
              id === "robot"
                ? "CAMERA COORDINATE FRAME"
                : id === "business"
                  ? "THE PROFIT CURVE"
                  : "THE FITTING STUDIO"
            }
            scene={
              id === "robot"
                ? { kind: "robot", matrix: rm.matrix }
                : id === "business"
                  ? { kind: "business", quantity: q, demand }
                  : { kind: "regression", slope, intercept }
            }
          />
          <div className="metrics">
            {id === "robot" ? (
              <>
                <Metric label="Camera direction" value={tuple(rm.direction)} />
                <Metric
                  label="Target direction"
                  value={tuple(target.direction)}
                />
                <Metric
                  label="Rotation order"
                  value={order === "yaw-first" ? "Rₓ Rz" : "Rz Rₓ"}
                  detail="rightmost operation first"
                />
              </>
            ) : id === "business" ? (
              <>
                <Metric label="Daily profit" value={"$" + fmt(bm.profit, 2)} />
                <Metric label="Unit price" value={"$" + fmt(bm.price, 2)} />
                <Metric
                  label="Marginal profit"
                  value={fmt(bm.marginal)}
                  detail="$ per extra unit"
                />
              </>
            ) : (
              <>
                <Metric
                  label="Training MSE"
                  value={fmt(lm.train, 4)}
                  detail="five synthetic observations · unit²"
                />
                <Metric
                  label="Evaluation MSE"
                  value={fmt(lm.test, 4)}
                  detail="three held-out observations · unit²"
                />
                <Metric
                  label="Model"
                  value={`y = ${fmt(slope)}x + ${fmt(intercept)}`}
                />
              </>
            )}
          </div>
          <button
            className="text-button numbers-toggle"
            onClick={() => setNumbers(!numbers)}
          >
            {numbers ? "Hide numbers" : "View numbers & model assumptions"}
          </button>
          {numbers && (
            <div className="numbers-panel">
              <h3>What the model assumes</h3>
              {id === "robot" ? (
                <>
                  <p>
                    Right-handed coordinate frame. Yaw rotates around the fixed
                    world z axis; tilt rotates around the fixed world x axis.
                    The camera initially looks along (1,0,0). Angles are in
                    degrees.
                  </p>
                  <p>
                    This is a camera orientation model, without joint limits,
                    obstacles, or inverse kinematics. The cube displays the
                    camera basis, not a physical robot arm.
                  </p>
                  <p>
                    Target: yaw 45°, then tilt 60°. All direction coordinates
                    are unitless.
                  </p>
                </>
              ) : id === "business" ? (
                <>
                  <p>
                    Demand: price p(q) = {demand} − 0.8q dollars/unit. Cost C(q)
                    = 100 + 20q dollars/day. Quantity q ∈ [0,100] units/day.
                    Every unit is assumed sold at the same price.
                  </p>
                  <table>
                    <caption>Daily model calculation</caption>
                    <tbody>
                      <tr>
                        <th>Revenue</th>
                        <td>${fmt(bm.revenue, 2)}/day</td>
                      </tr>
                      <tr>
                        <th>Cost</th>
                        <td>${fmt(bm.cost, 2)}/day</td>
                      </tr>
                      <tr>
                        <th>Profit</th>
                        <td>${fmt(bm.profit, 2)}/day</td>
                      </tr>
                    </tbody>
                  </table>
                  <p>
                    Demand is assumed known, continuous quantities are allowed,
                    and inventory, taxes, competition, and capacity changes are
                    ignored. This synthetic scenario is an educational model.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Synthetic unitless x and y observations. The model is y =
                    mx+b. Vertical dashed lines are observed y minus predicted
                    y. The displayed training points are distinct from held-out
                    evaluation points.
                  </p>
                  <table>
                    <caption>Training observations and residuals</caption>
                    <thead>
                      <tr>
                        <th>x</th>
                        <th>y</th>
                        <th>Prediction</th>
                        <th>Residual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lm.residuals.map((r) => (
                        <tr key={r.x}>
                          <td>{r.x}</td>
                          <td>{r.y}</td>
                          <td>{fmt(r.predicted)}</td>
                          <td>{fmt(r.residual)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    A low training loss does not establish causality or
                    guarantee performance on future data. The evaluation set is
                    small and synthetic.
                  </p>
                </>
              )}
            </div>
          )}
          <section className="lesson-explanation">
            <span className="eyebrow">TURN THE OBSERVATION INTO AN IDEA</span>
            <h2>
              {id === "robot"
                ? "The same turns. A different destination."
                : id === "business"
                  ? "More is only better up to a point."
                  : "A useful fit leaves room for noise."}
            </h2>
            <p>
              {id === "robot"
                ? "Each rotation acts on the result of the previous one. The second turn changes a different direction when you swap the order. This is why graphics engines and robot coordinate frames must agree on conventions."
                : id === "business"
                  ? "Profit rises when an extra unit earns more than it costs. As demand pushes the price down, that benefit shrinks. At an interior maximum, marginal profit is zero; the negative second derivative confirms a peak."
                  : "Least squares finds the line with the smallest sum of squared vertical errors. Squaring makes large errors count more and prevents positive and negative errors from cancelling. An unseen evaluation set checks a different question: does the pattern extend?"}
            </p>
            <details
              onToggle={(e) => {
                if (e.currentTarget.open) setRevealed(true);
              }}
            >
              <summary>Worked explanation & transfer task</summary>
              <p>
                {id === "robot"
                  ? "Rₓ(60°)Rz(45°)(1,0,0) = (√2/2, √2/4, √6/4). In reverse order, Rz(45°)Rₓ(60°)(1,0,0) = (√2/2, √2/2, 0). Transfer: predict what happens when both turns are 90°."
                  : id === "business"
                    ? `π(q) = (${demand}−20)q − 0.8q² − 100. Setting π′ = ${demand}−20−1.6q = 0 gives q = ${fmt(bm.optimum)} units/day. π″ = −1.6 < 0. Transfer: select a new demand scenario and find the new optimum without opening this explanation.`
                    : `Center the data, project y onto x, then recover the intercept: m = Σ(x−x̄)(y−ȳ)/Σ(x−x̄)² = ${fmt(lm.fit.slope)}, b = ȳ−mx̄ = ${fmt(lm.fit.intercept)}. Transfer: why would fitting through the origin increase error here?`}
              </p>
              <p>
                Opening this worked answer makes this attempt guided; it will
                not count as independent evidence.
              </p>
            </details>
          </section>
        </section>
        <aside className="interact-panel">
          <div className="panel-title">
            <Icon name="SlidersHorizontal" size={18} />
            <h2>Your decision</h2>
            <span>03</span>
          </div>
          {id === "robot" ? (
            <>
              <Range
                label="Yaw around world z"
                value={yaw}
                min={-180}
                max={180}
                step={1}
                unit="°"
                onChange={setYaw}
              />
              <Range
                label="Tilt around world x"
                value={tilt}
                min={-180}
                max={180}
                step={1}
                unit="°"
                onChange={setTilt}
              />
              <label className="select-label" htmlFor="order">
                Apply rotations
              </label>
              <select
                id="order"
                value={order}
                onChange={(e) => setOrder(e.target.value as typeof order)}
              >
                <option value="yaw-first">Yaw, then tilt</option>
                <option value="tilt-first">Tilt, then yaw</option>
              </select>
              <Formula tex={"\\mathbf d=R_x(\\theta)R_z(\\psi)\\mathbf e_x"} />
              <p className="caption">
                Formula shown for yaw, then tilt. θ is tilt; ψ is yaw. Match the
                target direction within Euclidean distance 0.025.
              </p>
            </>
          ) : id === "business" ? (
            <>
              <Range
                label="Daily production"
                value={q}
                min={0}
                max={100}
                step={0.5}
                unit=" units"
                onChange={setQ}
              />
              <label className="select-label" htmlFor="demand">
                Demand scenario
              </label>
              <select
                id="demand"
                value={demand}
                onChange={(e) => {
                  setDemand(Number(e.target.value));
                  reset();
                }}
              >
                <option value="120">Scenario A · p = 120 − 0.8q</option>
                <option value="100">Scenario B · p = 100 − 0.8q</option>
                <option value="140">Scenario C · p = 140 − 0.8q</option>
              </select>
              <Formula tex={"\\pi(q)=q(p(q)-20)-100"} />
              <p className="caption">
                Aim for marginal profit within ±0.8 $/unit of zero. Maximum
                capacity: 100 units/day. All money uses illustrative dollars.
              </p>
            </>
          ) : (
            <>
              <Range
                label="Slope m"
                value={slope}
                min={-1}
                max={3}
                step={0.02}
                onChange={setSlope}
              />
              <Range
                label="Intercept b"
                value={intercept}
                min={-2}
                max={3}
                step={0.02}
                onChange={setIntercept}
              />
              <Formula tex={"\\mathrm{MSE}=\\frac1n\\sum_i(y_i-mx_i-b)^2"} />
              <p className="caption">
                Find a training MSE below 0.030 unit². n = 5 training
                observations. Hold out the other three observations from
                fitting.
              </p>
            </>
          )}
          <div className="panel-note">
            <Icon name="FlaskConical" size={17} /> Synthetic model · no external
            data
          </div>
        </aside>
      </div>
      <section className="mission-panel">
        <div className="mission-intro">
          <span className="eyebrow">APPLY / INDEPENDENT CHALLENGE</span>
          <h2>
            {id === "robot"
              ? "Point the camera"
              : id === "business"
                ? "Choose tomorrow’s output"
                : "Find the least-squares line"}
          </h2>
          <p>
            {id === "robot"
              ? "Match the direction produced by yaw 45°, then tilt 60°. Swap the order to test your prediction."
              : id === "business"
                ? "Find the daily production that maximizes profit, within the stated capacity. Then try a new demand scenario."
                : "Tune the two coefficients to minimize training error. Then compare the separate evaluation error."}
          </p>
        </div>
        <div className="mission-action">
          <Prediction
            value={prediction}
            onChange={setPrediction}
            question={
              id === "robot"
                ? "What if we swap the two rotations?"
                : id === "business"
                  ? "As production increases, what do you predict?"
                  : "What should a least-squares model do?"
            }
            options={options}
          />
          <button className="primary" onClick={check}>
            Test my decision <Icon name="ArrowUpRight" size={17} />
          </button>
          <p role="status" className="feedback">
            {feedback}
          </p>
        </div>
      </section>
    </>
  );
}
