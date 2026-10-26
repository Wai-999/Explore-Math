# Mathematics validation

## Prediction Studio candidate

The browser uses deterministic synthetic generators and separate pure modules for data, preprocessing/training, metrics, and final-test protocol. Linear/ridge training minimizes half mean squared standardized-target error + λ‖w‖²/2, with an unpenalized intercept. Logistic training uses stable log loss and sigmoid. Training-only means/scales are saved with the model; final rows do not fit parameters or preprocessing.

Executed Python fixtures cross-check first observations, fitted coefficients, and validation metrics in all three browser projects to 10⁻⁸ or better. Separate Python tests compare manual ridge/logistic predictions with scikit-learn pipelines using equivalent penalty conventions (ridge alpha=nλ; logistic C=1/(nλ)). Classification undefined denominators return null; AP handles tied probability groups with stepwise recall increments and is distinct from trapezoidal PR area. ROC-AUC gives tied pairs half credit. The one-split tree is a deliberately small greedy squared-error baseline.

Energy uses chronological factory-days; maintenance holds out complete machines; demand uses chronological weeks across known stores. Rolling development cutoffs precede final weeks. The browser residual radius is the empirical 90th percentile of absolute validation residuals, a descriptive interval with no future/conditional coverage guarantee. The synthetic regime-change control changes only the final population and its subsequently observed lags.

The toy pilot rubric is explicit: regression must beat baseline MAE with absolute bias <10 original units; classification must reduce illustrative cost and produce ≤12 alerts per 40 evaluated snapshots. An injected regime change requires investigation. These are teaching criteria, not universal deployment thresholds. Free-text interpretation is saved for human feedback; structured numeric checks do not certify understanding.

The Python companions additionally verify training-only median imputation, calibration on a distinct validation-machine subset, policy selection without test data, grouped/temporal tuning, nested forward evaluation for energy, SVD reconstruction/orthogonality on rectangular training matrices, and training-only PCA. The full interactive spectral curriculum remains planned. Exact data formulas, licenses, and limitations are in public/workshops/DATA.md.

## Frozen-model handoff

The JSON format preserves training-only feature means/scales, standardized-target inverse transformation, the stable logistic link, or the exact selected tree split/leaf values. Names determine feature order; new batches cannot fit transforms. Published-after-cutoff values, missing/extra fields, nonfinite values, invalid domains, incompatible dimensions/versions, and duplicate row IDs are rejected. Three cross-language tests execute the standalone Python scorer against actual browser-compatible artifacts; separate tree checks verify selected leaves.

Monitoring joins unique matching IDs only. A label's availability must be at least prediction time plus the outcome window, and no later than the review time to count. Future-issued predictions do not enter the denominator. Empty eligible labels produce null metrics. Hand fixtures with residuals −4 and +8 verify MAE 6, bias +2, and RMSE √40; partial maturity reports only available outcomes. Binary metrics use the frozen threshold and explicit undefined denominators. Training-range warnings provide no independent evidence of changed error, and these checks cannot authenticate a source's recorded times.

## Conventions and tolerances

Right-handed x,y,z coordinates, column vectors, row-major storage. A matrix entry at row r and column c has index 3r+c. Columns are transformed unit basis vectors. AB applies B first. Three.js Matrix4 receives explicitly mapped rows. Camera up is mathematical z. SVGs are labeled projections; the numeric state is authoritative. Coordinates are unitless except the explicitly labeled production model.

Rotation inputs are degrees, converted to radians once inside `rotation`. Determinants and inverses use direct 3×3 formulas. A determinant magnitude below 10⁻⁸ times the cube of the maximum absolute entry declines inversion. This scale-relative threshold retains small uniform scalings. Numerical rank uses pivoted elimination at 10⁻⁸ times the maximum absolute entry; numerical nullity depends on that tolerance. It is not a robust general arbitrary-scale rank oracle. Readouts round to three decimals and matrix inputs to four; the underlying state retains double precision. The Frobenius norm product is labeled an upper bound on the spectral condition number. It equals 3 for identity, not 1. Real eigenpairs are computed only for a separate invariant xy block; negative discriminants return complex status with no real arrows. Repeated pairs may name the same eigenspace. Full spectral decompositions and SVD are planned.

The satellite assessment checks all nine entries against a seeded target rotation with absolute tolerance 0.025. A shear with determinant 1 cannot pass merely because it preserves volume. Projection onto a zero vector and Gram–Schmidt on dependent vectors return an explicit undefined/dependent result.

## Calculus

Convex bowl E = (x²+2y²)/2; gradient (x,2y); Hessian diag(1,2). Constant-step unconstrained descent converges for 0 < α < 1. The UI permits α up to 1.2 to expose instability. Proposed points outside [−2.5,2.5]² are rejected and explained, never clamped. A successful route starts at energy ≥0.5, takes at least three steps, and finishes below 0.01.

Two valleys E = (x²−1)²/4+y²/2; gradient (x(x²−1),y). Minima (±1,0); stationary saddle (0,0). Central differences use h=0.001 in the UI and show Euclidean gradient error. Tests use h=10⁻⁵ on nonsingular polynomials. The tangent plane is E(p)+∇E(p)·(q−p). The negative gradient is displayed at 0.4 scale in the parameter plane, not as a misleading 3D surface-normal arrow.

Surface geometry samples 40×40 cells; calculations use the analytic function. Heights are not clipped. The two-valley SVG fallback explicitly labels its contours schematic: its particle coordinate/energy and path are exact, its nested ellipses are illustrative. The bowl contours are exact level sets. The surface has two actual variables; it is not presented as a full high-dimensional model.

For f(x)=x², secant slope is 2x+h, tangent slope 2x, and ∫₀² f = 8/3. Left/right/midpoint/trapezoid rules use the same f. Signed integration accepts reversed bounds. UI uses n=2…64; pure routine accepts integer n=1…1000 and rejects invalid counts. No general-purpose expression parser or arbitrary singular function input is shipped.

## Applications

Camera: initial look direction eₓ; fixed-world yaw about z and tilt about x. Yaw then tilt is RₓRz. Target (45°,60°) produces (√2/2,√2/4,√6/4); reverse order produces (√2/2,√2/2,0). Assessment tolerance is Euclidean direction error <0.025.

Production: p(q)=d−0.8q $/unit, C(q)=100+20q $/day, q∈[0,100] units/day. Profit π=(d−20)q−0.8q²−100; π′=d−20−1.6q; π″=−1.6. Constrained optimum is clamp((d−20)/1.6,0,100). For d=120, q*=62.5, π*=3025. For d=100, q*=50, π*=1900. Assessment accepts |π′|<0.81 $/unit (half-unit slider accuracy). Assumed deterministic demand and fractional output are stated.

Regression: five fixed synthetic training observations and three separate evaluation observations; all unitless. Centered least squares gives slope 1.76, intercept 1.00, training MSE 0.0288. Assessment requires training MSE <0.030 unit², slightly above the achievable optimum. The initial 0.025 target was caught as impossible by a numerical test and corrected before release. Evaluation observations are not used to compute fit coefficients. A fit does not establish causality.

## References and review status

Original explanations and procedural figures, informed by:

- [MIT 18.06 Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/): bases, determinants, projection, eigenvectors.
- [MIT 18.02SC Multivariable Calculus](https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/): gradients and tangent approximation.
- [OpenStax Calculus Volume 1](https://openstax.org/details/books/calculus-volume-1): derivatives and numerical integration.
- [Three.js documentation](https://threejs.org/docs/): geometry conventions.

No source teaching text, exercises, or artwork is copied. Application data is original and synthetic. Automated tests and author review are not independent human expert verification. Human mathematics review and a real novice learning study have NOT RUN.
