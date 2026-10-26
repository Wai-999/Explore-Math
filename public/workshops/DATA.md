# Data dictionary and provenance

## Original synthetic browser/notebook datasets v1

Generated locally with the same 32-bit LCG in TypeScript and Python: state = (1664525×state + 1013904223) mod 2³²; draw = state/2³². Default seed 42; alternatives 59, 76, etc. Original teaching data, MIT licensed. No personal data or live observations. The complete generator is in workshop.py and src/prediction/data.ts.

All rows: `id` unique row key; `entity` dependent-group key; `time` ordered synthetic index; `x` eligible input list; `y` observed target; `baseline` prediction using information allowed by the protocol; `segment` descriptive operational slice; `split` fixed train/validation/test membership. Generated fields are complete, finite, and duplicate-free by construction. This is not a realistic audit of missingness, joins, censoring, or label error.

**energy**: 180 factory-days; first 100 train, next 40 validation, last 40 final. x = temperature forecast index and planned-production index, both unitless standardized physical scales generated uniformly in [−2,2]. y = max(1,90+12×temperature+18×production+5×noise), in kWh/day. Noise = sum of four independent uniform draws minus 2. Target is available the following morning. Baseline is the training target mean. Final-period shift adds 25 kWh/day; it does not change training/validation.

**maintenance**: 48 machines × four correlated snapshots. Machines 0–27 train, 28–37 validation, 38–47 final. x = vibration/heat indices in [−2,2]. y ∈ {0,1} is a Bernoulli draw with p = sigmoid(−2.5+1.35×vibration+0.9×heat+machine effect). Outcome horizon 48 hours. The synthetic grouping tests unseen machines; there is no realistic multi-day label clock in the generator. Real deployment needs additional label-maturity/time restrictions. Final shift adds 1.3 to failure logits. Baseline is training prevalence. Mistake costs: miss 10, false alert 1, illustrative units. Capacity 12 alerts per 40 snapshots is an educational planning convention, not a real simultaneous-machine roster. Calibration uses validation machines 28–32, policy selection 33–37.

**demand**: three stores, 96 generated weeks each. Weeks 0–11 initialize seasonal lag; model rows cover 12–95. Train 12–59, validation 60–77, final 78–95. x = previous completed week's packs, sin(2πweek/12), and an approved promotion indicator. y = max(0,100+25×store+0.65×week+18×season+15×promotion+5×noise), packs/store-week. Promotion probability 0.22. Prediction cutoff is Sunday 21:00 for the following complete week. Assumed no stockouts and immediate finalized weekly totals. Baseline is the same store's outcome 12 weeks earlier. The 12-week cycle is synthetic, not an empirical retail claim. Final shift adds 30 packs/week; observed future lags then naturally reflect completed shifted weeks. Development rolling cutoffs 42,48,54 predict each following six weeks; all precede final week 78.

## UCI daily Bike Sharing extension

- Citation: Fanaee-T, H. (2013). Bike Sharing [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5W894
- Source: https://archive.ics.uci.edu/dataset/275/bike+sharing+dataset
- Download: https://archive.ics.uci.edu/static/public/275/bike+sharing+dataset.zip
- License: Creative Commons Attribution 4.0 International, https://creativecommons.org/licenses/by/4.0/
- Retrieved October 25, 2026. Original day.csv: 731 rows, January 1, 2011–December 31, 2012.
- Original day.csv SHA-256: a6bcf826782d3c0fbfdcbeead17cd0884185a0dafe8ff10cd48a874ee7ba18be
- Transformation: CSV records transcribed to data/bike-day.json with original column names/string values preserved. No rows removed in transcription. Notebook discards the first seven rows to construct lag-7, then splits chronologically into development train, 90 validation days, 90 final days. Source Readme.txt is retained.
- Target `cnt` is observed daily rentals (`casual` + `registered`), not necessarily unconstrained demand. Eligible tutorial features are prior-day/prior-week totals and known calendar. Realized same-day weather, temperature, humidity, casual/registered counts are excluded. There are no historical weather-forecast issue timestamps in the bundled source. No real-time system deployment claim follows from these old records.

## Method references

- https://scikit-learn.org/stable/common_pitfalls.html
- https://scikit-learn.org/stable/modules/cross_validation.html
- https://scikit-learn.org/stable/modules/model_evaluation.html
- https://scikit-learn.org/stable/modules/calibration.html
- https://scikit-learn.org/stable/modules/compose.html
- https://scikit-learn.org/stable/modules/decomposition.html
- https://otexts.com/fpp3/toolbox.html
