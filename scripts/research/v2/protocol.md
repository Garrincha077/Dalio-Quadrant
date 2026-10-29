# State × momentum research v2 — fixed 21 October 2026

Primary question: does combining the existing economic-state axes and momentum
scores improve 12-month cross-asset rankings? Three- and 36-month results are
secondary exploratory checks. An honest null result is a successful outcome.

Universe: actual adjusted SPY/IEF/GLD/TIP/DBC histories and vintage TB3MS cash
carry. Never extend ETF histories with index proxies. Public academic/index
histories are separately labelled context, retaining their native frequency.
Use the longest verified history, not fixed 2000/2003 starts or a fixed row count.
Retain gaps, incomplete periods and provider limits. CFNAI-MA3 reconstructed
history starts in May 1967; public real-time releases begin in March 2001.

Information cutoff is 23:59:59 UTC on the calendar day before the actual SPY
month-end trading date. Use ALFRED vintages at that cutoff. Before the ALFRED
archive starts, use only Chicago Fed release files with a verified release date.
Never substitute today's revised history for a missing vintage. Monthly state
axes must refer to the same completed month, be no older than 90 days from
period end, and use exact year-earlier PCE bases. Momentum uses unchanged
momentum-1 transforms, weights and 75% axis coverage gates. Missing core axes
are not imputed. Keep each training row's original decision-date vintage.

Models: S=[activity,PCE YoY−2]; M=[growth score,inflation score]; SM=S+M.
All use train-only 1/99% winsorisation, standardisation and ridge lambda=100,
with an unpenalised intercept, no hyperparameter search. The unconditional
expanding mean and a causal version of state+trend pooling are references.
The pooling reference uses the existing ±.10/.20 boundaries and 24 prior cases,
and a four-consecutive-month trend from the same decision's vintage.

Fit expanding windows with at least 60 common, complete, already matured
H-month labels. Exact target end must precede the decision cutoff. Do not
randomly split, backfill features, fill price gaps or include immature outcomes.
Targets are cumulative adjusted-price returns minus cash accrual for H=3/12/36.
Forecast evaluation uses identical dates and asset sets for every model.
Report coverage lost to every eligibility gate, raw monthly windows and episodes.

Prediction quality: mean cross-sectional Spearman rank correlation and mean
realised excess return of the first ranked asset. Primary tests compare SM
rank correlation against S, M and unconditional at H=12; apply Holm's method
to the three paired, two-sided centred block-bootstrap p-values. Use 2,500
circular calendar moving-block draws, block=max(12,H), seed=20261021. Keep
missing calendar months in the resampling clock. Other comparisons are exploratory.
Intervals are uncertainty about historical differences, not forecast ranges.

Trading is a separate monthly-rebalanced policy using each H-month forecast.
Select the highest predicted excess return, or cash if none is positive.
At decision time target 10% annual volatility using the preceding 36 COMPLETE
monthly returns, cap risky exposure at 100%, no leverage. Apply the same rule
to SPY, 60/40 SPY/IEF, equal-five and the existing SPY 12M-positive trend rule.
Monthly-return data cannot show intramonth drawdowns. Costs: 10 bp per risky
buy/sell leg, 25 bp stress, both measured from drifted holdings. Insufficient
forecast/risk history uses cash and remains in the calendar return series.
Report raw full-investment baselines too. Missing realised market outcomes
withhold the affected strategy evaluation rather than inventing cash outcomes.

Full-history, fixed calendar-decade and trailing-20-year evaluations are
diagnostics, not separate fitting or model-selection settings. The already
reviewed 2021–25 sample is not an untouched holdout for this new protocol.
All v2 historical tests are retrospective walk-forward research. Freeze this
protocol hash with every output. New settings require a new protocol/version.

Forward tracking: save an immutable forecast only BEFORE its planned execution,
with cutoff, execution date, horizon, model, input/artifact/protocol hashes and
ranking. Never relabel a historical reconstruction as a recorded live forecast.
Append mature outcomes without changing original forecasts. No 'confirmed
predictive edge' status is emitted by this version.

Public outputs include derived returns, aggregates and provenance, not licensed
provider price levels or API credentials. Long context may use JST's US annual
series under CC BY-NC-SA 4.0, separately labelled and attributed; it never enters
the monthly predictive model. Preserve the original frozen v1 studies bytewise.
