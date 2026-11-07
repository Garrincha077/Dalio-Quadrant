# Initial yields and price trend · exploratory protocol · 26 October 2026

This user-authorised extension follows the previously inspected macro/z-score
studies. Fix this protocol before inspecting new model results. Earlier studies
remain frozen; this is not an untouched prospective test.

## Inputs and separate availability cohorts

Keep a,p,da,dp and the 36-month trailing log-price z-score as the five-input
baseline. All price features exclude the entry-month close. Add monthly GS10
(nominal 10-year constant-maturity Treasury yield, percent per annum) and, in a
separate cohort, FII10 (market 10-year inflation-indexed Treasury real yield,
percent per annum). These are beginning yield levels, not realised returns or
the policy rate minus subsequently realised inflation.

Nominal cohort: GS10 only, preserving the longest available matched history.
Real-yield cohort: GS10 and FII10 together, with no synthetic real-rate backfill.
FII10 begins in 2003; fitting/evaluation must honour the shorter history. Never
pool cohorts or attribute their differences solely to a real-rate effect.

Use monthly yields for entry t from reference month t-1, requiring exact monthly
observations in the information set. No forward filling or revised fallback.
Additional price trend = P(t-1)/P(t-13)-1: 12 monthly price/return-index changes.
Price z-score uses t-36 through t-1 and sample log-price SD, as previously defined.
Require complete positive price history. Adjusted ETF and long return-index
definitions and proxy execution limitations remain unchanged.

Collect GS10/FII10 reconstructions using ALFRED output_type=2 exact vintage
columns at the existing prior-day month-end cutoffs, plus a separate exact
2026-10-26 revised snapshot. Keep series provenance, source/schedule hashes,
archive availability and errors. Macro vintage mode uses its own existing exact
snapshots. Training may use the historical reconstruction already published by
its refit date; each earlier validation fit and monthly target uses its own
cutoff. Do not treat late-published backcasts as originally available signals.

## Three nested model stages

Within each cohort/panel/information set/asset/horizon, use IDENTICAL training,
validation and scored dates for all stages, including the baseline. All require
the full cohort's yield and trend availability, even when a stage omits them.

1. Base: macro + z (five inputs).
2. Rates: base + nominal yield; or base + nominal and real yields.
3. Trend: rates + 12-month trailing return.

Four ridge/history candidates per stage: lambda 10/100, equal weights or
120-month exponential half-life. Training-only raw 1st/99th clipping, weighted
centering/scaling, unpenalised intercept, weights sum to n, X'WX+lambda I. No
interactions, trees, alternate lookbacks or outer-period stage selection.

Annual January refits require >=60 already matured training outcomes; exit
strictly before refit. Up to five earlier January-origin validation years are
eligible only after all their holdings have matured before the later selection.
At least three folds/24 predictions; choose each stage's largest positive
validation entry lift with >=12 selected starts/three episodes. Sufficient folds
without a qualifying candidate emit no entry. Insufficient folds use that same
stage's lambda-100/full-history fallback, labelled explicitly. Entry: positive
score and >= training 75th-percentile score, tolerance 1e-12. Outcomes/horizons
remain net USD cumulative returns, 3/12/36M, 10 bp per entry/exit side, 25 bp stress.

## Metrics, rankings and evidence

Report each stage's lift versus the same asset's usual return on the same scored
cohort. Also paired incremental lift: rates minus base, trend minus rates, and
trend minus base. Use shared circular calendar blocks, retain gaps, block=max(12,h),
5,000 draws, seed=20261026+h; >=80% valid paired draws required. Empty selection
means unavailable inference, never zero return. Interpretation gate >=24 selected
starts/six episodes; paired inference requires both masks to qualify.

Holm-adjust supported absolute and incremental tests jointly across BOTH
availability cohorts, assets, horizons and stages within a panel/information set.
Intervals remain unadjusted. Candidate/research selection and overlapping holdings
remain limitations. No portfolio CAGR, waiting-cash return or prospective alpha.

Add an inspectable HISTORICAL favourability ranking: approximate percentile of
each dated model score within that model's own training-score distribution,
using stored 5-percentile grid points. This is relative to that asset/model's
history, not a probability, cross-asset expected-return comparison or live
recommendation. Unconditional/flat models have no ranking. Show dated raw fitted
lift and later realised return separately; do not create a new entry gate.

Publish all cohorts and stages, chronology/source hashes, traces, dated decisions,
rankings, uncertainty, failures, meaningful causality tests and an independent
source/prediction audit. Do not change descriptive economic anchors/preferences.
