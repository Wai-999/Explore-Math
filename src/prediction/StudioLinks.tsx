import "../styles/prediction.css";
import { Icon } from "../components/Icon";
import { backlog } from "./curriculum";
export function StudioEntry() {
  return (
    <section className="studio-entry">
      <div className="studio-entry-art">
        <Icon name="FlaskConical" size={40} />
        <span>FROM QUESTION TO EVIDENCE</span>
      </div>
      <div>
        <span className="eyebrow">NEW LEARNING STUDIO · REVIEW CANDIDATE</span>
        <h2>Learn to build a prediction.</h2>
        <p>
          Frame a real decision. Train a model. Challenge the result. Three
          complete paths through the professional workflow.
        </p>
        <a className="primary" href="#/explore/prediction">
          Open prediction studio <Icon name="ArrowUpRight" size={17} />
        </a>
      </div>
    </section>
  );
}
export function StudioBacklog() {
  return (
    <section className="studio-backlog">
      <span className="eyebrow">CARRIED FORWARD / RELEASE AND MATHEMATICS</span>
      <h2>A visible, honest backlog</h2>
      <p>
        New modeling lessons do not complete the outstanding mathematics
        roadmap. Human reviews remain release gates.
      </p>
      {backlog.map(([status, title, detail]) => (
        <div className="backlog-row" key={title}>
          <span className="status-tag">{status}</span>
          <div>
            <h3>{title}</h3>
            <p>{detail}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
