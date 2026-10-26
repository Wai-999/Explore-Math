# V2 R1 release and remaining work

October 26, 2026. **Review candidate, not deployed.** Version 0.3.0-rc.1 on `feat/deep-explore-learning-v2`, based on `89e8c998c261949e2be5d253bd815aef8640110a` (`feature/prediction-studio`). The original checkout was clean. No unrelated work or old learner keys were removed.

The public [GitHub Pages site](https://wai-999.github.io/Explore-Math/) remains v0.1. The before-audit records actual live behavior and the last verified Pages source/workflow. V2 production-bundle checks are local checks of `/Explore-Math/`; they are not a deployed-V2 claim. Branch push/PR CI does not publish Pages. Exact candidate commit, PR and CI links are recorded in the PR and final execution report.

## Delivered for review

Four R1 guided concept paths reuse the existing worlds: vectors/projection, matrices/determinant, derivatives/limits and gradients/optimization. Each has definitions, manipulation, two checked worked examples, a justified derivation, assumptions/counterexamples, seeded practice and local evidence. Matrix teaching starts in 2D before optional volume; calculus starts with a curve. Explanation depth is optional and does not lock content.

Two complete template projects cover drone displacement and continuous convex business cost. JSON save/import/export, reports and runnable Python are implemented. The five destinations, existing challenges/applications, prior Prediction Studio and local learning kit remain. See [coverage](CONTENT_COVERAGE.md), [math validation](MATH_AND_PROOF_VALIDATION.md) and [test evidence](TEST_AND_USABILITY_REPORT.md).

## Release decision and exact unblocking work

The previous user-invoked predictive-modeling master prompt requires independent usability/math review before public release of additional mission families (section 7), recorded in [the existing review package](../review/PREDICTION_STUDIO_REVIEW.md). That gate is still pending. The tested V2 PR is prepared for concrete review; the agent does not fabricate participants, approve its own human gate, merge to main or dispatch Pages while the gate remains.

The owner should arrange an independent mathematics educator review and 3–5 novice volunteers using the short protocol in [the usability report](TEST_AND_USABILITY_REPORT.md). Record actual findings, fix material issues, and make the release decision. Human screen-reader, physical touch/orbit/pinch and low-end performance checks also remain. After approval: merge the preserved Prediction Studio dependency, retarget/merge V2 under repository policy, let the existing Pages workflow deploy, then verify the actual public routes, dynamic 3D chunks, SVG/no-WebGL path, proofs, backup migration and project round trip. Only then label V2 DEPLOYED.

R1 is software-complete for this review candidate; the roadmap's beginner-comprehension exit criterion is **not established** by automation or an AI walkthrough. “Machine-checked” is not independent human review, proof-assistant verification or measured learning effectiveness.

## Prioritized backlog carried forward

1. **R1 human evidence and repairs:** review derivations and beginner wording; cold-start vector/derivative transfer and saved project; physical accessibility/device checks; act on observed confusion before broadening content.
2. **R2 complete lessons:** exact systems/row operations; dedicated dot/cross/projection; chain rule; signed integral/FTC; least-squares derivation with rank/QR/SVD caveats. Preserve all R1 tests.
3. **R2 applications and builder:** reach five deeply implemented sectors by adding Physics and an honest Weather/Agriculture exemplar plus a Data Science mathematics project. Complete five safe templates (matrix transform, derivative/function and 2D optimization additions). Existing sectors/readouts do not count as full new guided modules. Add a compact prerequisite map and fresh delayed-review experiments.
4. **R3 advanced foundation:** genuine eigen failure cases, SVD reconstruction/conditioning and centered PCA; Hessian/constrained optimization with boundary checks; multiple integrals/Jacobians and basic fields. No placeholder advanced lesson is published as available.
5. **R4 specialization:** theorem labs with assumptions, differential equations/dynamics, high-dimensional slices, numerical error/sensitivity, further sectors and local-code companions only after correctness and learner evidence support them.

Original Math World backlog remains visible in `docs/RELEASE_STATUS.md`, `docs/PREDICTION_CURRICULUM.md`, and the curriculum order in [coverage](CONTENT_COVERAGE.md). Vector arithmetic and jump/cusp examples now have working R1 lessons; their previous planned status is superseded only for that explicit scope. General SVD/PCA, vector calculus and a full university curriculum remain planned.
