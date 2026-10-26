# Prediction Studio — concrete review package

Status: implemented review candidate on `feature/prediction-studio`. This package does **not** record a completed human review. Existing public v0.1 remains the production release until the gate in the user’s predictive-modeling master prompt, section 7, is satisfied: “Honor the prior usability gate before releasing additional mission families.”

Review the source and CI in [draft PR #1](https://github.com/Wai-999/Explore-Math/pull/1).

## Open the candidate

```sh
npm ci
npm run dev
```

Open `/Explore-Math/#/explore/prediction` on the printed local URL. All five existing destinations remain; Prediction studio is inside Explore and linked from Discover, Challenges, Applications, and My Learning. No account or remote compute is required. Download the self-contained Python kit from stage 8, or use public/workshops directly.

## Expert mathematics/modeling review — NOT RUN

Ask an independent reviewer to inspect:

- Prediction contracts, units, feature-availability times, and label delay/censoring caveats for all three projects.
- Linear and logistic gradients, training-only scaling, unpenalized intercept, and regularization conventions.
- Chronological forecasts, whole-machine partitions, rolling cutoffs, and calibration/policy separation.
- Metric denominators, ties in average precision/AUC, undefined values, cost/capacity arithmetic, and bias sign.
- Empirical validation residual bands: descriptive, not guaranteed conditional/future coverage. Group/time dependence is disclosed.
- One-split tree is labeled as a small greedy baseline. Browser and notebook estimators with different regularization/optimization need not return identical coefficients.
- The public UCI notebook excludes realized future weather and target-component counts. Its data is historical observed rentals, not current unconstrained demand.
- A frozen test is a learning convention, not secure proctoring; inspecting it to revise the model changes its role to development feedback.

Record reviewer/date, file/lesson, observation, severity, proposed correction, verification evidence, and final disposition. Automated tests and author review cannot fill this role.

## First-time learner usability/transfer session — NOT RUN

Ask the learner to think aloud through one project without opening stage-8 guidance:

1. State the decision, prediction timestamp, target, units, and one important assumption.
2. Classify a known future promotion and a late report about a past event by availability time; explain the difference.
3. Choose chronological versus grouped evaluation and explain the intended generalization claim.
4. Predict what adding the future outcome will do to apparent validation performance; run the controlled mistake and repair it.
5. Train one step, then a batch; distinguish training objective from outcome-unit validation error.
6. Freeze the protocol, open final evidence once, and give a conditional pilot/hold recommendation using the declared rubric.
7. Rebuild the baseline or a metric on a fresh seed before seeing the solution; explain transfer to another domain.
8. Return after seven days for a new example. Record this as a retention observation, not a scientifically established learning gain.

Record completion, errors/misconceptions, points of confusion, assistance given, and whether the learner can state what changed and why. Do not infer comprehension from a button click or a memorized number. Human feedback is required for the free-text rationale; automated grading checks only structured answers.

## Accessibility/hardware review — NOT RUN unless separately evidenced

Use VoiceOver or NVDA for a complete keyboard journey, equations, radio groups, saved journals, backup migration, frozen controls, and status feedback. Test real mobile touch, orbit/pinch in the existing worlds, numeric alternatives, reduced motion, both themes, font enlargement, and high zoom. Measure a representative low-end device, idle/battery behavior, training latency, and the 3D fallback. Browser automation and axe scans are supplementary evidence.

## Release decision

Merge and publish the candidate only after required reviewer observations are recorded and material defects resolved. Keep individual checks PASS/FAIL/NOT RUN and retain the older mathematics backlog. A successful CI run does not turn pending human review into PASS. No public release claim is made for this branch.

## Additional handoff review — NOT RUN

After the final evaluation, expand **Use the frozen model on a new batch** in step 7. Explain which fitted transforms and versions must travel with coefficients. Export the model, score the provided inputs, and reproduce its predictions with the kit's `serve.py`. Reject a late input, distinguish an input-range warning from measured error, and review labels at hour 0 and at the declared arrival. Attempt the fifth notebook's staggered-arrival exercise before reading `solutions/HANDOFF.md`.

Inspect matching/duplicate IDs, label-window maturity, pending denominators, source-time trust, selective labels, the limited portable model format, the explicitly fabricated outcomes, and the absence of automatic rollout/retraining. These are additional concrete human review tasks, not completed observations.
