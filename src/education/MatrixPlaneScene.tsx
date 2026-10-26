import { useId, useRef, useState, type PointerEvent } from "react";
import { matrixModel, type SemanticState } from "./model";
import "../styles/matrix-plane.css";

type Point = readonly [number, number];
type View = { cx: number; cy: number; scale: number };
const WIDTH = 600,
  HEIGHT = 440,
  PAD = 72;
const n = (value: number) =>
  value === 0
    ? "0"
    : Math.abs(value) < 0.001
      ? value.toExponential(1)
      : String(Number(value.toFixed(3)));
const tuple = (point: readonly number[]) => `(${n(point[0])}, ${n(point[1])})`;
const at = (view: View, point: Point): Point => [
  WIDTH / 2 + (point[0] - view.cx) * view.scale,
  HEIGHT / 2 - (point[1] - view.cy) * view.scale,
];
function fit(points: Point[]): View {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(0, ...xs),
    maxX = Math.max(0, ...xs),
    minY = Math.min(0, ...ys),
    maxY = Math.max(0, ...ys);
  const spanX = Math.max(2, maxX - minX),
    spanY = Math.max(2, maxY - minY),
    margin = Math.max(0.7, 0.12 * Math.max(spanX, spanY));
  return {
    cx: (maxX + minX) / 2,
    cy: (maxY + minY) / 2,
    scale: Math.min(
      (WIDTH - 2 * PAD) / (spanX + 2 * margin),
      (HEIGHT - 2 * PAD) / (spanY + 2 * margin),
    ),
  };
}
function stepFor(rough: number) {
  const power = 10 ** Math.floor(Math.log10(rough)),
    fraction = rough / power;
  return (
    power * (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10)
  );
}
function Grid({ view }: { view: View }) {
  const step = stepFor(65 / view.scale),
    xMin = view.cx - (WIDTH / 2 - PAD) / view.scale,
    xMax = view.cx + (WIDTH / 2 - PAD) / view.scale,
    yMin = view.cy - (HEIGHT / 2 - PAD) / view.scale,
    yMax = view.cy + (HEIGHT / 2 - PAD) / view.scale;
  const xs = Array.from(
    { length: Math.floor(xMax / step) - Math.ceil(xMin / step) + 1 },
    (_, i) => (Math.ceil(xMin / step) + i) * step,
  );
  const ys = Array.from(
    { length: Math.floor(yMax / step) - Math.ceil(yMin / step) + 1 },
    (_, i) => (Math.ceil(yMin / step) + i) * step,
  );
  const origin = at(view, [0, 0]);
  return (
    <g className="matrix-plane-grid" aria-hidden="true">
      {xs.map((x) => (
        <g key={`x${x}`}>
          <line
            x1={at(view, [x, 0])[0]}
            y1={PAD}
            x2={at(view, [x, 0])[0]}
            y2={HEIGHT - PAD}
          />
          <text
            x={at(view, [x, 0])[0]}
            y={HEIGHT - PAD + 27}
            textAnchor="middle"
          >
            {n(x)}
          </text>
        </g>
      ))}
      {ys.map((y) => (
        <g key={`y${y}`}>
          <line
            x1={PAD}
            y1={at(view, [0, y])[1]}
            x2={WIDTH - PAD}
            y2={at(view, [0, y])[1]}
          />
          <text x={PAD - 14} y={at(view, [0, y])[1] + 5} textAnchor="end">
            {n(y)}
          </text>
        </g>
      ))}
      <line
        className="matrix-plane-axis"
        x1={PAD}
        y1={origin[1]}
        x2={WIDTH - PAD}
        y2={origin[1]}
      />
      <line
        className="matrix-plane-axis"
        x1={origin[0]}
        y1={PAD}
        x2={origin[0]}
        y2={HEIGHT - PAD}
      />
      <text
        className="matrix-plane-axis-name"
        x={WIDTH - PAD}
        y={HEIGHT - 15}
        textAnchor="end"
      >
        x
      </text>
      <text className="matrix-plane-axis-name" x="22" y={PAD - 24}>
        y
      </text>
    </g>
  );
}
function Arrow({
  point,
  view,
  kind,
  id,
  label,
  offset = [9, -12],
  labelAt = "tip",
}: {
  point: Point;
  view: View;
  kind: string;
  id: string;
  label: string;
  offset?: Point;
  labelAt?: "tip" | "middle";
}) {
  const from = at(view, [0, 0]),
    to = at(view, point),
    labelPoint: Point =
      labelAt === "middle"
        ? [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
        : to,
    dx =
      labelAt === "tip"
        ? labelPoint[0] > WIDTH / 2
          ? -Math.abs(offset[0])
          : Math.abs(offset[0])
        : offset[0];
  return (
    <g className={`matrix-plane-arrow ${kind}`}>
      <line
        x1={from[0]}
        y1={from[1]}
        x2={to[0]}
        y2={to[1]}
        markerEnd={Math.hypot(...point) > 1e-12 ? `url(#${id})` : undefined}
      />
      <text
        x={labelPoint[0] + dx}
        y={labelPoint[1] + offset[1]}
        textAnchor={dx < 0 ? "end" : "start"}
      >
        {label}
      </text>
    </g>
  );
}
function marker(id: string, kind: string) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto"
    >
      <path className={kind} d="M0 0L10 5L0 10z" />
    </marker>
  );
}

export function MatrixPlaneScene({
  state,
  onChange,
  highlight,
}: {
  state: SemanticState;
  onChange: (state: SemanticState) => void;
  highlight?: string;
}) {
  const model = matrixModel(state.values),
    prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const c1: Point = [model.columns[0][0], model.columns[0][1]],
    c2: Point = [model.columns[1][0], model.columns[1][1]],
    sum: Point = [c1[0] + c2[0], c1[1] + c2[1]],
    probe: Point = [model.probe[0], model.probe[1]],
    image: Point = [model.image[0], model.image[1]];
  const unit: Point[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    mapped: Point[] = [[0, 0], c1, sum, c2];
  const natural = fit([...unit, ...mapped, probe, image]);
  const [heldView, setHeldView] = useState<View | null>(null),
    view = heldView || natural;
  const drag = useRef<{ column: 0 | 1; view: View } | null>(null),
    [notice, setNotice] = useState("");
  const polygon = (points: Point[]) =>
    points.map((p) => at(view, p).join(",")).join(" ");
  const columns = highlight === "columns",
    area = highlight === "area";
  function start(event: PointerEvent<SVGCircleElement>, column: 0 | 1) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { column, view };
    setHeldView(view);
    setNotice("");
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (!active) return;
    const transform = event.currentTarget.getScreenCTM();
    if (!transform) return;
    const pointer = event.currentTarget.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const local = pointer.matrixTransform(transform.inverse());
    const x = active.view.cx + (local.x - WIDTH / 2) / active.view.scale,
      y = active.view.cy - (local.y - HEIGHT / 2) / active.view.scale;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > 3 ||
      Math.abs(y) > 3
    ) {
      setNotice(
        "Move rejected: each matrix entry must remain in [−3,3]. No value was clamped.",
      );
      return;
    }
    const values = [...state.values];
    values[active.column] = x;
    values[active.column + 2] = y;
    onChange({ ...state, values });
    setNotice("");
  }
  function finish() {
    drag.current = null;
    setHeldView(null);
  }
  const orientation =
    model.area === 0
      ? "The represented xy square collapses to a line or point."
      : model.area > 0
        ? "The xy orientation is preserved."
        : "The xy orientation is reversed.";
  return (
    <figure className="matrix-plane-scene" data-highlight={highlight}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={`${prefix}-title ${prefix}-description`}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
      >
        <title id={`${prefix}-title`}>
          Two-dimensional matrix action and signed area
        </title>
        <desc id={`${prefix}-description`}>
          The dashed original unit square maps to a parallelogram with columns
          Ae1={tuple(c1)} and Ae2={tuple(c2)}. Input v={tuple(probe)} maps to xy
          output {tuple(image)}. Signed planar area is {n(model.area)};{" "}
          {orientation} The drawing uses equal units per pixel on both axes; the
          matrix itself may change angles. Drag either column tip or use the
          labeled matrix inputs. This plane view omits the separate z coordinate
          and z scale.
        </desc>
        <defs>
          {marker(`${prefix}-c1`, "matrix-plane-first")}
          {marker(`${prefix}-c2`, "matrix-plane-second")}
          {marker(`${prefix}-input`, "matrix-plane-input")}
          {marker(`${prefix}-output`, "matrix-plane-output")}
        </defs>
        <Grid view={view} />
        <g>
          <polygon className="matrix-plane-original" points={polygon(unit)} />
          <polygon
            className="matrix-plane-image"
            points={polygon(mapped)}
            data-emphasis={area || undefined}
            data-collapsed={model.area === 0 || undefined}
          />
          <Arrow
            point={probe}
            view={view}
            kind="matrix-plane-input"
            id={`${prefix}-input`}
            label="v"
            offset={[-10, 25]}
            labelAt="middle"
          />
          <Arrow
            point={image}
            view={view}
            kind="matrix-plane-output"
            id={`${prefix}-output`}
            label="Av"
            offset={[10, -24]}
            labelAt="middle"
          />
          <g data-columns={columns || undefined}>
            <Arrow
              point={c1}
              view={view}
              kind="matrix-plane-first"
              id={`${prefix}-c1`}
              label="Ae₁"
              offset={[10, 22]}
            />
            <Arrow
              point={c2}
              view={view}
              kind="matrix-plane-second"
              id={`${prefix}-c2`}
              label="Ae₂"
              offset={[-10, -16]}
            />
          </g>
        </g>
        {[c1, c2].map((point, i) => {
          const p = at(view, point);
          return (
            <g key={i}>
              <circle
                className={`matrix-plane-tip column-${i}`}
                cx={p[0]}
                cy={p[1]}
                r="6"
              />
              <circle
                className="matrix-plane-hit"
                data-testid={`matrix-plane-column-${i}`}
                cx={p[0]}
                cy={p[1]}
                r="8"
                strokeWidth="34"
                vectorEffect="non-scaling-stroke"
                onPointerDown={(event) => start(event, i as 0 | 1)}
              >
                <title>
                  Drag column {i + 1}; labeled matrix fields provide a keyboard
                  equivalent
                </title>
              </circle>
            </g>
          );
        })}
      </svg>
      <div className="matrix-plane-legend">
        <span className="original">Original unit square (dashed)</span>
        <span className="mapped">Mapped square</span>
        <span className="input">Input v (dashed arrow)</span>
        <span className="output">Output Av</span>
      </div>
      <figcaption>
        Ae₁={tuple(c1)}, Ae₂={tuple(c2)}. Signed xy area ad−bc={n(model.area)};
        geometric area |ad−bc|={n(Math.abs(model.area))}. {orientation} All
        coordinates are unitless and values are rounded for display.
      </figcaption>
      <p className="matrix-plane-dimension-note">
        This is the xy action of the displayed block matrix. The omitted z scale
        is {n(state.values[4])}; 3D signed volume scale is z×(ad−bc)=
        {n(model.det)}. The xy picture alone does not show that volume.
      </p>
      <p className="matrix-plane-status" role="status">
        {notice ||
          (heldView
            ? "The view stays fixed while dragging. Release to fit all updated coordinates; use numeric fields if column tips overlap."
            : "Drag a column tip, or edit its two labeled matrix entries. The image and values use the same matrix.")}
      </p>
    </figure>
  );
}
