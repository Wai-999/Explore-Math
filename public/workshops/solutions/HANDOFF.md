# Handoff exercise — worked reasoning

Attempt the handoff notebook's final exercise before reading this page.

The first outcome arrives at hour 48 and has residual prediction − actual = −4. The second arrives at hour 60 and has residual +8.

- Hour 48: two issued predictions, one labeled, one pending. MAE = 4 kWh/day, signed bias = −4 kWh/day. These metrics describe one observed outcome; they do not imply the missing outcome has zero error.
- Hour 60: two labeled, zero pending. MAE = (4+8)/2 = 6 kWh/day. Bias = (−4+8)/2 = +2 kWh/day; RMSE = √40 ≈ 6.325 kWh/day.

Availability time controls whether a label can enter an as-of report. The label must also arrive after the forecast window ends. Duplicate IDs would multiply the denominator; unknown IDs may join the wrong population; both are rejected.

An input outside a training range can warn about extrapolation before labels arrive. It does not establish a change in prediction error. Values inside individual ranges can still form unfamiliar combinations. Check units, source publication times, missingness, selection of observed labels, and mature outcome slices. Compare with a baseline on the same eligible rows before making an operating decision.

A valid repair for a late feature requires an actually available value, a different feature, or a new decision/evaluation protocol. Merely changing its metadata to an earlier time does not repair a real data source.
