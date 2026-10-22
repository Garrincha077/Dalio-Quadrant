# Practical risk guard after a supported short-horizon forecast — round 8

Declared22 October2026 after rounds6/7 and before this guard's outcomes. The user
asks to continue. Near-term VIX risk prediction improved over past-risk models,
but the original forecast-sized portfolios did not establish joint economic
improvement. Do not change those earlier paths, future records or conclusions.
This is exposed-history research, not an untouched validation or promised alpha.

Hypothesis: fitted risk can undershoot its raw-history reference. Use the stronger
near-term stress signal as an additional defensive ceiling, while retaining the
past52-week cap as a floor on perceived risk. A better calibrated risk forecast
alone does not necessarily produce the most useful portfolio.

Source: exact independently verified round7 MAIN4-week forecasts, round6 actual
execution/cutoff/cash calendar and underlying SPY prices. All six model procedures
are retained; do not substitute the ex-post best. No new fitting, forecast,
hyperparameter, training label, entry threshold or holding window is introduced.

At each original MAIN4-week decision after the first common forecast, target
risky fraction=min(1,0.10/sqrt(frozenForecastVariance),0.10/past52WeekVolatility).
Missing common forecasts leave every matching guarded policy in cash. Rebalance
weekly. This risk guard can reduce, never increase, exposure relative to the
source raw past52 cap. All six guarded policies use identical continuous holding
dates,10/25bp self-financing trade costs, known cash and final liquidation. Use
actual daily-close portfolio drawdown, fixed calendar folds and omitted-block
sensitivity exactly as round6. No benchmark date/exposure is chosen ex post.

References on the identical calendar: original past52 policy, original fitted
market-risk policy and guarded fitted market-risk policy. The guard-only past52
procedure must reproduce the original past52 path exactly, including gaps/fees.

Reuse round6's gates separately against each comparator: economic-return gain
requires higher CAGR, no greater than110% weekly volatility and no worse daily
max drawdown; defensive improvement allows at most0.5 percentage points lower
CAGR, requires20% smaller absolute drawdown, higher excess Sharpe and no greater
than110% volatility. A practical retrospective candidate must satisfy AT LEAST
ONE of these two predeclared alternatives for EACH of the three references. It
may be defensive versus passive risk and return-improving versus a fitted model;
publish the exact gate type for every reference rather than choosing one later.
Both VIX-only and combined stress guards are primary, regardless of performance.

Six paired policy-Sharpe tests: guarded VIX and guarded stress versus each of the
three references. Use the existing MAIN4-week calendar with2,500 paired circular
52-week blocks, seed20261022. All holding intervals, including source-gap cash,
remain in the calendar. Holm over six tests; this does not erase earlier trials.
Stronger evidence needs economic gates, positive lower95%/Holm p<.05 for every
primary pair, and positive annual mean excess gains in every populated fixed
fold. Every confirmed-edge flag stays false. Results that improve only one
benchmark or metric are labelled as such. No automatic claim of higher returns
follows from the earlier risk-loss significance.

Commit before outcomes. Publish all six paths, exact source/protocol hashes,
per-reference economic gates, all comparisons, fixed folds, omitted blocks and
execution/fee traces. Independently reconstruct each target, drifted trade,
actual cash/daily drawdown, all summaries and paired block results before atomic
publication of a separate artifact. Preserve earlier artifacts and the12 issued
forecasts bytewise. Add focused guard/no-leverage/missing/gap/fee tests and expose
the reviewed results in the existing risk tab, with source-labelled limits.
