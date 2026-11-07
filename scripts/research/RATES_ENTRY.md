# Initial yields and trend: methods, sources and reproduction

The user authorised testing whether initial Treasury yields, actual real market
yields and trailing price trend improve entry conditions beyond macro + price
z-score. This is a separate exploratory extension; earlier studies and hashes
remain frozen. Economic zero/2% axes and live preferences are unchanged.

## Sources and actual archive collection

- [GS10](https://fred.stlouisfed.org/series/GS10): monthly nominal 10-year Treasury
  constant-maturity yield, percent per year. Observations begin April 1953; the
  FRED vintage archive begins 1996-12-03.
- [FII10](https://fred.stlouisfed.org/series/FII10): monthly market 10-year
  inflation-indexed Treasury real yield, percent per year. Observations begin
  January 2003; the vintage archive begins 2004-01-05. Negative values are valid.
  This is not a policy rate minus subsequently realised inflation.
- Existing asset indices and exact macro histories retain the sources in
  [EXTENDED_STATE.md](EXTENDED_STATE.md) and [LEARNED_ENTRY.md](LEARNED_ENTRY.md).

[Manual collection run](https://github.com/Garrincha077/Dalio-Quadrant/actions/runs/40330298100)
obtained **247 exact historical reconstructions per yield series**, plus separate
2026-10-26 revised snapshots, with zero failures. ALFRED output_type=2 supplies an
explicit series/date vintage column for each requested cutoff; a missing column
is an error rather than permission to use another vintage. Collection cutoffs
are the existing actual ETF month-end prior days, March 2006–September 2026.

The private artifact was rate-vintages, ID 12655245584, ZIP SHA-256
6c983d462dc63a15841256eff89057e6d287606eed5401e1537dd1b967dec87a.
Files/manifest stay under ignored work/research/rate-vintages/. Public research
retains source IDs, coverage and file/manifest/schedule hashes. Artifacts expire
after seven days; retain the downloaded copy or refetch. The existing FRED secret
stays in Actions, with no provider prices or keys in the artifact.

Collection is selected with workflow_dispatch research_target=rates on the feature
branch. It skips the separate state-snapshot job; ordinary PR/daily runs do not
fetch rates. Existing state collection remains the default manual target.

## Separate cohorts and chronology

Nominal-only cohort adds GS10 and preserves long revised-history evaluation from
1990. The real-yield cohort adds GS10 and FII10 together. It does not fill the
pre-2003 real-yield gap with a synthetic series. For long revised inputs, 60-label
training and outcome maturity delay first scoring to 2009 at 3M, 2010 at 12M,
and 2012 at 36M. These cohorts have different training and sometimes evaluation
histories; their differences do not isolate real yields alone.

ETF scoring begins 2016 at 3/12M and 2018 at 36M. The actual macro vintage archive
limits long vintage scoring to 2012 onward. At ETF 12M, both cohorts score the
same 115 vintage starts (2016-01–2025-09) or 117 revised starts. Long prices end
2025-05; ETFs end 2026-09. Inputs before those dates can train a later model but
never supply a future feature or unmatured label.

For entry month t:

- Macro reference t−2: a, PCE YoY, exact three-month changes da/dp.
- Price z: previous close relative to t−36…t−1 monthly log prices, sample SD.
- Treasury yields: exact monthly reference t−1, in percent per year.
- Price trend: P(t−1)/P(t−13)−1, requiring 13 consecutive positive closes.

No entry-month close enters either price feature. No monthly gap is forward
filled. Yield observations must be unique monthly rows, finite and no later than
their archive cutoff. Source identity, schedule/hash and exact revised date are
validated. Missing vintages never fall back to revised yields.

Vintage training uses macro/yield reconstructions already published by the annual
refit date. Each earlier validation fold and actual target uses its own dated
reconstruction. Then-available older backcasts can train a model without claiming
they were tradable when originally observed. Revised panels remain retrospective.

## Three nested stages on identical data

1. Base: a,p,da,dp,z (five inputs).
2. Rates: base + GS10 (six), or base + GS10/FII10 (seven).
3. Trend: rates + trailing 12-month return (seven or eight).

Every stage uses identical training, validation and scored rows within its cohort,
panel, information set, asset and horizon. Even base requires full-cohort yield
and trend availability. The nominal-cohort base reproduces the frozen price
study's 36-month joint model, checked for every asset/horizon/information set.
The real cohort can alter base training by excluding older pre-2003 observations.

Four candidates per stage: ridge penalties 10/100, equal history or exponential
120-month half-life. Training-only 1st/99th-percentile clipping, weighted means/SD,
unpenalised intercept; weights sum to n and solve X'WX+lambda I. No interactions
or new outer-period winner selection. January refits need >=60 matured outcomes,
with exits strictly before that month.

Up to five earlier January-origin validation years choose largest positive entry
lift per stage. All validation holdings must finish before the later selection;
each inner fit uses only matured earlier labels. Require three folds/24 predictions
and 12 selected starts/three episodes. Insufficient folds use that stage's
lambda-100/full-history fallback; adequate folds without a qualifying candidate
emit an unconditional no-entry model. Entry needs positive fitted lift and the
training 75th-percentile score, tolerance 1e-12. Never retune using outer returns.

## Metrics, uncertainty and historical ranks

Returns are cumulative nominal USD at 3/12/36M, net of 10 bp per buy/sell side;
25 bp sensitivity is retained. The usual baseline is the same asset on all
identically scored dates. Paired gains compare rates minus base, trend minus
rates, and trend minus base; their same-date unconditional mean cancels.

Use 5,000 paired circular calendar blocks, max(12,h) months, seed 20261026+h,
preserving gaps and both masks. At least 80% valid draws are needed for inference.
Interpretation gate: 24 selected starts/six episodes, for BOTH masks in paired
tests. Holm adjustment includes supported absolute/incremental tests across both
cohorts and all assets/horizons/stages within a panel/information set. Intervals
remain unadjusted. Missing selection is unavailable, not zero investment return.

Historical ranks interpolate a model's stored training-score quantiles at 0,5,…,100
percent. Equal quantiles use the mean matching percentile; flat/unconditional
models have no rank. The app ranks the last COMMON scored entry date across
assets for the selected horizon/stage. It labels that date and shows fitted
lift, gate decision, choice/fallback and later realised returns separately.
These are within-asset training positions, not probabilities, cross-asset expected
returns or a live recommendation. They do not change the entry rule.

## Limits

Starting yields are Treasury-market proxies, not exact fund yields or guaranteed
holding-period returns. Bond duration, yield changes and inflation surprises
matter over 3/12/36M. Long bonds are reconstructed; gold is monthly average;
some price inputs are adjusted total-return indices with distributions/collateral.
No executable long-history performance or prospective deployment is established.

Sparse cycles and overlapping holdings limit evidence even when an interval is
positive. Prior research and model-family selection remain. A no-entry choice is
not proof that an asset has no opportunity. These are conditional entry studies,
not an allocation/waiting-cash portfolio backtest; no CAGR/alpha is claimed.

## Reproduce and verify

```sh
gh workflow run macro-monitor.yml --ref codex/extended-state-backtest -f research_target=rates
# Retain its attributed artifact in work/research/rate-vintages/.
OPENBLAS_NUM_THREADS=1 work/research/.venv/bin/python scripts/research/rates_entry.py
work/research/.venv/bin/python scripts/research/test_rates_entry.py
node scripts/research/verify-rates-entry.mjs
npm test
```

Prepare other inputs as in the linked methods and use the pinned Python
requirements. Outputs data/rates-entry.json and .csv contain all eight experiments,
fitted parameters, earlier-validation traces, dated raw features/outcomes, 49,296
stage decisions/ranks, provenance hashes, support, uncertainty and pairwise gains.
No provider price levels are published.

Independent Node verification rebuilds lagged macro/price/yield/trend inputs,
matched training, weighted transforms, coefficients via a separate solver,
training gates/rank quantiles, all selected means and pairwise gains. It passes
3,213 parameter sets, 16,432 dated feature rows and 4,728 chronological stage
choices. Choice checks use published validation traces, not an independent inner
refit. Fifteen new Python tests check timing, genuine negative real yields,
future-vintage isolation, nested inputs, fallback and paired comparisons. Node
checks also reconcile every exported rank/entry decision with its model.

114 Node and 73 Python tests pass. Chromium exercised all 324 new control
combinations, historical ranks/dates, selected-entry tables, downloads, lazy load
and unavailable-data isolation. No page errors or horizontal page overflow at
320/360/390/1440 pixels. Local static research works without a live FRED key.

[Findings](RATES_FINDINGS.md) · [Frozen extension protocol](rates-entry-protocol.md).
