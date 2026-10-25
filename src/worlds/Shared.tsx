import { useLearning } from "../app/LearningContext";
import type { Lesson } from "../content/lessons";
import { Icon } from "../components/Icon";
export function LessonExplanation({ lesson }: { lesson: Lesson }) {
  const { learning, update } = useLearning(),
    bookmarked = learning.bookmarks.includes(lesson.id);
  return (
    <section className="lesson-explanation">
      <div className="explanation-heading">
        <span className="eyebrow">THE IDEA BEHIND THE INTERACTION</span>
        <button
          className={"icon-button " + (bookmarked ? "bookmarked" : "")}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark lesson"}
          onClick={() =>
            update({
              ...learning,
              bookmarks: bookmarked
                ? learning.bookmarks.filter((x) => x !== lesson.id)
                : [...learning.bookmarks, lesson.id],
            })
          }
        >
          <Icon name="Bookmark" size={17} />
        </button>
      </div>
      <h2>{lesson.question}</h2>
      <p>{lesson[learning.depth]}</p>
      <details>
        <summary>How does this work?</summary>
        <p>{lesson.foundations}</p>
        <p>{lesson.advanced}</p>
        <p>
          <strong>Watch out:</strong> {lesson.pitfall}
        </p>
        <p>Prerequisites: {lesson.prerequisites.join(", ")}.</p>
        <ul>
          {lesson.objectives.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
      <button
        className="text-button"
        onClick={() => {
          const el = document.getElementById("replay-" + lesson.id);
          if (el) el.textContent = lesson.intuition;
        }}
      >
        Replay explanation <Icon name="RotateCcw" size={15} />
      </button>
      <p id={"replay-" + lesson.id} className="caption" aria-live="polite" />
    </section>
  );
}
