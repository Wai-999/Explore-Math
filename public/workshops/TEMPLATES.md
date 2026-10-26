# Reusable prediction artifacts

## Prediction contract

Decision owner and action; observation grain; deployment population; timestamp/timezone; horizon; target and units; label source and availability delay; feature value/event/publication timestamps; dependencies/groups; exclusions; baseline; primary metric; error costs; capacity; guardrails; minimum useful improvement; stop criteria.

## Experiment record

Hypothesis → evidence that would challenge it → data/split versions → fitted preprocessing → candidate/model/hyperparameters → development search budget → validation result → error slices and sample counts → interpretation → next discriminating action. Record failed experiments too. Keep observations separate from assumptions and conditional recommendations.

## Model card / decision memo

Intended use and prohibited extrapolations; owner; model/data/environment versions; training population and dates; prediction-time availability; evaluation protocol; baseline comparison; uncertainty method and assumptions; subgroup evidence/limitations; proxy/measurement concerns; privacy; failure cost and review capacity; pilot/hold recommendation; manual fallback; monitored schema/missingness/latency/drift/outcome metrics; label delay; rollback and retraining criteria.

## Independent assessment rubric

- Target and cutoff defined unambiguously, including units and label delay.
- Inputs justified by availability time; target proxies and late records rejected.
- Split represents intended deployment and keeps dependent groups appropriately separated.
- Baseline is fitted or generated without leakage; preprocessing remains inside training folds.
- Metrics and thresholds match operational costs; zero denominators and small samples are acknowledged.
- Final protocol frozen before test access; revisions after test feedback are declared new development.
- Model decision is conditional on evidence, costs, population coverage, and safeguards.
- Learner explains a fresh example without worked guidance and repeats after a delay.

Structured numeric checks can be automated. Assessing the learner's explanation, causal claims, and transfer requires human review; do not convert this checklist into an uncalibrated intelligence/mastery percentage.

## Capstone

Choose a new domain. Submit the contract, data dictionary, availability matrix, split diagram, baseline, reproducible pipeline, failed-experiment log, frozen evaluation, limitations, operating plan, and a brief explanation of why prediction does not identify the effect of an intervention. Include one deliberately broken protocol and its repair. Keep final-test labels sealed while comparing candidates.
