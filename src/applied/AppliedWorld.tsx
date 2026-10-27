import { lazy, Suspense } from "react";
import Gallery from "./Gallery";
const Sales = lazy(() =>
  Promise.all([import("./WorldStage"), import("./models/sales")]).then(
    ([c, m]) => ({
      default: ({
        projectId,
        initialLevel,
      }: {
        projectId?: string;
        initialLevel?: number;
      }) => (
        <c.default
          definition={m.definition}
          projectId={projectId}
          initialLevel={initialLevel}
        />
      ),
    }),
  ),
);
const Marketing = lazy(() =>
  Promise.all([import("./WorldStage"), import("./models/marketing")]).then(
    ([c, m]) => ({
      default: ({
        projectId,
        initialLevel,
      }: {
        projectId?: string;
        initialLevel?: number;
      }) => (
        <c.default
          definition={m.definition}
          projectId={projectId}
          initialLevel={initialLevel}
        />
      ),
    }),
  ),
);
export default function AppliedWorld({
  id,
  projectId,
}: {
  id?: string;
  projectId?: string;
}) {
  const [world, query] = (id || "").split("?");
  const n = Number(new URLSearchParams(query).get("level"));
  return (
    <Suspense fallback={<p>Opening the computed world…</p>}>
      {world === "sales" ? (
        <Sales
          projectId={projectId}
          initialLevel={[1, 2, 3].includes(n) ? n : undefined}
        />
      ) : world === "marketing" ? (
        <Marketing
          projectId={projectId}
          initialLevel={[1, 2, 3].includes(n) ? n : undefined}
        />
      ) : (
        <Gallery />
      )}
    </Suspense>
  );
}
