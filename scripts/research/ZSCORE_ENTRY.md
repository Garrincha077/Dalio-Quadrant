# Price-position extension: methods and reproduction

The user's hypothesis is that the price's position within its own history can
distinguish investment opportunities inside the same macro state. This extension
tests that hypothesis separately from the frozen earlier macro study. It does
not redefine the economic axes or change live asset preferences.

## Price feature

For a month-end entry in month t and a trailing window L:

    z(t) = (log(P(t-1)) - mean(log(P(t-L)), ..., log(P(t-1))))
           / sampleSD(log(P(t-L)), ..., log(P(t-1)))

The previous monthly close belongs to the reference distribution. The entry
month's close is deliberately excluded. The primary L is 36; L=60 is a separate
sensitivity, not a parameter picked using evaluation performance. All L months
must exist, with positive finite prices and SD >=1e-12. Missing, flat or short
history withholds a feature, without forward filling.

Log prices make the z-score invariant to units and constant rebasing. It is a
historical price-position indicator, not a valuation multiple or a calibrated
tail probability. A trending asset can stay above its trailing average. Low z
can accompany distress and need not be a favourable entry.

The source panels contain adjusted ETF closes and some total-return indices, so
dividends/collateral/reinvestment affect the series. This is not uniformly a
pure spot-price or valuation experiment. Long bonds are reconstructed and gold
uses monthly-average quotes. The result cannot establish executable long-history
performance from 1973 merely because a macro vintage is genuine.

## Matching and chronology

The four input combinations are macro (a,p,da,dp), price (z), joint (five inputs)
and interactions (five inputs plus each macro input times z, nine features).
Every procedure uses exactly the same training, earlier validation and evaluation
dates within each panel/information set/asset/horizon/window. Price-only models
also use the macro-available cohort. This controls coverage when testing whether
price adds information.

Each family has four candidates: ridge penalty 10/100, with equal historical
weights or a 120-month exponential half-life. Raw training inputs are clipped at
their training 1st/99th percentiles before expansion. Weighted means/SD and ridge
coefficients are fitted only on training data; weights sum to n and the
intercept is the weighted mean outcome, unpenalised.

Annual January fits require 60 matured training labels, with exits strictly
before January. Up to five earlier January-origin validation years are eligible
only when every validation holding has exited before the later selection date.
Earlier fits use their own data cutoffs. Three folds/24 predictions are required;
each family selects the candidate with greatest positive validation entry lift,
requiring 12 selected starts/three episodes. Otherwise it emits an unconditional
no-entry model. Insufficient folds use that family's penalty-100/full-history
fallback, explicitly disclosed in traces and historical-entry tables.

The entry gate is positive score and >= the model's training 75th-percentile
score, with numerical tolerance 1e-12. Future evaluation scores never determine
the gate. Neither family nor price window is selected on outer performance.

This macro baseline has four ridge candidates, matched to the new families. It
is not the previous study's 17-candidate cross-family selector. Its different
training warmup and candidate set can change the macro-only result materially.
Even when two windows have the same outer dates, their training histories can
differ. Do not attribute such a difference exclusively to the z-score value.

## Sources and information sets

Source definitions and private-price preparation are in [EXTENDED_STATE.md](EXTENDED_STATE.md).
The common indices cover 1973-01–2025-05 for long proxies and 2006-03–2026-09 for
ETFs. Macro references and three-month differences use exact completed pairs
with a two-reference-month lag, as in [LEARNED_ENTRY.md](LEARNED_ENTRY.md).

Revised and archived-vintage experiments are separate. The 185 complete actual
CFNAI/PCE snapshots span prior-day cutoffs 2011-05-30–2026-09-29. Vintage training
uses macro reconstructions already published by that refit date, including then
available older backcasts. Each validation fold and target use their own cutoff,
with no revised fallback. This does not claim that pre-2001 CFNAI backcasts were
then-tradable signals. Market histories were retrieved for research, not captured
by a contemporaneously running strategy.

Price-window warmup plus 60 training outcomes reduces coverage. At ETF 12M, the
36-month window scores 2016-01–2025-09 (115 vintage dates); the 60-month window
scores 2018-01–2025-09 (91 vintage dates). The corresponding 36M holdings have
still shorter evaluation histories. Window comparisons are therefore separate
experiments on their disclosed cohorts, not a pure ceteris-paribus window test.

## Returns and incremental evidence

Outcomes are nominal USD cumulative returns after 10 bp per entry/exit side;
25 bp sensitivity is also retained. The usual return is the same asset's mean
on ALL identically scored dates in that experiment, not a differently dated
buy-and-hold return. Each family's lift is its selected mean minus that mean.

Incremental gain versus macro is the difference between the two selected means;
their identical usual baseline cancels. Paired circular calendar-block draws
retain both entry masks, with missing calendar months left as gaps. Use 5,000
draws, block max(12,h), seed 20261026+h. At least 80% valid paired draws are needed
for an interval/p-value. Empty selection means no conditional result, not zero
profit or a zero-return portfolio.

Interpretation requires 24 selected starts/six episodes; incremental inference
requires both masks to qualify. Holm adjustment pools supported absolute and
incremental tests across both price-window lengths, all assets, horizons and
families within each panel/information set. Intervals are unadjusted. Six episodes
do not make overlapping holdings independent. Candidate-set choice, prior
research selection and changing regimes are not removed by this correction.

This is a conditional entry comparison, not a fully invested strategy backtest:
no waiting-cash portfolio CAGR, allocation rule or prospective alpha is claimed.
The protocol was written before inspecting this extension's results, but the
extension itself followed earlier macro-only research and is exploratory.

## Reproduce and audit

Private inputs stay under ignored work/. Use the pinned requirements in
scripts/research/requirements.txt and prepare inputs as in the linked sources.

```sh
OPENBLAS_NUM_THREADS=1 work/research/.venv/bin/python scripts/research/zscore_entry.py
work/research/.venv/bin/python scripts/research/test_zscore_entry.py
node scripts/research/verify-zscore-entry.mjs
npm test
```

Outputs: data/zscore-entry.json and .csv. JSON retains all eight experiments,
models, validation traces, five-input dated rows, source/protocol/builder hashes,
outcomes and metrics. Annual model references reconstruct all four decisions per
row; CSV exports all 75,080 decisions directly. Provider price levels remain
private. The earlier research inputs and output hashes are unchanged.

The independent Node audit rebuilds the lagged log-price features, macro inputs,
matched training rows, weighted transforms, ridge coefficients with a separate
solver, training cutoffs, all selected means and paired incremental gains. It
passes for 4,578 parameter sets, 18,770 dated input rows and 7,080 family choices.
Selection checks use the published earlier-validation traces rather than an
independent refit of all inner folds. Twelve new synthetic tests check lagging,
unit invariance, gaps/flat history, feature families, clipping, matured labels,
future-data invariance, family-specific fallback and paired resampling.

Local verification: 108 Node and 58 Python tests pass. Chromium exercises all
432 information-set/panel/window/horizon/asset/procedure combinations, downloads,
dated entry tables, deferred loading and missing-data isolation. No page errors
or horizontal page overflow at 320/360/390/1440 pixels. Browser work uses local
static research; live API data are not configured in the local environment.

[Complete findings](ZSCORE_FINDINGS.md) · [Frozen extension protocol](zscore-entry-protocol.md).
