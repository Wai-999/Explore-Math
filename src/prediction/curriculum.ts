import type { ProjectId } from "./data";
export const stages = [
  "Frame the decision",
  "Know your data",
  "Design evaluation",
  "Build & train",
  "Diagnose errors",
  "Freeze & test",
  "Make a decision",
  "Transfer & rebuild",
];
export interface Project {
  id: ProjectId;
  title: string;
  subtitle: string;
  domain: string;
  icon: "Activity" | "SlidersHorizontal" | "Layers3";
  contract: [string, string][];
  features: { label: string; available: boolean; why: string }[];
  baseline: string;
  split: string;
  intuition: string;
  foundations: string;
  advanced: string;
  research: string;
  pitfall: string;
  worked: string;
  transfer: string;
  decision: string;
}
export const projects: Record<ProjectId, Project> = {
  energy: {
    id: "energy",
    title: "Predict tomorrow’s energy",
    subtitle: "Construct a regression model, one decision at a time.",
    domain: "REGRESSION / OPERATIONS",
    icon: "Activity",
    contract: [
      [
        "Decision",
        "Schedule tomorrow’s energy purchase; the facilities manager owns the decision.",
      ],
      [
        "Observation",
        "One factory-day. Population: future days at this same factory.",
      ],
      [
        "Prediction time",
        "Today at 18:00, after tomorrow’s production schedule is approved.",
      ],
      [
        "Target",
        "Tomorrow’s energy use, kWh/day; metered and available the following morning.",
      ],
      [
        "Available inputs",
        "Forecast temperature index and planned production; both recorded before 18:00.",
      ],
      [
        "Costs & guardrails",
        "Underbuying creates shortage cost; overbuying wastes budget. Compare MAE and bias; monitor warm/cool days.",
      ],
      [
        "Stop rule",
        "Do not recommend even a pilot if test MAE does not beat the mean baseline or material bias remains.",
      ],
    ],
    features: [
      {
        label: "Tomorrow’s temperature forecast issued today",
        available: true,
        why: "Forecast issuance precedes the cutoff; this is not tomorrow’s realized weather.",
      },
      {
        label: "Tomorrow’s production schedule approved at noon",
        available: true,
        why: "A future plan is usable when known by prediction time.",
      },
      {
        label: "Tomorrow’s final meter reading",
        available: false,
        why: "This is the target itself, unavailable at prediction time.",
      },
      {
        label: "Yesterday’s corrected invoice first released tomorrow",
        available: false,
        why: "Past event time does not make a late publication available.",
      },
    ],
    baseline:
      "Training-period mean energy use. Its mean is fitted on training rows only.",
    split:
      "Chronological days: 100 train, 40 validation, 40 untouched test. The example uses exactly these partitions; real durations depend on seasonality and label delay.",
    intuition:
      "Prediction combines clues. Start from a typical day, then adjust for temperature and planned production. A useful pattern must work on later days, not just explain days already seen.",
    foundations:
      "The model is ŷ = b + w₁x₁ + w₂x₂. Training minimizes half the mean squared error in standardized target units, plus λ‖w‖²/2. MAE for the manager is reported back in kWh/day. Intercept b is not penalized.",
    advanced:
      "Feature means/scales and target scaling come from training only. Ridge shrinks coefficients and can stabilize correlated inputs, at the cost of bias. A gradient step subtracts learning rate times the objective gradient; loss reduction alone does not establish generalization.",
    research:
      "Conditional mean prediction under squared loss differs from conditional median prediction under absolute loss. Heteroscedasticity, omitted causes, changing measurement, and selection bias limit intervals and interpretation. Predictive coefficients do not identify the causal effect of changing production.",
    pitfall:
      "Adding tomorrow’s final meter reading produces an impressive but impossible forecast. Turning on the leakage demo is allowed for diagnosis, but freezing that model is blocked.",
    worked:
      "Tiny example: y = [100,120], predictions [90,130]. Residuals (prediction − actual) are [−10,10]. MAE = 10 kWh/day, bias = 0; zero bias can hide large errors. With standardized x=2, prediction=0, target=1, one-row weight gradient is −2; rate 0.1 moves w from 0 to 0.2.",
    transfer:
      "A cold-storage warehouse wants next-day electricity use. Which variables are available before the cutoff, and what changes if equipment schedules are revised overnight?",
    decision:
      "An offline improvement can justify a monitored pilot, not unattended purchasing. Retain a manual fallback and check meter completeness.",
  },
  maintenance: {
    id: "maintenance",
    title: "Decide what to inspect",
    subtitle: "Turn probabilities into decisions with explicit error costs.",
    domain: "CLASSIFICATION / ENGINEERING",
    icon: "SlidersHorizontal",
    contract: [
      [
        "Decision",
        "Choose which machines technicians inspect. Capacity: at most 12 alerts per batch of 40 evaluated inspection snapshots.",
      ],
      [
        "Observation",
        "One inspection snapshot per machine; four correlated historical snapshots per synthetic machine.",
      ],
      [
        "Prediction time",
        "Before an inspection shift, using sensors already recorded.",
      ],
      [
        "Target",
        "Failure in the next 48 hours; the label matures only after that window.",
      ],
      [
        "Available inputs",
        "Vibration and heat indices; no post-failure repair records. All training labels must have matured before deployment.",
      ],
      [
        "Costs & guardrails",
        "Illustrative missed failure cost = 10 units; false alarm = 1. Track recall, calibration, cost, and alert capacity.",
      ],
      [
        "Stop rule",
        "Reject an inspection policy that exceeds capacity or costs more than the prevalence baseline. No safety certification is implied.",
      ],
    ],
    features: [
      {
        label: "Vibration recorded before the shift",
        available: true,
        why: "The measurement already exists when predicting.",
      },
      {
        label: "Heat index recorded before the shift",
        available: true,
        why: "The measurement already exists when predicting.",
      },
      {
        label: "Repair action taken after the failure",
        available: false,
        why: "An outcome-dependent record leaks what happened later.",
      },
      {
        label: "Label from a snapshot only 12 hours ago",
        available: false,
        why: "The full 48-hour outcome window has not matured.",
      },
    ],
    baseline:
      "Training failure prevalence as a constant probability. Apply the same selected threshold and costs to model and baseline.",
    split:
      "Separate whole machines: 28 train, 10 validation, 10 final test; four snapshots each. This tests unseen machines. A real time-and-machine deployment also needs chronological label-maturity constraints.",
    intuition:
      "A probability is a degree of risk. An inspection threshold converts risk into an action. Lowering the threshold catches more failures but can overwhelm technicians with false alarms.",
    foundations:
      "Logistic regression uses p = 1/(1+exp(−z)), z = b + w·x. Stable binary log loss trains probabilities. The threshold is a policy choice, tuned on validation, not a fitted coefficient and not a test-set knob.",
    advanced:
      "Brier score and log loss assess probabilities; recall and precision describe thresholded decisions. Reliability bins compare mean predicted risk with observed frequency and show their counts. A small noisy bin cannot establish reliable calibration. The browser does not fit a calibrator; the Python companion demonstrates validation-only calibration.",
    research:
      "Case mix, device effects, rare outcomes, delayed labels, and alert-driven intervention complicate monitoring. Group splitting addresses shared-entity leakage but does not alone solve temporal leakage. Calibration and discrimination can change independently. Average precision here uses stepped recall increments, not trapezoidal PR area.",
    pitfall:
      "Randomly splitting four snapshots of the same machine into different sets can inflate confidence about generalization to new machines. A low threshold can improve recall while making the operational policy unusable.",
    worked:
      "If TP=3, FP=2, FN=1, TN=4, precision=3/5=0.6 and recall=3/4=0.75. Cost with miss=10, false alarm=1 is 1×10 + 2×1 = 12 units. The denominator changes with the question.",
    transfer:
      "For a new fleet with a lower failure rate, would the same precision necessarily hold? State what must be re-evaluated before reusing the inspection threshold.",
    decision:
      "Compare total cost and the alert count on a frozen policy. Human safety review, capacity planning, and a prospective pilot remain necessary.",
  },
  demand: {
    id: "demand",
    title: "Plan next week’s shelves",
    subtitle: "Build a store-demand forecast that respects the clock.",
    domain: "FORECASTING / BUSINESS",
    icon: "Layers3",
    contract: [
      [
        "Decision",
        "A store manager plans bread replenishment for the following Monday–Sunday.",
      ],
      [
        "Observation",
        "One store-week, packs/store-week, across three synthetic stores. Deployment is future dates at these known stores.",
      ],
      [
        "Prediction time",
        "Sunday 21:00, after the current week is finalized. Horizon: the next complete seven-day week.",
      ],
      [
        "Target",
        "Next week’s realized demand. We assume full stock availability, so recorded sales equal demand. Stockouts would censor the target.",
      ],
      [
        "Available inputs",
        "Previous completed week, calendar season, and a promotion approved before Sunday.",
      ],
      [
        "Costs & guardrails",
        "Underforecast misses sales; overforecast may create waste. Monitor per-store MAE, bias, and interval width/coverage.",
      ],
      [
        "Stop rule",
        "A model must beat seasonal-naïve MAE, preserve acceptable per-store behavior, and survive later regime changes before a pilot.",
      ],
    ],
    features: [
      {
        label: "Sales for the previous completed week",
        available: true,
        why: "Finalized before the Sunday cutoff.",
      },
      {
        label: "Next week’s promotion approved last Friday",
        available: true,
        why: "Availability time matters; a known future plan is legitimate.",
      },
      {
        label: "Next week’s actual checkout total",
        available: false,
        why: "It reveals the very future being predicted.",
      },
      {
        label: "Last week’s waste report first released Tuesday",
        available: false,
        why: "Although its event is in the past, its report arrives after prediction time.",
      },
    ],
    baseline:
      "Seasonal-naïve: same store, 12 weeks earlier. The synthetic calendar deliberately has a 12-week cycle; this is not a claim that retail seasonality universally lasts 12 weeks.",
    split:
      "Training weeks 12–59; validation 60–77; final test 78–95, all stores. Expanding-window development backtests use earlier cutoffs. Labels are non-overlapping weekly totals with no synthetic reporting delay.",
    intuition:
      "Forecasting is a replay of what you could have known at each Sunday. Compare a simple seasonal repeat with a model that can adjust for recent demand and known plans.",
    foundations:
      "Inputs are last week’s demand, a known calendar sine, and a planned promotion. The linear model shares coefficients across stores; the lag carries store-level differences. This predicts one weekly total one week ahead, not a full seven-day demand curve.",
    advanced:
      "Each rolling-origin fit recomputes scaling using only earlier weeks. Validation outcomes guide model choice. Freeze coefficients, preprocessing, inputs, and protocol before exposing the final weeks. A 90% empirical validation residual radius is descriptive and has no guaranteed coverage after a regime change.",
    research:
      "New dates at known stores differ from new stores. To make the latter claim, hold out whole stores. Stockouts, price interventions, promotions chosen because of expected demand, and label revisions change interpretation. Multi-step forecasting needs horizon-specific evaluation; this browser lesson is one-step only.",
    pitfall:
      "Shuffling future and past weeks teaches hindsight. A suspicious future-total feature makes the training curve look excellent, but cannot be supplied at the real Sunday cutoff.",
    worked:
      "Weekly sales [100,120,110,130]. Last-week naïve forecasts [100,120,110] for weeks 2–4 have absolute errors [20,10,20]; MAE=16.67 packs/week. The next forecast is 130. Three errors illustrate arithmetic, not reliable generalization.",
    transfer:
      "An unseen store opens next month. Explain why an evaluation on future weeks at the existing stores does not establish performance for this new store.",
    decision:
      "Forecasts support ordering alongside stock, lead time, spoilage, and service targets. A low forecast error alone does not define the optimal order quantity.",
  },
};
export const perspectives = [
  [
    "Domain expert",
    "Are sales really demand? Check stockouts, label timing, and the physical meaning of each input.",
  ],
  [
    "Statistician",
    "Does this split represent deployment? How much evidence supports each subgroup and interval?",
  ],
  [
    "Data scientist",
    "What does the baseline get right? Which experiment distinguishes leakage from useful signal?",
  ],
  [
    "ML engineer",
    "Save the fitted preprocessing with the model. Validate schema, versions, and prediction-time availability.",
  ],
  [
    "Operations owner",
    "Translate errors into cost and capacity. A better score can still produce a worse operating policy.",
  ],
  [
    "Responsible practitioner",
    "Inspect underrepresented slices, privacy, human review, and the consequences of mistaken predictions.",
  ],
  [
    "Skeptical reviewer",
    "Could repeated test tuning, target proxies, dependent rows, or an easy synthetic generator explain success?",
  ],
];
export const backlog = [
  [
    "NOT RUN",
    "Independent human math and novice transfer reviews",
    "A tested candidate is ready for review; AI review is not independent human evidence.",
  ],
  [
    "NOT RUN",
    "Physical mobile, human screen-reader, and low-end hardware checks",
    "Automated touch, keyboard, axe, and viewport checks do not replace these.",
  ],
  [
    "PARTIAL",
    "Regression/projection and gradient foundations",
    "Working core worlds; professional validation and model-choice lessons added in this candidate.",
  ],
  [
    "PLANNED",
    "Standalone vector missions and complete spectral curriculum",
    "Vector arithmetic missions, full eigensolvers, SVD/PCA visual lessons, rectangular decompositions, and numerical conditioning.",
  ],
  [
    "PLANNED",
    "Calculus and vector-calculus expansion",
    "Discontinuous limits, chain rule, implicit differentiation, Hessians, constraints, multiple integrals/Jacobians, flux, divergence, curl, Gauss/Stokes.",
  ],
  [
    "PARTIAL",
    "Independent practice and delayed retention",
    "Seeded transfer evidence and review dates are recorded; a real delayed-retention study remains pending.",
  ],
];
