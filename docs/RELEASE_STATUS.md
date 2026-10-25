# Release status

## Current review candidate: 0.2.0-rc.1

IMPLEMENTED AND TESTED FOR REVIEW on `feature/prediction-studio`. Three eight-stage predictive-modeling paths, persistent frozen evaluation, schema-v1 migration, decision journals, and four executed Python notebooks are added. See PREDICTION_CURRICULUM.md for the explicit COMPLETE/PARTIAL/PLANNED/NOT RUN audit.

Review candidate: [draft PR #1](https://github.com/Wai-999/Explore-Math/pull/1). [Implementation CI](https://github.com/Wai-999/Explore-Math/actions/runs/40215489852) passed the browser and Python-workshop jobs. See TEST_REPORT.md for exact counts, environment limits, and the separately executed production-bundle checks.

Public release of the new mission families awaits the independent human usability/math review required by section 7 of the user's predictive-modeling master prompt. The review instructions and concrete learner tasks are in review/PREDICTION_STUDIO_REVIEW.md. No human-review result is fabricated. The existing public v0.1 release described below is historical, verified evidence and remains unchanged until the candidate is approved through that gate.

## Previously deployed release: 0.1.0

DEPLOYED: first playable candidate, version 0.1.0. Independent human educational and mathematics review remains pending.

- Live site: https://wai-999.github.io/Explore-Math/
- Repository: https://github.com/Wai-999/Explore-Math
- Branch: main
- Verified application commit: 18da920fd5c4a4701bc313cb1394323a981b5aeb
- Green deployment: https://github.com/Wai-999/Explore-Math/actions/runs/40173431632
- Green CI: https://github.com/Wai-999/Explore-Math/actions/runs/40173431620
- Live HTTP 200 and 10/10 Chromium interaction tests on October 25, 2026, including 3D dragging and mathematical mission completion.
- Local evidence: 32 math/content tests, 30 browser tests across Chromium/Firefox/WebKit, and 10 production-bundle browser tests. Linux CI: 28 passed and 2 explicit WebGL-only skips. Real 3D checks ran in all three engines locally.

Implemented: matrix/basis transformation world; determinant/rank/singularity and projection readouts; invariant xy-block eigenpairs; seeded satellite challenge; convex and nonconvex gradient landscapes; finite differences/tangent planes; x² secants and four quadrature rules; three applied missions; five destinations; depth preferences; themes; local evidence/bookmarks and validated export/import; SVG fallback.

Planned: standalone vector arithmetic missions, full eigensolvers, SVD/PCA, general limits/discontinuities, chain-rule scenes, multiple integrals and Jacobians, vector fields and vector calculus, constrained optimization, higher-dimensional slices, content expansion, and delayed-retention assessment.

Experiment parameter positions are session-local and reset on reopening a world; learning evidence and preferences persist. Two-valley fallback contours are illustrative and labeled. No independent human expert or novice review has occurred. No hardware FPS promise is made.

Next review priorities: an independent mathematics educator, a real novice transfer session, human screen-reader navigation, physical touch orbit/pinch, and measured low-end performance. The larger advanced curriculum remains a roadmap.
