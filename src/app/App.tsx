import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Icon, type icons } from "../components/Icon";
import { SceneFrame } from "../engine/SceneFrame";
import { rotation } from "../math/linear";
import { Range } from "../components/Controls";
import {
  loadLearning,
  parseLearning,
  persistLearning,
  originalLearningBackup,
  type Learning,
} from "../persistence/storage";
import { LearningContext, useLearning } from "./LearningContext";
import { applicationCards, sources } from "../content/lessons";
import type { ApplicationId } from "../worlds/Applications";
import "../styles/projects.css";
const ApplicationIndex = lazy(() =>
  import("../worlds/Applications").then((m) => ({
    default: m.ApplicationIndex,
  })),
);
const ProjectBuilder = lazy(() => import("../projects/ProjectBuilder"));
const JourneySummary = lazy(() => import("../education/JourneySummary"));
const PredictionStudio = lazy(() => import("../prediction/PredictionStudio"));
const StudioEntry = lazy(() =>
  import("../prediction/StudioLinks").then((m) => ({ default: m.StudioEntry })),
);
const StudioBacklog = lazy(() =>
  import("../prediction/StudioLinks").then((m) => ({
    default: m.StudioBacklog,
  })),
);
const LinearWorld = lazy(() => import("../worlds/LinearWorld"));
const CalculusWorld = lazy(() => import("../worlds/CalculusWorld"));
const ApplicationMission = lazy(() => import("../worlds/Applications"));
const destinations: { id: string; label: string; icon: keyof typeof icons }[] =
  [
    { id: "discover", label: "Discover", icon: "Compass" },
    { id: "explore", label: "Explore", icon: "Orbit" },
    { id: "challenges", label: "Challenges", icon: "Trophy" },
    { id: "applications", label: "Applications", icon: "Layers3" },
    { id: "learning", label: "My Learning", icon: "BookOpen" },
  ];
function useRoute() {
  const [hash, setHash] = useState(location.hash || "#/discover");
  useEffect(() => {
    const f = () => {
      setHash(location.hash || "#/discover");
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return hash.replace(/^#\/?/, "").split("/");
}
function WorldArt({ type }: { type: "linear" | "calculus" }) {
  return (
    <svg viewBox="0 0 260 130" aria-hidden="true">
      {type === "linear" ? (
        <>
          <g stroke="#b9d994" fill="#80aa7c" fillOpacity=".12">
            <path
              d="M75 40L146 23L199 58L128 78Z M75 40V91L128 119L199 98V58 M128 78V119 M75 91L146 72L199 98 M146 23V72"
              strokeWidth="1.4"
            />
            <path d="M36 105H220M128 128V10" opacity=".25" />
          </g>
          <circle cx="146" cy="23" r="4" fill="#d4efa4" />
          <circle cx="199" cy="58" r="4" fill="#84d7cb" />
          <circle cx="128" cy="78" r="4" fill="#cab7eb" />
        </>
      ) : (
        <g fill="none" stroke="#87c8bc">
          {Array.from({ length: 7 }, (_, i) => (
            <path
              key={i}
              d={`M40 ${40 + i * 9} Q130 ${150 - i * 12} 220 ${40 + i * 9}`}
              opacity={0.3 + i * 0.08}
            />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              d={`M${40 + i * 22.5} 43 Q${30 + i * 25} 130 ${40 + i * 22.5} 105`}
              opacity=".35"
            />
          ))}
          <circle cx="166" cy="79" r="5" fill="#d9eba7" />
        </g>
      )}
    </svg>
  );
}
function Discover({ solved }: { solved: number }) {
  const { learning, update } = useLearning();
  const recent = Object.values(learning.journeys)
    .filter((s) => !!s)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  const [turn, setTurn] = useState(25),
    [readiness, setReadiness] = useState(false),
    [answer, setAnswer] = useState("");
  const matrix = useMemo(() => rotation("z", turn), [turn]);
  return (
    <>
      <div className="discover-top">
        <div>
          <span className="eyebrow">A PLACE FOR CURIOSITY</span>
          <p>Your next discovery starts here.</p>
        </div>
        <span className="session-pill">
          <span /> Your own pace. Your own path.
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-tag">
            <Icon name="Sparkles" size={14} /> THE WORLD MAKES MORE SENSE WHEN
            YOU EXPLORE IT
          </div>
          <h1>
            Make the abstract
            <br />
            feel <span>tangible.</span>
          </h1>
          <p>
            Turn a vector. Follow a gradient. Find that little
            <br className="desktop-break" /> moment when mathematics finally
            clicks.
          </p>
          <a className="primary" href="#/explore/linear/vectors">
            Start with vectors <Icon name="ArrowUpRight" size={19} />
          </a>
          <div className="hero-footnote">
            <span className="tiny-dot" /> Explore an idea, explain why, then
            build with it.
          </div>
          {recent && (
            <a
              className="text-button"
              href={`#/explore/${["vectors", "matrices"].includes(recent.id) ? "linear" : "calculus"}/${recent.id}`}
            >
              Continue your {recent.id} journey →
            </a>
          )}
          <details className="entry-preferences">
            <summary>Choose a starting point (optional)</summary>
            <div className="preset-row">
              {[
                {
                  label: "I’m new to math",
                  href: "#/explore/linear/vectors",
                  depth: "intuition" as const,
                },
                {
                  label: "I know some algebra",
                  href: "#/explore/linear/matrices",
                  depth: "foundations" as const,
                },
                {
                  label: "I want advanced topics",
                  href: "#/explore/calculus/gradients",
                  depth: "research" as const,
                },
              ].map((choice) => (
                <a
                  className="text-button"
                  key={choice.label}
                  href={choice.href}
                  onClick={() => update({ ...learning, depth: choice.depth })}
                >
                  {choice.label} →
                </a>
              ))}
            </div>
            <p className="caption">
              A suggested route and view preference, not a placement assessment.
              All paths remain open.
            </p>
          </details>
        </div>
        <div className="hero-stage">
          <SceneFrame
            default3d={false}
            title="A LITTLE CHANGE. A NEW PERSPECTIVE."
            scene={{ kind: "linear", matrix }}
          >
            <div className="hero-coordinate">
              det(A) <strong>1.000</strong>
              <span>Volume preserved</span>
            </div>
          </SceneFrame>
          <div className="hero-slider">
            <Range
              label="Give the world a turn"
              value={turn}
              min={-90}
              max={90}
              step={1}
              unit="°"
              onChange={setTurn}
            />
            <span className="try-label">TRY IT ↗</span>
          </div>
        </div>
      </section>
      <StudioEntry />
      <div className="section-heading">
        <div>
          <span className="eyebrow">CHOOSE A WORLD</span>
          <h2>Big ideas. Small first steps.</h2>
        </div>
        <span>Two worlds. Endless “aha” moments.</span>
      </div>
      <section className="world-cards">
        <a className="world-card linear-card" href="#/explore/linear">
          <div className="world-card-top">
            <span className="card-index">01 / LINEAR ALGEBRA</span>
            <span className="round-arrow">
              <Icon name="ArrowUpRight" />
            </span>
          </div>
          <div className="world-card-body">
            <div>
              <h3>Transform space</h3>
              <p>
                See how vectors and matrices
                <br />
                reshape the world around you.
              </p>
              <div className="card-tags">
                <span>Vectors</span>
                <span>Matrices</span>
                <span>Transformations</span>
              </div>
            </div>
            <WorldArt type="linear" />
          </div>
          <div className="card-bottom">
            <span>
              <span className="tiny-dot" /> Start with a single arrow
            </span>
            <span>
              EXPLORE WORLD <Icon name="ArrowRight" size={14} />
            </span>
          </div>
        </a>
        <a className="world-card calculus-card" href="#/explore/calculus">
          <div className="world-card-top">
            <span className="card-index">02 / CALCULUS</span>
            <span className="round-arrow">
              <Icon name="ArrowUpRight" />
            </span>
          </div>
          <div className="world-card-body">
            <div>
              <h3>Touch change</h3>
              <p>
                Feel the slope. Find the lowest point.
                <br />
                Make sense of a changing world.
              </p>
              <div className="card-tags">
                <span>Derivatives</span>
                <span>Gradients</span>
                <span>Integrals</span>
              </div>
            </div>
            <WorldArt type="calculus" />
          </div>
          <div className="card-bottom">
            <span>
              <span className="tiny-dot" /> Start with a little change
            </span>
            <span>
              EXPLORE WORLD <Icon name="ArrowRight" size={14} />
            </span>
          </div>
        </a>
      </section>
      <section className="discovery-bottom">
        <div className="applied-teaser">
          <div className="outline-icon">
            <Icon name="FlaskConical" size={25} />
          </div>
          <div>
            <span className="eyebrow">TAKE AN IDEA INTO THE REAL WORLD</span>
            <h3>Okay, but when would I use this?</h3>
            <p>Point a camera. Run a business. Fit a model.</p>
          </div>
          <a className="text-button" href="#/applications">
            Try a mission <Icon name="ArrowRight" size={18} />
          </a>
        </div>
        <div className="readiness-card">
          <Icon name="Compass" size={23} />
          <div>
            <h3>Not sure where to begin?</h3>
            <p>
              {solved > 0
                ? `${solved} independent challenge${solved === 1 ? "" : "s"} solved. Keep exploring.`
                : "Find a comfortable starting point."}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Open readiness check"
            onClick={() => setReadiness(!readiness)}
          >
            <Icon name="ArrowUpRight" />
          </button>
        </div>
      </section>
      {readiness && (
        <section className="readiness-panel">
          <h2>A quick starting point</h2>
          <p>
            A vector (1, 0) is turned 90° counterclockwise. Where does it point?
          </p>
          <div className="preset-row">
            {["(0, 1)", "(0, −1)", "I’m new to vectors"].map((a) => (
              <button
                className="secondary"
                key={a}
                onClick={() => setAnswer(a)}
              >
                {a}
              </button>
            ))}
          </div>
          {answer && (
            <p role="status">
              {answer === "(0, 1)"
                ? "Yes. Try the satellite mission in Transform space."
                : "Start in Transform space: compare the identity with a 90° rotation. You can learn the coordinates as you go."}{" "}
              <a href="#/explore/linear/vectors">Start with vectors →</a>
            </p>
          )}
          <p className="caption">
            A suggestion, not a placement test. Every world is open to you.
          </p>
        </section>
      )}
    </>
  );
}
function Challenges() {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">
          PREDICT → CHANGE → OBSERVE → EXPLAIN → APPLY
        </span>
        <h1>
          Put an idea to the test<span className="accent-dot">.</span>
        </h1>
        <p>
          Make a prediction, explore, then solve a new mathematical problem.
        </p>
      </div>
      <StudioEntry />
      <div className="challenge-list">
        {[
          {
            title: "Save the satellite orientation",
            text: "Match a seeded rotation without changing shape or volume.",
            tag: "Linear algebra",
            href: "#/explore/linear",
            icon: "Orbit" as const,
          },
          {
            title: "Find the lowest energy route",
            text: "Reach energy below 0.01 by choosing a safe descent step.",
            tag: "Calculus",
            href: "#/explore/calculus",
            icon: "Activity" as const,
          },
          ...applicationCards.map((c) => ({
            title: c.title,
            text: c.description,
            tag: c.category,
            href: "#/applications/" + c.id,
            icon: c.icon,
          })),
        ].map((c, i) => (
          <a key={c.title} href={c.href} className="challenge-row">
            <span className="challenge-number">0{i + 1}</span>
            <Icon name={c.icon} size={27} />
            <div>
              <span className="eyebrow">{c.tag}</span>
              <h2>{c.title}</h2>
              <p>{c.text}</p>
            </div>
            <Icon name="ArrowUpRight" size={24} />
          </a>
        ))}
      </div>
      <p className="quiet-note">
        Progress records independent solutions. Exploring or opening a worked
        answer is practice, and is always welcome.
      </p>
    </>
  );
}
function MyLearning({
  learning,
  update,
  notice,
}: {
  learning: Learning;
  update: (v: Learning) => void;
  notice: string;
}) {
  const [message, setMessage] = useState("");
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(learning, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "math-world-learning-v2.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">YOUR CURIOSITY, OVER TIME</span>
        <h1>
          A little further every time<span className="accent-dot">.</span>
        </h1>
        <p>
          Your learning lives in this browser. No account, no tracking, no
          pressure.
        </p>
      </div>
      <JourneySummary />
      <div className="learning-grid">
        <section className="learning-card">
          <Icon name="Trophy" size={25} />
          <h2>{learning.solved.length} independent solutions</h2>
          <p>
            Evidence of a solved example, not a claim of mastery. Return after a
            delay and try a fresh challenge.
          </p>
          {learning.solved.length === 0 ? (
            <a className="text-button" href="#/challenges">
              Find your first challenge <Icon name="ArrowRight" size={16} />
            </a>
          ) : (
            <ul className="evidence-list">
              {learning.solved.map((e) => (
                <li key={e.id}>
                  <Icon name="Check" size={16} />
                  <span>
                    {e.id}
                    <small>
                      {new Date(e.at).toLocaleDateString()} · {e.attempts}{" "}
                      attempt{e.attempts === 1 ? "" : "s"}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="learning-card">
          <Icon name="Bookmark" size={25} />
          <h2>Ideas to come back to</h2>
          {learning.bookmarks.length === 0 ? (
            <p>Bookmark an idea from a world to keep it here.</p>
          ) : (
            learning.bookmarks.map((b) => (
              <a
                className="bookmark-link"
                key={b}
                href={
                  b === "transform-space"
                    ? "#/explore/linear"
                    : "#/explore/calculus"
                }
              >
                {b === "transform-space" ? "Transform space" : "Touch change"}{" "}
                <Icon name="ArrowUpRight" size={16} />
              </a>
            ))
          )}
          <h3>Make the space yours</h3>
          <label className="select-label" htmlFor="theme">
            Appearance
          </label>
          <select
            id="theme"
            value={learning.theme}
            onChange={(e) =>
              update({
                ...learning,
                theme: e.target.value as Learning["theme"],
              })
            }
          >
            <option value="dark">Midnight</option>
            <option value="light">Daylight</option>
            <option value="system">Follow system</option>
          </select>
          <label className="select-label" htmlFor="depth">
            Explanation depth
          </label>
          <select
            id="depth"
            value={learning.depth}
            onChange={(e) =>
              update({
                ...learning,
                depth: e.target.value as Learning["depth"],
              })
            }
          >
            {["intuition", "foundations", "advanced", "research"].map((x) => (
              <option key={x} value={x}>
                {
                  {
                    intuition: "New",
                    foundations: "Building",
                    advanced: "Deep",
                    research: "Rigorous",
                  }[x as Learning["depth"]]
                }
              </option>
            ))}
          </select>
          <p className="caption">
            Depth changes the explanation, not your competence or access.
          </p>
        </section>
        <section className="learning-card">
          <Icon name="Download" size={25} />
          <h2>Keep a copy of your journey</h2>
          <p>
            Export a versioned JSON backup or restore one. Import creates a
            downloadable copy of your current progress first.
          </p>
          <div className="preset-row">
            <button className="secondary" onClick={download}>
              <Icon name="Download" size={16} /> Export progress
            </button>
            <label className="secondary upload-label">
              <Icon name="Upload" size={16} /> Restore backup
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5_000_000) {
                    setMessage("Backup is too large (maximum 5 MB).");
                    return;
                  }
                  try {
                    const next = parseLearning(await f.text());
                    download();
                    update(next);
                    setMessage(
                      "Backup restored. Your previous progress was downloaded first.",
                    );
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Could not read this file.",
                    );
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <button
            className="text-button"
            onClick={() => {
              try {
                const raw = originalLearningBackup();
                if (!raw) {
                  setMessage(
                    "No earlier raw browser record is available on this device.",
                  );
                  return;
                }
                const url = URL.createObjectURL(
                  new Blob([raw], { type: "application/json" }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "math-world-original-saved-data.json";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setMessage(
                  "Original saved bytes downloaded without normalization.",
                );
              } catch {
                setMessage(
                  "Browser storage is unavailable; the original record could not be read.",
                );
              }
            }}
          >
            Download original saved data
          </button>
          <p role="status">{message || notice}</p>
          <p className="caption">
            Schema v2: theme, depth, bookmarks, solution evidence, guided
            concept journeys, saved projects, prediction experiments, and
            decision journals. Version 1 backups migrate without deleting the
            original browser key. Browser storage may be cleared by private mode
            or device settings.
          </p>
        </section>
        <section className="learning-card">
          <Icon name="BookOpen" size={25} />
          <h2>Built on clear foundations</h2>
          <p>
            Original explanations and procedural diagrams, informed by these
            open teaching and technical references.
          </p>
          {sources.map((s) => (
            <a
              className="source-link"
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              {s.label}
              <Icon name="ArrowUpRight" size={14} />
            </a>
          ))}
          <p className="caption">
            Core scenes: implemented. SVD/PCA, vector calculus, multiple
            integrals, and constrained optimization: planned. Math reviewed by
            automated tests and an AI author; independent human expert and
            learner reviews remain pending.
          </p>
        </section>
      </div>
      <section className="learning-card">
        <h2>Projects you can rebuild</h2>
        <p>
          Saved parameter states, predictions, observations, and reasoning
          self-checks. A numeric goal is evidence for that attempt only.
        </p>
        <a className="text-button" href="#/applications/builder">
          Create a new project →
        </a>
        {learning.projects.length === 0 ? (
          <p>No projects saved yet.</p>
        ) : (
          <ul className="evidence-list">
            {learning.projects.map((p) => (
              <li key={p.id}>
                <span>
                  <a href={`#/applications/builder/${p.template}/${p.id}`}>
                    {p.title} →
                  </a>
                  <small>
                    {p.evidence.attempts} numeric checks ·{" "}
                    {p.evidence.hintUsed
                      ? "guided record"
                      : "no solution revealed in this draft"}{" "}
                    ·{" "}
                    {p.evidence.selfChecked
                      ? "learner self-checked"
                      : "reasoning not reviewed"}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="learning-card studio-progress">
        <h2>Prediction practice, over time</h2>
        <p>
          Frozen experiments preserve their protocol after reload. Fresh
          experiments archive completed journals. Free-text rationales are
          retained for human review; automated checks assess only structured
          answers.
        </p>
        <a className="text-button" href="#/explore/prediction">
          Continue prediction studio →
        </a>
        {Object.entries(learning.studio).map(([id, s]) => (
          <p key={id}>
            {id} · seed {s.seed} ·{" "}
            {s.tested
              ? "final test opened"
              : s.frozen
                ? "frozen"
                : "development"}{" "}
            · {s.hintUsed ? "guided" : "guidance unopened"}
            {s.misconceptions?.length
              ? ` · Review: ${s.misconceptions.join(" ")}`
              : ""}
          </p>
        ))}
        {learning.studioHistory.map((h, i) => (
          <details key={i}>
            <summary>
              {h.project} · seed {h.seed} ·{" "}
              {h.guided ? "guided" : "structured practice"} ·{" "}
              {new Date(h.at).toLocaleDateString()}
            </summary>
            <p>Hypothesis: {h.hypothesis}</p>
            <p>Interpretation: {h.interpretation}</p>
            <p>Operating decision: {h.decision}</p>
          </details>
        ))}
        <p className="caption">
          Review a different seed after seven days to check retention. This is a
          suggestion, not a validated retention assessment.
        </p>
      </section>
      <StudioBacklog />
    </>
  );
}
export default function App() {
  const [route, sub, detail, projectId] = useRoute(),
    [initial] = useState(loadLearning),
    [learning, setLearning] = useState(initial.data),
    [notice, setNotice] = useState(initial.notice),
    [menu, setMenu] = useState(false),
    [storageAllowed, setStorageAllowed] = useState(!initial.notice);
  function update(value: Learning) {
    setLearning(value);
    setStorageAllowed(true);
  }
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme =
        learning.theme === "system"
          ? system.matches
            ? "light"
            : "dark"
          : learning.theme;
    };
    apply();
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [learning.theme]);
  useEffect(() => {
    if (!storageAllowed) return;
    try {
      persistLearning(learning);
    } catch {
      queueMicrotask(() =>
        setNotice(
          "Browser storage is unavailable. Your current progress works for this session; export a backup to keep it.",
        ),
      );
    }
  }, [learning, storageAllowed]);
  useEffect(() => {
    const close = () => setMenu(false);
    addEventListener("hashchange", close);
    return () => removeEventListener("hashchange", close);
  }, []);
  useEffect(() => {
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [route, sub, detail, projectId]);
  function record(id: string, seed: number, passed: boolean) {
    setStorageAllowed(true);
    setLearning((prev) => {
      const attempts = (prev.attempts[id] || 0) + 1;
      return {
        ...prev,
        attempts: { ...prev.attempts, [id]: attempts },
        solved:
          passed && !prev.solved.some((x) => x.id === id)
            ? [
                ...prev.solved,
                { id, seed, attempts, at: new Date().toISOString() },
              ]
            : prev.solved,
      };
    });
  }
  const active = destinations.find((d) => d.id === route) ? route : "discover";
  return (
    <LearningContext.Provider value={{ learning, update, record }}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="app-shell">
        <aside className={"sidebar " + (menu ? "menu-open" : "")}>
          <a href="#/discover" className="brand" title="Math World 3D home">
            <span className="brand-mark">
              <Icon name="Box" size={25} />
            </span>
            <span>
              math<span className="brand-light">world</span>
              <sup>3D</sup>
            </span>
          </a>
          <div className="nav-label">YOUR DISCOVERY STUDIO</div>
          <nav aria-label="Main navigation">
            {destinations.map((d, i) => (
              <a
                href={"#/" + d.id + (d.id === "explore" ? "/linear" : "")}
                key={d.id}
                className={active === d.id ? "active" : ""}
                aria-current={active === d.id ? "page" : undefined}
              >
                <Icon name={d.icon} size={20} />
                <span>{d.label}</span>
                {active === d.id ? (
                  <span className="nav-dot" />
                ) : (
                  <span className="nav-index" aria-hidden="true">
                    0{i + 1}
                  </span>
                )}
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-orbit">
              <Icon name="Orbit" size={34} />
            </div>
            <p>
              A small experiment.
              <br />A whole new perspective.
            </p>
            <span>FREE TO EXPLORE. ALWAYS.</span>
            <div className="sidebar-footer">
              <button
                className="icon-button"
                aria-label="Toggle light or dark theme"
                onClick={() =>
                  update({
                    ...learning,
                    theme: learning.theme === "light" ? "dark" : "light",
                  })
                }
              >
                <Icon
                  name={learning.theme === "light" ? "Moon" : "Sun"}
                  size={18}
                />
              </button>
              <span>Made for curious minds</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Icon name={menu ? "X" : "Menu"} />
            </button>
            <div className="breadcrumb">
              <span>THE STUDIO</span>
              <Icon name="ChevronRight" size={14} />
              <strong>
                {destinations.find((d) => d.id === active)?.label}
              </strong>
            </div>
            <div className="topbar-right">
              <span className="local-badge">
                <span /> Saved on your device
              </span>
              <a
                href="#/learning"
                className="avatar"
                aria-label="You · My learning settings"
              >
                YOU
              </a>
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            {notice && (
              <div role="status" className="storage-notice">
                {notice}
              </div>
            )}
            {active === "explore" && (
              <div className="subject-tabs">
                <a
                  href="#/explore/linear"
                  className={
                    sub !== "calculus" && sub !== "prediction" ? "active" : ""
                  }
                >
                  <Icon name="Box" size={16} /> Linear algebra
                </a>
                <a
                  href="#/explore/calculus"
                  className={sub === "calculus" ? "active" : ""}
                >
                  <Icon name="Activity" size={16} /> Calculus
                </a>
                <a
                  href="#/explore/prediction"
                  className={sub === "prediction" ? "active" : ""}
                >
                  <Icon name="FlaskConical" size={16} /> Prediction studio
                </a>
              </div>
            )}
            <Suspense
              fallback={<div className="page-loading">Opening your world…</div>}
            >
              {active === "discover" ? (
                <Discover solved={learning.solved.length} />
              ) : active === "explore" ? (
                sub === "prediction" ? (
                  <PredictionStudio />
                ) : sub === "calculus" ? (
                  <CalculusWorld concept={detail} />
                ) : (
                  <LinearWorld concept={detail} />
                )
              ) : active === "challenges" ? (
                <Challenges />
              ) : active === "applications" ? (
                sub === "builder" ? (
                  <ProjectBuilder
                    key={`${detail || "vector-navigation"}:${projectId || "new"}`}
                    projects={learning.projects}
                    onChange={(projects) => update({ ...learning, projects })}
                    initialTemplate={
                      detail === "quadratic-cost"
                        ? "quadratic-cost"
                        : "vector-navigation"
                    }
                    initialProjectId={projectId}
                  />
                ) : ["robot", "business", "regression"].includes(sub) ? (
                  <ApplicationMission key={sub} id={sub as ApplicationId} />
                ) : (
                  <ApplicationIndex />
                )
              ) : (
                <MyLearning
                  learning={learning}
                  update={update}
                  notice={notice}
                />
              )}
            </Suspense>
            <footer className="page-footer">
              <span>
                <Icon name="Box" size={15} /> MATH WORLD 3D
              </span>
              <p>Less memorizing. More understanding.</p>
              <a href="#/learning">
                Local by design <Icon name="ArrowUpRight" size={13} />
              </a>
            </footer>
          </main>
        </div>
      </div>
    </LearningContext.Provider>
  );
}
