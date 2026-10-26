# V2 R1 preview release and remaining work

October 26, 2026. Version **0.3.0-preview.1**. The owner explicitly selected “Publish as preview; human reviews remain pending.” This supersedes the earlier human-review hold for preview publication, while leaving the actual reviews NOT RUN. The application labels the release PREVIEW and explains pending reviews in My Learning. Automated tests do not establish beginner comprehension or educational effectiveness.

Source: `feat/deep-explore-learning-v2`, based on the preserved Prediction Studio head `89e8c99`. Implementation/evidence commits include `a6beb27`, `608d341` and `a351c19`, followed by the preview-release changes. [V2 PR #2](https://github.com/Wai-999/Explore-Math/pull/2) contains the exact final source head, CI results and actual Pages/live verification evidence. [Prior candidate CI](https://github.com/Wai-999/Explore-Math/actions/runs/40358675047) passed 165 unit tests, 85 Linux browser tests with two explicit WebGL-only skips, 18 Python tests and all five notebooks. Local browser results were 87/87 and production-bundle results 29/29.

Target: the existing [GitHub Pages site](https://wai-999.github.io/Explore-Math/). Publication is claimed only after the existing workflow succeeds and real live journeys pass. Branch CI alone does not publish Pages. No learner keys, old routes, existing missions or prior project work are removed.

## Delivered for review

Four R1 guided concept paths reuse the existing worlds: vectors/projection, matrices/determinant, derivatives/limits and gradients/optimization. Each has definitions, manipulation, two checked worked examples, a justified derivation, assumptions/counterexamples, seeded practice and local evidence. Matrix teaching starts in 2D before optional volume; calculus starts with a curve. Explanation depth is optional and does not lock content.

Two complete template projects cover drone displacement and continuous convex business cost. JSON save/import/export, reports and runnable Python are implemented. The five destinations, existing challenges/applications, prior Prediction Studio and local learning kit remain. See [coverage](CONTENT_COVERAGE.md), [math validation](MATH_AND_PROOF_VALIDATION.md) and [test evidence](TEST_AND_USABILITY_REPORT.md).

## Preview decision and checks still open

The earlier predictive-modeling master prompt required human usability/math review before additional mission families. The owner's later explicit preview-publication instruction changes that release condition. No human review result is fabricated or inferred from the owner's authorization.

Merge the preserved Prediction Studio dependency, retarget/merge V2 under repository policy, let the existing Pages workflow deploy, then verify the actual public routes, dynamic 3D chunks, SVG/no-WebGL path, proofs, backup migration, application missions and project round trip. Keep the working tree clean and record the actual workflow/source/live results in PR #2 and the execution handoff. A green build without live interactions is insufficient.

An independent mathematics educator, 3–5 novice volunteers, human screen-reader users, physical touch/orbit/pinch and low-end performance checks remain open. Use [the review protocol](TEST_AND_USABILITY_REPORT.md), record actual findings and fix material issues before claiming human validation or educational effectiveness. The roadmap's beginner-comprehension exit criterion remains unestablished. “Machine-checked” is not human review or formal proof-assistant verification.

## Prioritized backlog carried forward

1. **R1 human evidence and repairs:** review derivations and beginner wording; cold-start vector/derivative transfer and saved project; physical accessibility/device checks; act on observed confusion before broadening content.
2. **R2 complete lessons:** exact systems/row operations; dedicated dot/cross/projection; chain rule; signed integral/FTC; least-squares derivation with rank/QR/SVD caveats. Preserve all R1 tests.
3. **R2 applications and builder:** reach five deeply implemented sectors by adding Physics and an honest Weather/Agriculture exemplar plus a Data Science mathematics project. Complete five safe templates (matrix transform, derivative/function and 2D optimization additions). Existing sectors/readouts do not count as full new guided modules. Add a compact prerequisite map and fresh delayed-review experiments.
4. **R3 advanced foundation:** genuine eigen failure cases, SVD reconstruction/conditioning and centered PCA; Hessian/constrained optimization with boundary checks; multiple integrals/Jacobians and basic fields. No placeholder advanced lesson is published as available.
5. **R4 specialization:** theorem labs with assumptions, differential equations/dynamics, high-dimensional slices, numerical error/sensitivity, further sectors and local-code companions only after correctness and learner evidence support them.

Original Math World backlog remains visible in `docs/RELEASE_STATUS.md`, `docs/PREDICTION_CURRICULUM.md`, and the curriculum order in [coverage](CONTENT_COVERAGE.md). Vector arithmetic and jump/cusp examples now have working R1 lessons; their previous planned status is superseded only for that explicit scope. General SVD/PCA, vector calculus and a full university curriculum remain planned.
