# Predictive stress information: forward risk and portfolio use — round 7

Declared22 October2026 after all51 round6 strategy paths were inspected, before
calculating round7 risk forecasts or outcomes. Entry confirmations and rolling
stress-memory variants did not meet their declared joint economic gates. Do not
change these conclusions or relabel this round as discovered return alpha.

Test the separate question whether the concept's VIX/HY stress inputs forecast
future risk beyond past price volatility. A forecast of risk is predictive value,
but it does not establish higher expected returns, correct bottoms or macro
quadrant return-ranking value. Price/value z and macro receive matched ablations.
All historical periods remain previously inspected. Preserve all earlier artifacts.

## Inputs and targets

Reuse exact verified v5 raw histories and v6 weekly execution/cutoff/cash calendar.
Original-vintage precedence, source limitations and no filling remain unchanged.
Weekly predictors: log13-week realized variance, log52-week realized variance,
log(VIX/100)^2, log(HY OAS in percent), completed-month SPY price z and value z,
and last verified activity/inflationGap/growthMomentum/inflationMomentum. All are
available at the decision cutoff; retain the62-day maximum context age. Past
variances use sample weekly total-return variance*52. No coefficient is fitted
with current or future outcomes.

Targets at h=4,13,52 weekly holding intervals: annualized mean squared weekly SPY
adjusted-close return, 52*mean(r^2). A target is usable for fitting only when its
actual final execution is on/before the current information cutoff. Therefore
same-week targets ending at execution cannot enter that execution's forecast.
Target52 approximates12-month average risk; it is not a price-return forecast.
The4-week target separately measures near-term risk.13 weeks is exploratory.

Three source-defined cohorts: MAIN2003 complete VIX/HY and both past variances;
PRICE from first price z; CONTEXT from first joint price/value/both macro momenta
and state data. Cohort-common feature availability is imposed on every model
in that cohort. Later missing current inputs withhold every matched forecast;
portfolio calendars continue in cash, never delete those intervals. Target-
evaluation rows require all matched forecasts and a matured actual target.

## Fixed models and fitting

MAIN six models: earlier-target arithmetic mean; trailing52 variance; trailing13
variance; market regression (both past log variances); VIX-only regression; stress
regression (past log variances + logVIXvariance + logHY).
PRICE adds stress+price z. CONTEXT adds the full stress+price/value+four macro
inputs. Six/seven/eight models at each of three horizons =63 forecast procedures.
All are retained; no best full-sample model is substituted for a fixed procedure.

All fitted regressions share the same last520 source-eligible MATURE training
starts, require104, and ridge lambda10. Fit X means/sample SDs on training only,
clip standardized training/current inputs to±5, center log(target variance), and
penalize slopes only. A constant column has zero standardized values. Calibrate
log-variance retransformation by the training mean(actualVariance/exp(fittedLog)).
Apply that strictly earlier calibration to the current fitted variance. Bound
ALL variance forecasts to[0.0001,1] (1%–100% annual volatility) for numerical
stability and disclose bound hits. No hyperparameter, window or cutoff search.

Loss is QLIKE: actual/predicted - log(actual/predicted) -1. Lower is better.
Also report annual-volatility MAE, mean actual/predicted variance, and four
forecast-risk buckets with observed risk and counts. Buckets are retrospective
calibration displays, not fitted trade thresholds or calibrated loss probabilities.

## Inference and actual portfolio use

Ten primary paired loss comparisons: at h=4 and h=52 MAIN, stress versus market,
trailing13, trailing52 and VIX-only (eight); VIX-only versus market (two). Positive
mean loss difference favors the first model. Circular52-week blocks,2,500 draws,
seed20261022, centered two-sided bootstrap p and95% percentile interval. Preserve
missing evaluation calendar positions as NaN in block sampling; do not close gaps.
Holm across these ten declared tests; unavailable tests still count in the family.
13-week and z/macro/value comparisons are exploratory. This correction does not
erase earlier research attempts or the fact that historical regimes were seen.

A stronger retrospective RISK candidate needs positive lower95%, Holm p<.05 and
positive loss reduction in every populated fixed calendar fold versus BOTH the
market regression and each trailing-variance reference. An incremental HY claim
also needs these checks versus VIX-only. A VIX-only finding is labelled as such.
No confirmed edge, return forecast or probability of profit may be inferred.

For each model/horizon, risky target=min(1,.10/sqrt(predictedVariance)), otherwise
cash. Rebalance weekly throughout the cohort's continuous calendar after the first
common forecast. Use exact v6 self-financing10/25bp costs, known cash carry and
final liquidation. Publish portfolio CAGR/risk/Sharpe/daily-close drawdown and
exposure as a separate economic check; loss improvement alone is not higher
investment return. Compare risk forecast policies on the same holding dates.

## Verification and delivery

Commit before outcomes. Store exact inputs, mature training indices, fitted
coefficients/calibration, predictions, targets, losses, source/protocol hashes,
all63 model/policy paths, paired tests and fixed folds. Raw provider prices and
credentials remain private. Independently reconstruct all features/targets,
refit every regression and training cohort in JavaScript, verify all policy fees,
daily drawdowns and primary block results before atomic publication. Add focused
maturity, leakage, scale, calibration, missing-gap and fee tests. Integrate the
reviewed recovery and risk results into the existing app with clear goal labels,
all attempts, source receipts, desktop/mobile controls and offline operation.
