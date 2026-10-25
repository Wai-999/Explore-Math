# Adding a scene

1. Define a small pure domain model in `src/math`. State inputs must be finite, bounded, and documented with units. Return undefined/degenerate status, not invented answers.
2. Add a typed lesson contract in `src/content/lessons.ts`: outcomes, prerequisites, plain-English question, all four explanation depths, misconception, and source IDs.
3. Extend the discriminated `SceneProps` union in `src/engine/GeometryView.tsx`. Implement a numeric/2D alternative first. Then add the corresponding procedural ThreeStage content. Keep coordinates and visualization scaling explicit.
4. Reuse SceneFrame, Range, Formula, Metric, Prediction, and LessonExplanation. ThreeStage is dynamically imported. Keep expensive mathematics out of render components; compute a pure model with useMemo in the world controller, then pass values to rendering and grading.
5. Define challenge targets, units, tolerances, predictions, hints, and evidence. Use `seeded` when introducing variants. A worked solution must mark the applied attempt guided. Record independent mathematical outcomes through LearningContext, never through a pixel location.
6. Test identities and degeneracies, then add a browser journey with a fresh example. Run accessibility in both themes and test without WebGL. New advanced topics remain roadmap entries until their interactions, explanations, and checks work.

The engine deliberately has a small discriminated union rather than a general formula DSL. The three application controllers share infrastructure but keep their small domain formulas separate. `src/persistence/storage.ts` is the authoritative v1 backup validator. A future schema migration must preserve the old raw backup before modifying it.
