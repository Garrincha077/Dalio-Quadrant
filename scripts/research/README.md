# Frozen research, 19 October 2026

For the separate 3/12/36-month **static state** study dated 20 October 2026,
see [STATE_FORWARD.md](STATE_FORWARD.md). It covers every monthly state,
conditional outcomes and selected-dot returns without changing this experiment.

This is an inspectable experiment, not a validated investment strategy. The
descriptive quadrant formula remains `momentum-1`. The experiment selected limited
variants and separate forward-return ridge models using development data only.
No settings were retuned on the reserved 2021–2025 window. Numerical corrections
(including drifted rebalancing costs) retain that same selection rule.

## Findings

Reserved 60-month results after 10 bp per risky buy/sell leg, in USD:

| Strategy | CAGR | Excess Sharpe | Monthly max drawdown |
|---|---:|---:|---:|
| SPY buy & hold | 14.32% | 0.76 | −23.93% |
| IEF buy & hold | −1.83% | −0.62 | −21.73% |
| GLD buy & hold | 17.29% | 0.98 | −15.91% |
| TIP buy & hold | 0.86% | −0.33 | −13.90% |
| DBC buy & hold | 11.78% | 0.62 | −22.98% |
| Original illustrative quadrant map | 4.34% | 0.18 | −17.88% |
| Training-calibrated quadrant rotation | 10.42% | 0.56 | −32.73% |
| Separate predictive SPY/cash model | 14.17% | 0.81 | −20.25% |
| Separate predictive asset rotation | 14.90% | 0.87 | −16.98% |

The rotation model's paired 12-month-block bootstrap 95% interval for annual
arithmetic mean return advantage over SPY is −9.84 to +10.61 percentage points.
It includes zero. Its CAGR falls to 13.99% at 25 bp per leg, below SPY's 14.28% at
that cost. This is **not evidence of a confirmed positive forecasting edge**.
Gold buy & hold also exceeded the rotation's return and Sharpe in this window.
The four additional static asset baselines are diagnostic comparisons; they
do not add candidates or change the predeclared model selection rule.
The five-year sample, 42 development candidates, dependent months, asset-universe
choice and concentrated rotations limit the result. Bootstrap intervals are not
forecast intervals and do not account for every model-selection risk.

One reserved observation (decision 28 November 2025, holding December) lacks
75% original growth coverage. Both quadrant strategies use their declared cash
fallback. The conditional table includes it as an unavailable bucket; the other
59 months split into 7/10/7/14/21 cases. Small retrospective leaders do not
establish that an asset will outperform next time.

Real-time timing matters: at the 30 March 2020 cutoff the original growth score
was +0.37 and inflation +0.27. GDP still referred to Q4 2019 and PCE to February.
The revised reference-period trail cannot be substituted for this tradable
information set. Growth score correlation is about 0.35 with preceding six-month
SPY returns, 0.24 with subsequent six months, and 0.02 with next month. These
overlapping diagnostics suggest a descriptive component, not a fixed proven lag.

## Reproduce

Node >=22 and Python >=3.11. Install the exact numerical versions in
`requirements.txt`. Raw provider price histories and ALFRED caches are kept in
ignored `work/research/`; the public app contains aggregate research and derived
static-state forward returns, without provider price levels.

1. Obtain full **monthly adjusted** CSVs for SPY, IEF, GLD, TIP, DBC from the
   connected Alpha Vantage `TIME_SERIES_MONTHLY_ADJUSTED` source. Save to
   `work/research/prices/SYMBOL.csv`, retaining the original `timestamp` and
   `adjusted close` headers. The research snapshot includes complete months
   through September 2026; the partial October row is excluded.
2. Obtain Yahoo Finance's SPY daily chart JSON using explicit `period1` (1 January
   1999), `period2` (19 October 2026), `interval=1d`, `events=div,splits`. Save as
   `work/research/prices/SPY-yahoo-daily.json`. `range=max` may silently return
   monthly granularity: the builder checks `meta.dataGranularity === '1d'`.
3. With the existing local server credential, run:

   ```sh
   node --env-file=.env.local scripts/research/fetch-vintages.mjs --as-of=2026-10-19
   node scripts/research/build-features.mjs
   python scripts/research/backtest.py
   node scripts/research/validate-sources.mjs
   npm test
   python scripts/research/test_backtest.py
   ```

4. Optional economic audit, separate from investment returns: fetch an ordinary
   dashboard snapshot into ignored `work/snapshot.json`, then run
   `node scripts/research/build-audit.mjs`. It uses **revised** complete reference
   periods and retrospective NBER labels. It must not feed a trading backtest.

The original [predeclared protocol](protocol.md) is retained byte-for-byte and its
SHA-256 is embedded in `data/research-summary.json`. The script freezes this
feature sample; future research requires an explicitly versioned protocol and
new forward validation, not silently extending or replacing this result. Source
rounding or provider adjustments may change exact return decimals on a new fetch.

## Method and boundaries

- ALFRED `output_type=2` wide vintage columns at each calendar day before the last
  trading close of the month. Raw weekly NFCI, monthly GS10/GS2. Only information
  returned for that vintage enters features. Archive availability starts later
  for several original inputs: 185 valid original quadrants, first March 2011.
  Earlier macro predictor inputs are separately defined GDP/production/payroll
  and PCE/CPI averages; they do not pretend the original 75% gate passed.
- Development labels end November 2020, December label embargoed, minimum 60
  training months, expanding fits on already-matured labels. No random split.
  Train-only median imputation, 1/99% winsorisation and standardisation; ridge
  λ in {1,10,100}. Candidate families and features are in the protocol.
- Macro ridge λ=100 wins the declared development excess-Sharpe selection for
  both SPY/cash and asset rotation. Seven inputs: core growth/inflation momentum,
  GDP/PCE YoY, curve, policy 3M change, NFCI. Market candidates also test SPY
  3/12M returns, 63-day volatility and 200-day average distance. These all use
  daily prices at/before the decision cutoff.
- Quadrant scale grid {.75,1,1.25} for each axis, transition {.10,.15,.20}, with
  original weights and coverage. Min 12 cell cases, shrink conditional excess
  returns toward training global means using 12 pseudo-observations. Selected
  .75/.75/.20 is research only: inferior reserved results do not justify changing
  the descriptive chart. A missing current quadrant falls back to cash.
- Forward labels are one-month adjusted-close ETF returns. SPY is an ETF proxy
  for S&P 500 total return, IEF 7–10-year Treasuries, GLD gold, TIP intermediate
  TIPS, DBC a commodity-futures portfolio. No index spot return substitutions.
  Cash approximates accrual of the vintage TB3MS annual yield over actual days;
  it is not an investable total-return index. No tax, financing or intramonth
  execution model. Transaction costs are a linear turnover approximation.
- 60/40 and equal-basket baselines rebalance from drifted holdings, incurring
  costs even with unchanged target weights. Entry starts in cash. Maximum
  drawdown uses monthly closes. Excess Sharpe subtracts the same cash proxy.
- Independent Node compounding of the actual 60 SPY source returns agrees with
  Python CAGR/drawdown. The 321-provider monthly return reconciliation has a
  median absolute difference 0.005 bp, maximum 5.26 bp (September 2015); the
  small 2015 adjustment differences are retained, not optimised away.

The experimental October 2026 prediction is a dated **frozen snapshot**, not
automatically refreshed or tradable mid-month. Dashboard FRED refresh and daily
macro archiving do not retrain it. A later date displays its expiry status.

## Sources and framework

- [FRED/ALFRED observations](https://fred.stlouisfed.org/docs/api/fred/series_observations.html)
- [Alpha Vantage monthly adjusted data](https://www.alphavantage.co/documentation/#monthlyadj)
- [Yahoo Finance SPY history](https://finance.yahoo.com/quote/SPY/history/)
- [NBER chronology announcements](https://www.nber.org/research/business-cycle-dating/business-cycle-dating-committee-announcements)
- [Bridgewater: All Weather](https://www.bridgewater.com/research-and-insights/the-all-weather-story)
- [Lyn Alden: fiscal dominance](https://www.lynalden.com/full-steam-ahead-all-aboard-fiscal-dominance/)

Bridgewater's growth/inflation surprises relative to pricing differ from this
app's realised momentum. Alden's liquidity/fiscal lens motivates checks on real
yields, credit and fiscal capacity, not a claim to reproduce her allocations.
