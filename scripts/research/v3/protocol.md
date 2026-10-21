# Asset value extension — fixed retrospective protocol

Declared 21 October 2026, before calculating the value-model results. Earlier
state/momentum research and historical returns have already been inspected.
This extension is retrospective research, never an untouched holdout or a
recorded forward forecast. The frozen v1/v2 protocols and results stay separate.

## Question and asset universe

Does an asset-specific value measure improve 12-month excess-return forecasts
and ranking beyond static state plus macro momentum? SPY, IEF, GLD, TIP and DBC
are evaluated together. Three and 36 months are exploratory. A second, 20-year
normalisation window is a declared sensitivity check, not a parameter search.

## Measures, directions and source limits

- SPY: trailing-four-quarter mean annualised nonfinancial corporate after-tax
  profits (NFCPATAX, billions) divided by same-quarter nonfinancial corporate
  equity market value (NCBEILQ027S, millions / 1,000), times 100. This is a
  broad-US nonfinancial earnings-yield proxy, not S&P 500 earnings or CAPE.
  Before NCBEILQ027S has an ALFRED vintage, use its documented discontinued
  duplicate MVEONWMVBSNNCB (billions). Never combine the two legs inside one
  cutoff. Publish overlap reconciliation and the leg actually used.
- IEF: GS10, monthly nominal 10-year Treasury yield. This is a nominal carry
  measure, not expected real return or the ETF's yield to maturity. A sufficiently
  long verified original-vintage expected-inflation series is not assumed.
- TIP: FII10, monthly 10-year inflation-indexed Treasury yield. It is a constant-
  maturity real-yield proxy, not the exact duration/holdings of TIP.
- GLD: log of unadjusted, completed-month GLD close divided by same-month
  CPIAUCSL. A lower real ETF price gives a higher score. It is a price-reversion
  proxy with fund-expense/history limits, not gold's fundamental fair value.
- DBC: log(PPIACO / same-month CPIAUCSL). A lower relative producer-price
  index gives a higher score. This is a broad producer-price proxy, not the
  composition, spot value or futures carry of DBC.

FRED/ALFRED supplies only values released by each information cutoff. No current
revisions are substituted for missing vintages. Quarterly inputs must share the
same quarter; monthly deflators must share the same month. GLD prices must be
completed observations with timestamps strictly before the trading date and no
later than the cutoff; adjusted return levels are never used as gold valuation.
Native reference periods must have ended by the cutoff. Maximum reference-period
age is 185 days for equity and 90 days for monthly measures.

## Normalisation

For each cutoff independently, reconstruct the measure's history from the vintage
then available. Compare its latest value with the preceding 10 calendar years,
excluding the current observation. Use sample standard deviation (ddof=1).
Higher scores always mean relatively cheaper / higher yield. Yield measures
have positive direction; log real-price measures negative direction. At least
60 prior monthly observations or 20 prior quarterly observations are required.
Missing inputs, an insufficient history or zero dispersion produce no score;
they are never replaced by a neutral zero. Numerical scores are not clipped.
Publish the native count, period, age, raw measure, oriented percentile and
reference statistics with the score. The 20-year sensitivity changes only the
lookback, retaining the same minimum history and method.

## Models and matched evaluation

Four models use identical decision dates, mature labels and training eligibility:
historical mean; macro (the four frozen state/momentum features); value (each
asset's own score); macro + that asset's own value score. Each asset has its own
ridge regression, with lambda=100 and an unpenalised intercept. Training-only
1st/99th percentile winsorisation and standardisation follow the frozen ridge
implementation. No value-to-return weights or signs are hard-coded.

The common eligibility mask requires all four macro features and all five value
scores; all five targets must be complete for training. Minimum 60 already
matured monthly starts; expanding chronological training; label end <= cutoff.
Targets, cash carry, actual decision/execution calendar, source price returns,
10% prior-36-month volatility control without leverage, winner-or-cash monthly
policy and transaction costs (10 bp; stress 25 bp) follow v2. This isolates the
added signal rather than changing the allocation rule at the same time. Missing
forecasts after inception stay as cash. Reference portfolios use the same sample
and risk/cost rules. Display filters never refit a model.

The two primary tests compare macro + value with macro and with historical mean
at 12 months using paired rank IC differences and a Holm correction across the
two hypotheses. Circular calendar-block bootstrap: 2,500 replicates, block
max(12, horizon) months, seed 20261021. Missing interior calendar months remain
missing inside the bootstrap. Fewer than max(24, 2*horizon) matched starts withhold
the interval. All other tests, including 20-year normalisation, are exploratory.
Report ranking, top-choice excess, cost-adjusted strategy CAGR, Sharpe, volatility,
drawdown, turnover, calendar coverage and actual asset selections. Overlapping
monthly starts are not independent trials. No confirmed-edge badge is emitted.

## Audit and delivery

Publish protocol/input/source hashes, source links, first original vintages,
missingness, normalisation coverage and read-only derived score history. Keep
provider price levels and credentials private. Independently reconstruct scores,
labels, rank IC and net policy returns from private inputs before publication.
Latest observed value scores are dated research snapshots, not live quotes or
calibrated probabilities. No historical row is inserted into the forward ledger.
