# Continuous stress inputs and one-year excess-return forecasts — round 9

Declared22 October2026 after the51 recovery policies,63 risk models and six
forecast-risk guards were inspected. Near-term risk prediction improved; risk
guards did not meet economic gates. User requests continued research toward the
original predictive/economic goal. This is another exposed-history experiment,
not a fresh holdout. Preserve earlier outputs and issued records bytewise.

Question: do continuous RSI/VIX/HY inputs predict52-week excess equity returns
beyond a historical average and past-price model? Test added price z and complete
macro/value on separate matched source cohorts. Do not turn a better variance
forecast into a directional-return claim or a bottom-confirmation probability.

Use exact verified daily SPY/index histories, round6 weekly decisions/executions,
known cash and source/vintage precedence. No new downloads, substitutions or
threshold tuning. MAIN features: 13/52-week S&P500 log price returns and log13/52
weekly SPY variances; stress adds weekly Wilder RSI14/100−0.5, logVIXvariance and
logHY. PRICE adds completed-month price z; CONTEXT adds value z and the four
original activity/inflationGap/growth/inflation inputs. Context age cap62 days.
All are known at the decision cutoff. Invalid/missing inputs never become zero.

Target: actual cumulative SPY adjusted-close return minus compounded known cash
carry across the next52 weekly holding intervals, approximately12 months. It
becomes trainable only after its actual final execution date is on/before the
current preceding-day cutoff. Current/future unknown target labels stay excluded.

Twelve declared return procedures: MAIN mean/market/stress; PRICE adds price;
CONTEXT adds full stress+price/value+macro. All models within a cohort share its
complete current/training feature availability and mature training starts.
Require156 earlier eligible mature starts; keep latest520. Fixed ridge100,
training-only means/sample SDs, clip standardized X to±5, unpenalized centered
intercept. Mean model is the arithmetic training target average. Bound every
annual excess-return estimate to[−0.50,+0.50], disclose hits. No search over
periods, penalties, windows, feature sets or full-history-selected winners.

Report mature-start counts, MSE, MAE, signed forecast bias, directional accuracy
and out-of-sample R² versus the matched earlier-mean model. Directional accuracy
is historical classification, never a calibrated gain probability. Main stress
versus mean/market MSE are the two primary predictive comparisons. Paired circular
52-week calendar blocks retain gaps,2,500 draws/seed20261022; positive loss
reduction,95% interval, centered two-sided p and Holm over two. Other models and
feature cohorts are exploratory. Related52-week targets share economic crises.

For every model, run both continuous weekly long/cash allocations:
1. `sign`: past52 risk-capped SPY when expected excess return>0, otherwise cash.
2. `utility`: target=min(past52 cap, max(0, expectedAnnualExcess/(3*nearTermVariance))).
Near-term variance is the already verified round7 MAIN4-week VIX-only forecast
at that exact cutoff. No new risk fit or outcome is used. The annual mean and
near-term risk combine as a fixed heuristic allocation; they have different
horizons and do not imply a literal optimal portfolio. No leverage.

Require the known VIX risk forecast for every matched current forecast, including
sign policies. After inception, unavailable common inputs leave model policies
in cash without deleting holding intervals. Matched passive reference keeps the
past52 cap even when stress inputs are missing. A separate `risk-only` reference
uses min(past52 cap,.10/sqrt(VIXvariance)), cash if its risk estimate is unavailable.
All share the same continuous calendar, actual known cash, exact self-financing
10/25bp trades, final liquidation and daily-close maximum drawdown. Thirty policy
paths total: twice twelve return procedures plus two references per cohort.

Use round8's per-reference economic gates: higher CAGR at<=110% volatility and
no worse drawdown OR at most0.5pp lower CAGR with20% smaller drawdown, higher
Sharpe and comparable risk. A practical candidate must satisfy at least one
alternative against EACH of matched same-allocation mean/market, passive and
risk-only references. MAIN stress sign/utility versus these four references are
eight primary paired Sharpe tests, same52-week draws and Holm over eight. Do not
mix predictive and policy p-value families. Stronger support needs economic gates,
positive lower95%/adjusted p<.05 for each pair, and positive annual excess gains
in each populated fixed fold. No confirmed-edge flag is allowed; previous
attempts and regimes remain disclosed regardless of an attractive result.

Publish every forecast/model/path, exact mature training membership and input
hashes, all comparisons and fixed/omitted block diagnostics. Keep raw prices and
credentials private. Independently reconstruct every raw feature/target and
causal training set, refit all regressions in JavaScript, verify all allocations,
fees, daily drawdowns, summaries and primary paired calculations before atomic
publication. Add focused chronology/utility/cost/missing tests. Surface failures
as well as possible improvements, preserving the earlier genuine future pilot.
