import { lazy, Suspense } from "react";
import type { Definition } from "./types";
import Gallery from "./Gallery";
type Props = { projectId?: string; initialLevel?: number };
const view = (loader: () => Promise<{ definition: Definition }>) =>
  lazy(() =>
    Promise.all([import("./WorldStage"), loader()]).then(([c, m]) => ({
      default: (props: Props) => (
        <c.default definition={m.definition} {...props} />
      ),
    })),
  );
const views: Record<string, ReturnType<typeof view>> = {
  sales: view(() => import("./models/sales")),
  marketing: view(() => import("./models/marketing")),
  ml: view(() => import("./models/ml")),
  robotics: view(() => import("./models/robotics")),
  finance: view(() => import("./models/finance")),
};
export default function AppliedWorld({
  id,
  projectId,
}: {
  id?: string;
  projectId?: string;
}) {
  const [world, query] = (id || "").split("?"),
    n = Number(new URLSearchParams(query).get("level")),
    View = views[world];
  return (
    <Suspense fallback={<p>Opening the computed world…</p>}>
      {View ? (
        <View
          projectId={projectId}
          initialLevel={[1, 2, 3].includes(n) ? n : undefined}
        />
      ) : (
        <Gallery />
      )}
    </Suspense>
  );
}
