# Macro transitions and market conditioning — research round 4

Declared 22 October 2026 before calculating this round. All previous historical
returns and v1–v3 results have already been seen. This is exploratory,
retrospective research, including the outer walk-forward evaluation. It is not
an untouched holdout. No historical result becomes a genuine forward forecast.

## Question and limits

Can changes in published economic state, and interactions between that state
and market trend, improve 12-month asset ranking and portfolio decisions beyond
a market-only model? A separate matched cohort tests whether the already
defined value and price z-scores add information. Three months is secondary.
This round has a finite, disclosed search budget: 18 configurations in the main
cohort and 24 in the value/price cohort, at each of two horizons (84 attempts).
Every configuration is retained, including failures. No unrecorded parameter
search, reversed signal or selected historical start date is allowed.

Reuse verified original-vintage v2/v3 sources and their hashes. Do not reacquire
or extend price histories, substitute revised macro histories, or alter frozen
earlier artifacts. SPY/IEF/GLD/TIP/DBC and original-vintage cash remain the universe.
Same preceding-calendar-day cutoff, actual execution calendar, completed price
months and original source units apply. No inference before available inputs.

## Inputs and cohorts

For decision month t, market inputs for each asset are adjusted-price returns
from t-4 to t-1 (three months), from t-12 to t-1 (12-to-1 momentum), annualised
sample volatility of the 36 monthly returns ending t-1, and the original cash
yield at t's cutoff. Thus no decision-month close enters any feature. Momentum
uses total-return prices; it is distinct from the existing unadjusted price z.

Macro inputs are the original CFNAI-MA3 activity and headline PCE YoY minus 2,
plus their changes from the decision three calendar months earlier. These are
changes in published estimates, including revisions, not forecast surprises.
Both endpoints must be valid point-in-time states. No interpolation or future
revisions. This simpler impulse does not require the existing dashboard's
multi-indicator momentum block, whose archive begins later. It remains separate
from that frozen calculation and is clearly labelled.

Families:
1. Market: the four market inputs.
2. Macro: market plus four macro inputs.
3. Interaction: macro plus activity×activity-change, inflation-gap×inflation-
   change, activity-change×inflation-change, own 12-to-1 momentum×activity-change
   and own momentum×inflation-change.
4. Value/price: interaction plus own v3 value z and price z, and their products
   with each of the two macro changes (six further inputs).

The main cohort requires valid market and macro inputs for all five assets.
The separate value cohort additionally requires all five eligible original v3
value and price scores. Each cohort trains and evaluates every family on exactly
the same eligible dates and complete five-asset outcome labels. The value cohort
does not shorten or substitute for the main cohort. Stale/missing values remain
missing, not zero. Market-only inference outside the common cohort is not used
in a paired comparison.

## Training and selection

Targets: cumulative asset excess return over original-vintage cash at H=12
and H=3, with the v2 exact calendar/maturity rules. Each asset has its own ridge
with an unpenalised intercept, training-only 1/99 winsorisation and population-
SD standardisation. Minimum 60 completed eligible training starts. Candidate
grid: lambda in {10,100,1000}; expanding history or the latest 120 eligible
matured starts. These six settings apply equally to each family. No imputation.

At each cutoff, each candidate is fitted only on labels already mature. Family
selectors choose their setting using up to the latest 60 common earlier
out-of-sample forecasts whose complete H-month outcomes have matured by this
cutoff. Require 24 such selection starts. Objective is mean cross-sectional
Spearman rank correlation. Ties follow listed lambda order 100,1000,10, then
expanding before 120, then market/macro/interaction/value. This deterministic
tie preference is declared, not optimised. A fourth adaptive selector chooses
among all eligible families with the same rule, permitting a market fallback.
The selector records candidate, training membership and selection membership
at every decision. No future fold or current outcome can select its model.

Report both individual configurations and these causal selector procedures.
Configurations ranked by full-history performance are labelled descriptive
search results, never used as if selected in advance. The expanding historical
mean is an additional matched reference. Output outer forecasts and calendar
folds (through 2019, 2020–22, 2023 onward); these folds are descriptive because
this history has already been inspected in previous work.

## Trading and costs

Primary policy is a bounded relative tilt around inverse-volatility weights.
Calculate reference b=normalise(1/vol36). Convert predicted-return ranks to
u=(rank-3)/2, with average ranks for ties. Model target is normalise(b×(1+0.5u)).
Thus a signal changes an asset's reference allocation by a positive multiplier
between 0.5 and 1.5. No automatic cash decision is imposed by estimated return.
Reference policy uses b unchanged. The same preceding-36-month covariance/10%
annual volatility cap, no leverage and 10bp risky buy/sell costs (25bp stress)
apply to all. Missing post-inception forecasts use cash and stay in the clock.

Also publish the previous winner-or-cash policy as a sensitivity, not a way to
select the best policy. Include risk-matched SPY, 60/40, equal-five and inverse-
vol references on the exact shared calendar. Report actual weights, turnover,
net returns, CAGR, excess Sharpe, volatility and monthly maximum drawdown.

## Evidence and success criteria

Four primary incremental-ranking comparisons: adaptive versus selected market
and selected interaction versus selected market, in each cohort at 12M. Apply
Holm across all four, with 2,500 circular calendar-block draws, block 12 months,
seed 20261022. Missing interior calendar months stay in the bootstrap clock.
Secondary horizon, individual configurations, value-family diagnostics and
allocation sensitivities are exploratory. Model-search p-values are not proof
of discovery; publish the full attempt count and previous research exposure.

Assess net-policy differences separately using paired calendar-block bootstrap
Sharpe differences (2,500 draws, 12-month blocks, same seed) and Holm across the
same four pairs. These policy tests use all continuous holding months, including
cash fallback, and preserve joint model/reference/cash returns. Economic gates:
net CAGR exceeds the paired market model, realised volatility no more than
110% of it, and maximum drawdown no worse. An economic improvement alone is
labelled an exploratory candidate. A stronger retrospective candidate must also
have positive lower 95% intervals and Holm p<.05 for both incremental rank IC
and policy Sharpe, plus positive incremental IC in each populated fixed fold.
There is no confirmed-edge status: genuine future observations are still needed.

## Reproducibility and UI

Commit this protocol before running outcomes. Preserve input/protocol hashes,
all attempt summaries, selector decisions and dated estimates/outcomes, policy
weights and calendar folds. Independently reconstruct consequential estimates,
selection, labels and costs from private sources before publication. Private raw
prices and credentials are never shipped. Publish a separate research artifact
and lab view, keeping v1–v3 bytewise unchanged. Show failures as well as promising
candidates; never silently replace a baseline after reviewing results.
