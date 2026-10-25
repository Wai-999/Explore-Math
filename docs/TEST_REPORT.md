# Test report

Date: October 25, 2026 (America/Los_Angeles). Application source: `18da920fd5c4a4701bc313cb1394323a981b5aeb` on main. Results below are executed evidence, not independent educational validation.

## Executed commands

| Command                                                                                                    | Result | Evidence                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| Locked dependency install                                                                                  | PASS   | Exact package versions; npm reported zero vulnerabilities.                                      |
| `npm run typecheck`                                                                                        | PASS   | Strict TypeScript, including browser tests.                                                     |
| `npm run lint`                                                                                             | PASS   | ESLint and React hooks rules, zero errors.                                                      |
| `npm run format:check`                                                                                     | PASS   | Source, configuration, and documentation formatted.                                             |
| `npm test`                                                                                                 | PASS   | 32 mathematical/content/backup tests.                                                           |
| `npx playwright test --reporter=line`                                                                      | PASS   | 30/30 locally: Chromium 156, Firefox 157, WebKit 27.2; no local skips.                          |
| `TEST_BASE_URL=http://127.0.0.1:4174/Explore-Math/ npx playwright test --project=chromium --reporter=line` | PASS   | 10/10 against the final built static bundle, including lazy 3D chunks.                          |
| `npm run build`                                                                                            | PASS   | Production bundle emitted; lazy 3D chunk-size advisory documented below.                        |
| axe through browser tests                                                                                  | PASS   | No serious/critical violations across seven essential routes, both themes, three local engines. |
| External-request check                                                                                     | PASS   | Complete touch-control journey requested no external services.                                  |

Some sliders are set with native DOM input/change events to exercise application handlers; separate keyboard, pointer, real 3D raycast, and touch-tap tests cover actual interaction mechanisms. These are not all keyboard-only human journeys.

## Master-prompt acceptance mapping

| ID  | Result  | Evidence and limits                                                                                                                                                |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | PASS    | Rotations about three axes preserve norms, determinant, and inverse recovery.                                                                                      |
| 2   | PASS    | Reflection determinant −1; rank-two and rank-zero singular cases.                                                                                                  |
| 3   | PASS    | det(AB)=det(A)det(B) on fixed nontrivial matrices.                                                                                                                 |
| 4   | PASS    | Ordered camera rotations produce different directions.                                                                                                             |
| 5   | PASS    | Inverse recovery; singular/near-singular rejection; small uniform scale remains invertible.                                                                        |
| 6   | PASS    | Known xy eigenpairs satisfy Av=λv; planar quarter-turn returns complex status.                                                                                     |
| 7   | NOT RUN | SVD is planned, not a playable feature.                                                                                                                            |
| 8   | PASS    | Two polynomial gradients match central differences; secant converges to derivative.                                                                                |
| 9   | PASS    | Tangent plane value and slope agree with a quadratic surface.                                                                                                      |
| 10  | PASS    | Four quadrature rules approach 8/3; reversed bounds are signed; invalid n rejected.                                                                                |
| 11  | PASS    | Safe step decreases energy, large step overshoots, saddle remains stationary.                                                                                      |
| 12  | PASS    | NaN/infinity/extreme validators, zero/tiny bases, invalid quadrature, rejected domain exits, and scaled inverse tests. Arbitrary user functions are not supported. |
| 13  | PASS    | SVG and real 3D drags update matrix state; table/metrics share the model.                                                                                          |
| 14  | PASS    | Native keyboard matrix edits and pointer edits use the same state pipeline.                                                                                        |
| 15  | PASS    | Calculus controls change gradient, energy, and scene; finite-step error is displayed.                                                                              |
| 16  | PASS    | Reset returns identity and restarts feedback/prediction; home camera retains matrix.                                                                               |
| 17  | PASS    | Seeded matrix target, energy threshold, direction tolerance, marginal-profit units, attainable MSE.                                                                |
| 18  | PASS    | Simulated 390×844 touch taps, pointer capture, bounded camera controls, responsive layouts. Physical mobile pinch/drag remains NOT RUN.                            |
| 19  | PASS    | Theme/progress/bookmarks survive reload; validated export/restore and backup-before-import. Experiment positions reset on reopening a world.                       |
| 20  | PASS    | Forced WebGL2 absence and actual WEBGL_lose_context preserve mathematical state in functional SVG/numeric mode.                                                    |
| 21  | PASS    | Reduced-motion and native keyboard matrix controls; skip link and main focus. Human screen-reader journey is NOT RUN.                                              |
| 22  | PASS    | Production /Explore-Math/ bundle, every destination, refresh/deep links, dynamic modules.                                                                          |
| 23  | NOT RUN | Automated unfamiliar-parameter journeys pass. No actual novice has been observed explaining and transferring the ideas.                                            |

## Repaired regressions

- Regression target 0.025 was impossible: optimum MSE is 0.0288. Final target is <0.030.
- Light-theme inheritance and faint-label contrast failed axe; both themes now pass.
- Intentional 3D unmount reported context loss; notification now requires a connected canvas.
- DOM labels from a 3D helper caused removeChild errors; procedural texture labels removed that coupling. All 30 browser tests then passed.
- Absolute determinant thresholds misclassified small uniform scales; the inverse threshold is now scale-relative and rank is labeled numerical.
- Tiny Gram–Schmidt projections could be null; the degenerate case now returns safely and has a regression test.
- Initial Linux CI lacked Firefox WebGL2. A 3D-only test now waits for capability detection and skips unavailable rendering; fallback tests still run. Local macOS ran actual 3D in all three engines.
- The first Pages run failed at configure-pages because Pages was disabled. Pages was then enabled with build_type=workflow; final status is in RELEASE_STATUS.

## Bundle and open checks

Static assets total approximately 2.88 MB uncompressed, including local font formats. Initial application JS is about 18.9 kB gzip, plus React 68.3 kB and the small runtime. KaTeX is about 77.7 kB gzip, lazy with mathematical worlds. ThreeStage is about 253.7 kB gzip, loaded only for 3D; Vite emits a >500 kB uncompressed chunk advisory. Pixel ratio is capped at 1.5, surface resolution is 40×40, and rendering is on demand.

NOT RUN: independent human math review, real novice evaluation, VoiceOver/NVDA audit, physical touch devices, low-end FPS/battery measurement, and Microsoft Edge specifically. Playwright WebKit is not a claim that the installed Safari application was tested.

Knowledge-graph indexing: NOT RUN. Automatic approval review rejected source transmission to an unspecified MCP destination. Verification continued locally; no bypass was attempted.

Production-browser screenshots are in docs/screenshots. Failure traces go to ignored test-results and CI artifacts.

## Live deployment evidence

- PASS: `TEST_BASE_URL=https://wai-999.github.io/Explore-Math/ npx playwright test --project=chromium --reporter=line`: 10/10 in 20.4 seconds. Includes real 3D dragging, all applied mission graders, backup restore, mobile fallback, both themes, and axe checks.
- PASS: deployment workflow [40173431632](https://github.com/Wai-999/Explore-Math/actions/runs/40173431632); public site returned HTTP 200.
- PASS: CI workflow [40173431620](https://github.com/Wai-999/Explore-Math/actions/runs/40173431620): 28 passed, 2 explicitly skipped 3D-only tests because Firefox in the Linux runner lacks WebGL2. Those two tests ran and passed locally on all three engines. Skips are NOT RUN in that runner, not mathematical passes.
- Deployed and tested code commit: 18da920fd5c4a4701bc313cb1394323a981b5aeb. Subsequent documentation commits do not change the application bundle.
