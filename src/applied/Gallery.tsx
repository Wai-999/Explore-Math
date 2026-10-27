import { useState } from "react";
import "./applied.css";
export const cards = [
  {
    id: "sales",
    title: "Sales Decision Simulator",
    domain: "Sales",
    description:
      "Find a price and effort plan. Inspect segment demand, margins, stock and a real computed profit surface.",
  },
];
export default function Gallery({ embedded = false }: { embedded?: boolean }) {
  const [domain, setDomain] = useState("All"),
    [level, setLevel] = useState("1");
  return (
    <section
      className="applied-gallery"
      aria-labelledby="applied-gallery-title"
    >
      <span className="eyebrow">APPLIED 3D WORLDS · SYNTHETIC MODELS</span>
      {embedded ? (
        <h2 id="applied-gallery-title">
          Make a decision. See its mathematics.
        </h2>
      ) : (
        <h1 id="applied-gallery-title">Applied 3D Worlds</h1>
      )}
      <p>
        Predict, manipulate, derive, solve and build. Each world connects
        geometry, matrices and calculus. Skills remain open at every level.
      </p>
      <div className="filter-row">
        <label>
          Applied world domain
          <select
            aria-label="Applied world domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          >
            {["All", ...cards.map((c) => c.domain)].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Mission level
          <select
            aria-label="World mission level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="1">Foundation</option>
            <option value="2">Deeper</option>
            <option value="3">Advanced</option>
          </select>
        </label>
      </div>
      <div className="applied-cards">
        {cards
          .filter((c) => domain === "All" || c.domain === domain)
          .map((c, i) => (
            <article className="learning-card" key={c.id}>
              <span className="eyebrow">
                0{i + 1} · {c.domain}
              </span>
              <h3>{c.title}</h3>
              <p>{c.description}</p>
              <a
                className="primary"
                href={`#/applications/worlds/${c.id}?level=${level}`}
              >
                Start mission →
              </a>
            </article>
          ))}
      </div>
    </section>
  );
}
