import { useId, useRef, useState, type PointerEvent } from "react";
import {
  vectorModel,
  slopeModel,
  functionValue,
  type SemanticState,
} from "./model";
import "../styles/journey-scenes.css";

type SceneInput = {
  state: SemanticState;
  onChange: (state: SemanticState) => void;
  highlight?: string;
};
type Point = readonly [number, number];
type View = { cx: number; cy: number; scale: number };
const W = 720,
  H = 440,
  PAD = 58;
const number = (n: number) =>
  n === 0
    ? "0"
    : Math.abs(n) < 0.001
      ? n.toExponential(1)
      : String(Number(n.toFixed(3)));
const pair = (p: readonly number[]) => `(${number(p[0])}, ${number(p[1])})`;
const screen = (v: View, p: Point): Point => [
  W / 2 + (p[0] - v.cx) * v.scale,
  H / 2 - (p[1] - v.cy) * v.scale,
];
function world(
  svg: SVGSVGElement,
  event: PointerEvent<SVGSVGElement>,
  view: View,
): Point | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(matrix.inverse());
  return [
    view.cx + (local.x - W / 2) / view.scale,
    view.cy - (local.y - H / 2) / view.scale,
  ];
}
function fit(points: Point[]): View {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(0, ...xs),
    maxX = Math.max(0, ...xs),
    minY = Math.min(0, ...ys),
    maxY = Math.max(0, ...ys);
  const spanX = Math.max(2, maxX - minX),
    spanY = Math.max(2, maxY - minY),
    margin = Math.max(0.6, Math.max(spanX, spanY) * 0.12);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    scale: Math.min(
      (W - 2 * PAD) / (spanX + 2 * margin),
      (H - 2 * PAD) / (spanY + 2 * margin),
    ),
  };
}
function tickStep(rough: number) {
  const magnitude = 10 ** Math.floor(Math.log10(rough)),
    fraction = rough / magnitude;
  return (
    (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude
  );
}
function Grid({ view, unit = "" }: { view: View; unit?: string }) {
  const step = tickStep(65 / view.scale),
    left = view.cx - (W / 2 - PAD) / view.scale,
    right = view.cx + (W / 2 - PAD) / view.scale,
    bottom = view.cy - (H / 2 - PAD) / view.scale,
    top = view.cy + (H / 2 - PAD) / view.scale;
  const xs = Array.from(
    { length: Math.floor(right / step) - Math.ceil(left / step) + 1 },
    (_, i) => (Math.ceil(left / step) + i) * step,
  );
  const ys = Array.from(
    { length: Math.floor(top / step) - Math.ceil(bottom / step) + 1 },
    (_, i) => (Math.ceil(bottom / step) + i) * step,
  );
  const origin = screen(view, [0, 0]);
  return (
    <g className="journey-grid" aria-hidden="true">
      {xs.map((x) => (
        <g key={`x${x}`}>
          <line
            x1={screen(view, [x, 0])[0]}
            y1={PAD}
            x2={screen(view, [x, 0])[0]}
            y2={H - PAD}
          />
          <text
            x={screen(view, [x, 0])[0]}
            y={H - PAD + 22}
            textAnchor="middle"
          >
            {number(x)}
          </text>
        </g>
      ))}
      {ys.map((y) => (
        <g key={`y${y}`}>
          <line
            x1={PAD}
            y1={screen(view, [0, y])[1]}
            x2={W - PAD}
            y2={screen(view, [0, y])[1]}
          />
          <text x={PAD - 12} y={screen(view, [0, y])[1] + 4} textAnchor="end">
            {number(y)}
          </text>
        </g>
      ))}
      <line
        className="journey-axis"
        x1={PAD}
        y1={origin[1]}
        x2={W - PAD}
        y2={origin[1]}
      />
      <line
        className="journey-axis"
        x1={origin[0]}
        y1={PAD}
        x2={origin[0]}
        y2={H - PAD}
      />
      <text x={W - PAD} y={H - PAD + 43} textAnchor="end">
        x{unit && ` (${unit})`}
      </text>
      <text x={PAD} y={PAD - 19}>
        y{unit && ` (${unit})`}
      </text>
    </g>
  );
}
function Arrow({
  from,
  to,
  view,
  kind,
  id,
  label,
  labelOffset = [7, -9],
  active = false,
}: {
  from: Point;
  to: Point;
  view: View;
  kind: string;
  id: string;
  label?: string;
  labelOffset?: Point;
  active?: boolean;
}) {
  const a = screen(view, from),
    b = screen(view, to),
    dx = b[0] - a[0],
    dy = b[1] - a[1];
  return (
    <g className={`journey-vector ${kind}`} data-active={active || undefined}>
      <line
        x1={a[0]}
        y1={a[1]}
        x2={b[0]}
        y2={b[1]}
        markerEnd={Math.hypot(dx, dy) > 0.001 ? `url(#${id})` : undefined}
      />
      {label && (
        <text
          x={(a[0] + b[0]) / 2 + labelOffset[0]}
          y={(a[1] + b[1]) / 2 + labelOffset[1]}
          textAnchor={labelOffset[0] < 0 ? "end" : "start"}
        >
          {label}
        </text>
      )}
    </g>
  );
}
function Marker({ id, kind }: { id: string; kind: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path className={kind} d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
  );
}
function PointLabel({
  at,
  view,
  children,
}: {
  at: Point;
  view: View;
  children: string;
}) {
  const [x, y] = screen(view, at),
    right = x > W / 2;
  return (
    <text
      className="journey-point-label"
      x={x + (right ? -10 : 10)}
      y={y + 20}
      textAnchor={right ? "end" : "start"}
    >
      {children}
    </text>
  );
}
function isActive(highlight: string | undefined, ...names: string[]) {
  return (
    !!highlight &&
    names.some((name) =>
      highlight
        .toLowerCase()
        .split(/[^a-z-]+/)
        .includes(name),
    )
  );
}

export function VectorScene({ state, onChange, highlight }: SceneInput) {
  const model = vectorModel(state.values),
    projection = state.mode === "projection",
    prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const p: Point = [model.p[0], model.p[1]],
    u: Point = [model.u[0], model.u[1]],
    w: Point = [model.w[0], model.w[1]],
    target: Point = [model.target[0], model.target[1]],
    landing: Point = [model.landing[0], model.landing[1]],
    control: Point = [p[0] + u[0], p[1] + u[1]],
    projected: Point | null = model.projected
      ? [model.projected[0], model.projected[1]]
      : null;
  const zeroDirection = w[0] === 0 && w[1] === 0;
  const points = projection
    ? [[0, 0] as Point, u, w, ...(projected ? [projected] : [])]
    : [p, control, landing, target];
  const natural = fit(points),
    [frozenView, setFrozenView] = useState<View | null>(null),
    view = frozenView || natural;
  const drag = useRef<{ kind: "control" | "wind"; view: View } | null>(null),
    [notice, setNotice] = useState("");
  function start(
    event: PointerEvent<SVGCircleElement>,
    kind: "control" | "wind",
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = { kind, view };
    setFrozenView(view);
    setNotice("");
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current) return;
    const next = world(event.currentTarget, event, current.view);
    if (!next) return;
    const origin: Point = projection
      ? [0, 0]
      : current.kind === "control"
        ? p
        : control;
    const value: Point = [next[0] - origin[0], next[1] - origin[1]];
    if (value.some((n) => !Number.isFinite(n) || Math.abs(n) > 10)) {
      setNotice(
        "Move rejected: each control and wind component must stay between −10 and 10 m. No value was clamped.",
      );
      return;
    }
    const values = [...state.values],
      index = current.kind === "control" ? 2 : 4;
    values[index] = value[0];
    values[index + 1] = value[1];
    onChange({ ...state, values });
    setNotice("");
  }
  function finish() {
    drag.current = null;
    setFrozenView(null);
  }
  const controlTip = projection ? u : control,
    windTip = projection ? w : landing,
    ct = screen(view, controlTip),
    wt = screen(view, windTip);
  const aId = `${prefix}-u`,
    bId = `${prefix}-w`,
    rId = `${prefix}-r`;
  const totalId = `${prefix}-total`;
  return (
    <figure className="journey-scene vector-scene" data-highlight={highlight}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${prefix}-title ${prefix}-desc`}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
      >
        <title id={`${prefix}-title`}>
          {projection
            ? "Vector projection and orthogonal residual"
            : "Drone vector addition with wind"}
        </title>
        <desc id={`${prefix}-desc`}>
          {projection
            ? `a=${pair(u)} m, b=${pair(w)} m. ${projected ? `Projection is ${pair(projected)} m; the residual is perpendicular to b.` : zeroDirection ? "Projection is undefined because b is zero." : "The nonzero direction is below the numerical tolerance. Its mathematical projection exists, but this model declines to compute it."}`
            : `Start P=${pair(p)} m. Control u=${pair(u)} m, wind w=${pair(w)} m. Tip-to-tail landing=${pair(landing)} m; target=${pair(target)} m. Landing error ${number(model.error)} m.`}{" "}
          Equal horizontal and vertical scales preserve angles. Drag the control
          or wind tip; equivalent labeled coordinate inputs follow the scene. If
          tips overlap, use those numeric inputs.
        </desc>
        <defs>
          <Marker id={aId} kind="vector-u" />
          <Marker id={bId} kind="vector-w" />
          <Marker id={rId} kind="vector-residual" />
          <Marker id={totalId} kind="vector-total" />
        </defs>
        <Grid view={view} unit="m" />
        {projection ? (
          <>
            <Arrow
              from={[0, 0]}
              to={w}
              view={view}
              kind="vector-w"
              id={bId}
              label="b = w"
              active={isActive(highlight, "w", "direction", "projection")}
            />
            {projected && (
              <>
                <Arrow
                  from={[0, 0]}
                  to={projected}
                  view={view}
                  kind="vector-projection"
                  id={aId}
                  label="p = projᵦ(a)"
                  labelOffset={[-10, 24]}
                  active={isActive(highlight, "projection", "projected")}
                />
                <Arrow
                  from={projected}
                  to={u}
                  view={view}
                  kind="vector-residual"
                  id={rId}
                  label="a − p"
                  labelOffset={[9, 20]}
                  active={isActive(highlight, "residual", "orthogonality")}
                />
              </>
            )}
            <Arrow
              from={[0, 0]}
              to={u}
              view={view}
              kind="vector-u"
              id={aId}
              label="a = u"
              active={isActive(highlight, "u", "components")}
            />
            <PointLabel at={[0, 0]} view={view}>
              O
            </PointLabel>
          </>
        ) : (
          <>
            <Arrow
              from={p}
              to={landing}
              view={view}
              kind="vector-total"
              id={totalId}
              label="u + w"
              active={isActive(highlight, "sum", "landing", "addition")}
            />
            <Arrow
              from={p}
              to={control}
              view={view}
              kind="vector-u"
              id={aId}
              label="u"
              active={isActive(highlight, "u", "control", "components")}
            />
            <Arrow
              from={control}
              to={landing}
              view={view}
              kind="vector-w"
              id={bId}
              label="w"
              active={isActive(highlight, "wind", "w")}
            />
            <circle
              className="journey-start"
              cx={screen(view, p)[0]}
              cy={screen(view, p)[1]}
              r="4"
            />
            <circle
              className="journey-target"
              cx={screen(view, target)[0]}
              cy={screen(view, target)[1]}
              r={0.05 * view.scale}
            />
            <path
              className="journey-target-cross"
              d={`M${screen(view, target)[0] - 8},${screen(view, target)[1]}h16 M${screen(view, target)[0]},${screen(view, target)[1] - 8}v16`}
            />
            <PointLabel at={p} view={view}>
              P
            </PointLabel>
            <PointLabel at={target} view={view}>
              target
            </PointLabel>
            <PointLabel at={control} view={view}>
              P + u
            </PointLabel>
            <PointLabel at={landing} view={view}>
              landing
            </PointLabel>
          </>
        )}
        <circle
          className="journey-handle-visual vector-u"
          cx={ct[0]}
          cy={ct[1]}
          r="6"
        />
        <circle
          className="journey-handle-hit"
          data-testid="journey-control-tip"
          cx={ct[0]}
          cy={ct[1]}
          r="9"
          vectorEffect="non-scaling-stroke"
          onPointerDown={(e) => start(e, "control")}
        >
          <title>
            Drag control vector; numeric coordinates below provide an
            alternative
          </title>
        </circle>
        <circle
          className="journey-handle-visual vector-w"
          cx={wt[0]}
          cy={wt[1]}
          r="6"
        />
        <circle
          className="journey-handle-hit"
          data-testid="journey-wind-tip"
          cx={wt[0]}
          cy={wt[1]}
          r="9"
          vectorEffect="non-scaling-stroke"
          onPointerDown={(e) => start(e, "wind")}
        >
          <title>
            Drag wind vector; numeric coordinates below provide an alternative
          </title>
        </circle>
      </svg>
      <figcaption>
        {projection
          ? projected
            ? `p=${pair(projected)} m. Residual·b=${number(model.orthogonality ?? 0)} m² (zero up to floating-point rounding). The projection requires b·b≥10⁻¹² m².`
            : zeroDirection
              ? "Projection undefined: b=0 would divide by b·b=0. Choose a nonzero direction."
              : "Projection not computed: 0<b·b<10⁻¹² m². It exists mathematically, but this direction is below the model's numerical tolerance."
          : `P + u + w = ${pair(landing)} m. The target-zone radius is exactly 0.05 m; its crosshair only marks the center. This is displacement addition, not a full drone-dynamics simulation.`}
      </figcaption>
      <p className="journey-scene-status" role="status">
        {notice ||
          (frozenView
            ? "Drag in progress; release to refit the view. Coordinate fields provide the same controls."
            : "Drag a control or wind tip, or use the labeled coordinate inputs. The view fits the actual coordinates.")}
      </p>
    </figure>
  );
}

export function DerivativeScene({
  state,
  onChange,
  highlight,
  showBands = false,
}: SceneInput & { showBands?: boolean }) {
  const model = slopeModel(state),
    prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const xMin = -3,
    xMax = 3,
    plotW = W - 2 * PAD,
    plotH = H - 2 * PAD;
  const yMin =
      state.mode === "square" ? -0.8 : state.mode === "jump" ? -1.65 : -0.6,
    yMax = state.mode === "square" ? 9.8 : state.mode === "jump" ? 1.65 : 3.6;
  const px = (x: number) => PAD + ((x - xMin) / (xMax - xMin)) * plotW,
    py = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin)) * plotH;
  const [notice, setNotice] = useState(""),
    drag = useRef(false);
  function start(event: PointerEvent<SVGCircleElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = true;
    setNotice("");
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = event.currentTarget.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse()),
      t = xMin + ((local.x - PAD) / plotW) * (xMax - xMin),
      h = t - model.x;
    if (!Number.isFinite(h) || Math.abs(h) > 1) {
      setNotice(
        "Move rejected: the secant gap h must stay between −1 and 1. No value was clamped.",
      );
      return;
    }
    onChange({ ...state, values: [model.x, h, model.epsilon] });
    setNotice("");
  }
  function finish() {
    drag.current = false;
  }
  const samples = (a: number, b: number, count = 100) =>
    Array.from({ length: count + 1 }, (_, i) => {
      const t = a + ((b - a) * i) / count;
      return `${px(t)},${py(functionValue(state.mode, t))}`;
    }).join(" ");
  const delta = model.delta ?? 0;
  const left = px(model.x - delta),
    right = px(model.x + delta),
    upper = py(model.y + model.epsilon),
    lower = py(model.y - model.epsilon);
  let tangentLeft = Math.max(xMin, model.x - 0.7),
    tangentRight = Math.min(xMax, model.x + 0.7);
  if (state.mode !== "square" && model.x < 0)
    tangentRight = Math.min(tangentRight, -0.00001);
  if (state.mode !== "square" && model.x > 0)
    tangentLeft = Math.max(tangentLeft, 0.00001);
  const yStep = tickStep((yMax - yMin) / 5),
    yTicks = Array.from(
      { length: Math.floor(yMax / yStep) - Math.ceil(yMin / yStep) + 1 },
      (_, i) => (Math.ceil(yMin / yStep) + i) * yStep,
    );
  const gap = model.h !== 0 && Math.abs(model.h) < delta;
  return (
    <figure
      className="journey-scene derivative-scene"
      data-highlight={highlight}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${prefix}-title ${prefix}-desc`}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
      >
        <title id={`${prefix}-title`}>
          {state.mode === "square"
            ? "Difference quotient and limit of x squared"
            : state.mode === "jump"
              ? "A jump with different one-sided limits"
              : "An absolute-value cusp with no derivative at zero"}
        </title>
        <desc id={`${prefix}-desc`}>
          Graph of{" "}
          {state.mode === "square"
            ? "f(t)=t squared"
            : state.mode === "jump"
              ? "f(t)=−1 for t below zero and +1 otherwise"
              : "f(t)=absolute value of t"}{" "}
          on [−3,3]. At x={number(model.x)}, h={number(model.h)}.{" "}
          {model.secant === null
            ? "The secant quotient is undefined at h=0."
            : `Secant slope ${number(model.secant)}.`}{" "}
          {model.slope === null
            ? "There is no derivative at this point."
            : `Exact derivative ${number(model.slope)}.`}{" "}
          Drag the approach point horizontally; it stays on the function.
          Labeled numeric controls supply a keyboard equivalent.{" "}
          {state.mode === "square" &&
            showBands &&
            "Shading illustrates a stated epsilon–delta implication, not proof by sampling."}
        </desc>
        <defs>
          <clipPath id={`${prefix}-clip`}>
            <rect x={PAD} y={PAD} width={plotW} height={plotH} />
          </clipPath>
        </defs>
        <g className="journey-grid" aria-hidden="true">
          {[-3, -2, -1, 0, 1, 2, 3].map((x) => (
            <g key={x}>
              <line x1={px(x)} y1={PAD} x2={px(x)} y2={H - PAD} />
              <text x={px(x)} y={H - PAD + 22} textAnchor="middle">
                {x}
              </text>
            </g>
          ))}
          {yTicks.map((y) => (
            <g key={y}>
              <line x1={PAD} y1={py(y)} x2={W - PAD} y2={py(y)} />
              <text x={PAD - 12} y={py(y) + 4} textAnchor="end">
                {number(y)}
              </text>
            </g>
          ))}
          <line
            className="journey-axis"
            x1={PAD}
            y1={py(0)}
            x2={W - PAD}
            y2={py(0)}
          />
          <line
            className="journey-axis"
            x1={px(0)}
            y1={PAD}
            x2={px(0)}
            y2={H - PAD}
          />
          <text x={W - PAD} y={H - PAD + 43} textAnchor="end">
            t (unitless)
          </text>
          <text x={PAD} y={PAD - 19}>
            f(t) (unitless)
          </text>
        </g>
        <g clipPath={`url(#${prefix}-clip)`}>
          {state.mode === "square" && showBands && (
            <g
              className="journey-limit-bands"
              data-active={
                isActive(highlight, "limit", "epsilon", "delta") || undefined
              }
            >
              <rect
                className="journey-delta-band"
                x={left}
                y={PAD}
                width={right - left}
                height={plotH}
              />
              <rect
                className="journey-epsilon-band"
                x={PAD}
                y={upper}
                width={plotW}
                height={lower - upper}
              />
              <line x1={left} y1={PAD} x2={left} y2={H - PAD} />
              <line x1={right} y1={PAD} x2={right} y2={H - PAD} />
              <text x={(left + right) / 2} y={PAD + 18} textAnchor="middle">
                |t−x| &lt; δ
              </text>
              <text x={W - PAD - 7} y={upper - 8} textAnchor="end">
                f(x) + ε
              </text>
            </g>
          )}
          {state.mode === "jump" ? (
            <>
              <polyline
                className="journey-function"
                points={`${px(-3)},${py(-1)} ${px(0)},${py(-1)}`}
              />
              <polyline
                className="journey-function"
                points={`${px(0)},${py(1)} ${px(3)},${py(1)}`}
              />
              <circle
                className="journey-open-point"
                cx={px(0)}
                cy={py(-1)}
                r="6"
              />
              <circle
                className="journey-filled-point"
                cx={px(0)}
                cy={py(1)}
                r="6"
              />
            </>
          ) : (
            <polyline
              className="journey-function"
              points={samples(-3, 3)}
              data-active={
                isActive(highlight, "function", "curve") || undefined
              }
            />
          )}
          {model.slope !== null && (
            <line
              className="journey-tangent"
              x1={px(tangentLeft)}
              y1={py(model.y + model.slope * (tangentLeft - model.x))}
              x2={px(tangentRight)}
              y2={py(model.y + model.slope * (tangentRight - model.x))}
              data-active={
                isActive(highlight, "tangent", "derivative") || undefined
              }
            />
          )}
          {model.secant !== null && (
            <line
              className="journey-secant"
              x1={px(model.x)}
              y1={py(model.y)}
              x2={px(model.x + model.h)}
              y2={py(model.other)}
              data-active={
                isActive(highlight, "quotient", "secant", "gap") || undefined
              }
            />
          )}
        </g>
        <circle
          className="journey-base-point"
          cx={px(model.x)}
          cy={py(model.y)}
          r="5"
        />
        <circle
          className="journey-approach-point"
          data-inside-delta={
            state.mode === "square" && showBands ? gap : undefined
          }
          cx={px(model.x + model.h)}
          cy={py(model.other)}
          r="6"
        />
        <circle
          className="journey-handle-hit"
          data-testid="journey-approach-point"
          cx={px(model.x + model.h)}
          cy={py(model.other)}
          r="9"
          vectorEffect="non-scaling-stroke"
          onPointerDown={start}
        >
          <title>
            Drag horizontally to change h; numeric gap input is equivalent
          </title>
        </circle>
        <text
          className="journey-point-label"
          x={px(model.x) - 8}
          y={py(model.y) + 21}
          textAnchor="end"
        >
          x
        </text>
        <text
          className="journey-point-label"
          x={px(model.x + model.h) + 8}
          y={py(model.other) - 12}
          textAnchor="start"
        >
          x+h
        </text>
      </svg>
      <div className="journey-scene-legend">
        <span className="legend-function">Function</span>
        <span className="legend-secant">Dashed secant</span>
        <span className="legend-tangent">Local tangent, where defined</span>
      </div>
      <figcaption>
        {state.mode === "square"
          ? showBands
            ? `For ε=${number(model.epsilon)}, δ=${number(delta)} is a sufficient choice: 0<|t−x|<δ implies |t²−x²|<ε. The bands illustrate this implication; finite samples do not prove the limit.`
            : "For h≠0, the difference quotient of x² simplifies to 2x+h. Its limit as h→0 gives the exact derivative 2x; the justified steps are in Why is it true?"
          : state.mode === "jump"
            ? "At 0 the left function limit is −1 and the right limit is +1. The disconnected graph has an open point at (0,−1) and a filled point at (0,1); there is no two-sided limit or derivative there."
            : "The graph |t| is continuous at 0, but its one-sided slopes are −1 and +1. No tangent derivative is drawn at the cusp."}{" "}
        The curve is drawn from sampled values. The dashed secant joins two
        sample points; it is not a segment of the function graph.
      </figcaption>
      <p className="journey-scene-status" role="status">
        {notice ||
          (model.h === 0
            ? "h=0: the difference quotient divides by zero and is undefined. A derivative, when it exists, comes from a limit."
            : `Current gap h=${number(model.h)}; secant slope ${number(model.secant!)}.${model.slope === null ? " The exact derivative is undefined at this point." : ` Exact derivative ${number(model.slope)}.`}`)}
      </p>
    </figure>
  );
}
