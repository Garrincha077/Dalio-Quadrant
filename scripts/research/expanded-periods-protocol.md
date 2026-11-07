# Expanded per-asset periods · exploratory protocol · 26 October 2026

The user requests longer historical periods after the yield/trend study. Freeze
this extension before inspecting new model results. Earlier reports, sources and
methods remain unchanged. The extension changes availability and evaluation
coverage, not penalties, features, entry gates or outcome horizons.

## Source coverage, not fabricated observations

Prepare independent complete histories per asset; do not truncate every asset to
the newest ETF's start or the oldest-ending commodity dataset. Do not bridge
interior missing months, forward fill levels or splice ETFs onto reconstructed
indices. Nulls outside an asset's actual coverage are allowed; interior gaps are
errors. Within an asset, all three model stages still use exactly matched data.

Long proxy inputs: use the existing French equity/RF, Shiller reconstructed bond,
World Bank monthly-average gold and AQR commodity-futures sources. Retain prices
from 1960 where available, sufficient prehistory for the frozen macro data whose
first state is May 1967. Allow each source its own final complete month. Use gold
only from 1973-01 onward; do not use the peg era as free-floating training price
history. Commodity collateral is French RF, as before. No execution claim is
created by extending research return-index/average-price histories.

ETF inputs: keep each existing Alpha Vantage history independently. For SPY only,
use a separate consistent full Yahoo daily-adjusted-close series from 1993,
aggregating the last actual traded daily close in each month. No provider splice.
Cross-check overlapping monthly returns with the old SPY provider; report median
and maximum discrepancy rather than concealing provider differences. Raw prices
stay private; retain attributed URLs, hashes, actual trade dates and coverage.
Always exclude the unfinished as-of month (October 2026).

## Fixed model and temporal availability

Reuse the frozen rates_entry fit, choice, percentile-rank and pairwise routines:
macro + z36, add initial GS10 / actual FII10 yields, add prior 12-month return;
3/12/36M outcomes, costs, four candidates per stage, annual January refits,
>=60 matured training labels, earlier purged validation and unchanged fallback.
Keep nominal/actual-real cohorts and revised/vintage information sets separate.

Remove the arbitrary 1990/2016 outer-start floors. Begin scoring each asset only
when the SAME original minimum training and feature constraints permit it.
Historical macro features and actual real yields cannot be extrapolated: no new
pre-May-1967 macro state, pre-2003 FII10, or pre-2011 macro vintage is invented.
The archived model's first possible annual refit remains January 2012. Price
warmup plus outcome maturity can make an asset's first score much later.

Use existing exact macro/yield archive cutoffs. Actual ETF trade dates must match
the archived schedule where a vintage signal is used. Long monthly proxies keep
their non-executable limitation. Training uses then-published reconstructions;
earlier folds and targets retain their own cutoffs, with no revised fallback.

## Outputs, comparisons and interpretation

Publish input start/end and scored start/end/count per asset/horizon, compared
with the frozen prior study. Retain full extended results. Add exact-calendar
intersection point comparisons of old and extended procedures, plus earlier-
added/later-added cohort summaries. Their models can differ because of longer
training and, for SPY, provider history. This does not isolate calendar extension
alone. Do not promote the most attractive subset as the main finding.

Report descriptive stability across fixed eras 1970–1989, 1990–2007, 2008–2019 and
2020–2026: selected means/lifts, counts and episodes, with each era's own scored
baseline. These are point summaries, not newly validated sub-strategies; no era
chooses a model or threshold and no era-specific significance is claimed.

Full-study absolute and paired gains retain 5,000 calendar-block bootstrap draws,
block max(12,h), original seed and support gate 24 starts/six episodes (both masks
for paired gains). Holm pools supported absolute and incremental tests across
both availability cohorts, assets, stages and horizons within panel/information.
No extra tests for comparison/era subsets. Empty selections remain unavailable.

Extend the app's yield/trend card with an original/expanded-history selector,
per-asset coverage, historical ranks and era/common-date comparison details.
Ranks remain within-asset training percentiles, not probabilities/live guidance.
Publish failures, new source hashes, dated forecasts, reproducible preparation,
boundary/gap/causality tests and independent source/model reconstruction. Older
history adds regimes but does not make overlapping holdings independent or remove
revised/backcast/source/research-selection bias.
