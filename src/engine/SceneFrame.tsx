import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { GeometryView, type SceneProps } from "./GeometryView";
import { Icon } from "../components/Icon";
const ThreeStage = lazy(() => import("./ThreeStage"));
function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function SceneFrame({
  scene,
  title,
  default3d = true,
  children,
}: {
  scene: SceneProps;
  title: string;
  default3d?: boolean;
  children?: ReactNode;
}) {
  const [mode, setMode] = useState<"2d" | "3d">(default3d ? "3d" : "2d"),
    [camera, setCamera] = useState(0),
    [available] = useState(supportsWebGL),
    [lost, setLost] = useState(false);
  const can3d =
    scene.kind === "linear" ||
    scene.kind === "calculus" ||
    scene.kind === "robot";
  const fallback = (
    <>
      <GeometryView {...scene} />
      {default3d && (!available || lost) && (
        <p className="fallback-notice" role="status">
          {lost ? "3D context was lost." : "WebGL2 is unavailable."} Your
          controls and numbers still work in 2D.
        </p>
      )}
    </>
  );
  return (
    <div className={"scene-frame " + (default3d ? "" : "preview-scene")}>
      <div className="scene-topline">
        <span>
          <i /> {title}
        </span>
        <span className="scene-live">LIVE MODEL</span>
      </div>
      <div className="stage" data-testid="scene-stage">
        {can3d && mode === "3d" && available && !lost ? (
          <SceneBoundary fallback={fallback}>
            <Suspense
              fallback={
                <div className="scene-loading">Preparing your world…</div>
              }
            >
              <ThreeStage
                key={camera}
                scene={scene}
                onLost={() => setLost(true)}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          fallback
        )}
        {children}
      </div>
      <div className="scene-bottomline">
        <span className="scene-legend">
          <i className="solid" />{" "}
          {scene.kind === "calculus"
            ? "Particle / path"
            : scene.kind === "business"
              ? "Profit / quantity"
              : scene.kind === "regression"
                ? "Fitted line"
                : "Transformed"}{" "}
          <i className="dashed" />{" "}
          {scene.kind === "calculus"
            ? "Tangent plane"
            : scene.kind === "business"
              ? "Dollars / day"
              : scene.kind === "regression"
                ? "Residuals"
                : "Original"}
        </span>
        <div className="scene-tools">
          {can3d && (
            <button
              className="small-button"
              onClick={() => {
                if (lost) setLost(false);
                setMode(mode === "3d" ? "2d" : "3d");
              }}
            >
              {mode === "3d" ? "2D view" : "3D view"}
            </button>
          )}
          {mode === "3d" && can3d && (
            <button
              className="icon-button"
              aria-label="Home camera"
              title="Home camera"
              onClick={() => setCamera((c) => c + 1)}
            >
              <Icon name="Maximize2" size={17} />
            </button>
          )}
        </div>
      </div>
      <p className="stage-help">
        {mode === "3d" && available && !lost
          ? scene.kind === "linear"
            ? "Drag empty space to orbit · scroll or pinch to zoom · drag a basis tip in the xy plane"
            : "Drag empty space to orbit · scroll or pinch to zoom · use controls to change the model"
          : scene.kind === "linear"
            ? "Drag a basis tip in the xy plane · dashed edges show the original cube"
            : "Use the labeled controls to change the model"}
      </p>
    </div>
  );
}
