# Value and price research extension

This extends the frozen state/momentum research with separate asset-specific
value and price inputs. Read [the fixed protocol](protocol.md), including the
price amendment and provider-outage handling declared before extension results.
The primary question remains 12-month asset ranking, with 3/36-month exploration.

## Meaning of the scores

- **Value z > 0** means a relatively cheaper / higher-yield starting measure.
- **Price z > 0** means an ETF's completed-month log price is above its preceding
  history. It does not imply overvaluation or an automatic contrarian trade.
- The primary reference uses 10 calendar years before the current observation,
  sample standard deviation and at least 60 months (20 quarters for equity).
  The 20-year reference is a fixed sensitivity, not selected by performance.
- Every cutoff reconstructs the native history from then-available vintages.
  Missing, insufficient, zero-dispersion or stale measures remain unavailable.
- Numerical scores are uncapped. Visual gauges stop at ±3. Percentiles describe
  historical ranks, not probabilities of a future outcome.

| Asset | Value measure | Important limitation |
| --- | --- | --- |
| SPY | Four-quarter mean annualised nonfinancial corporate after-tax profits / same-quarter equity market value | Broad nonfinancial-US earnings-yield proxy, not S&P earnings or CAPE |
| IEF | Monthly 10-year nominal Treasury yield | Nominal carry, not expected real return or exact ETF yield |
| TIP | Monthly 10-year real Treasury yield | Constant-maturity proxy, not exact ETF yield or duration |
| GLD | Negative z of log(unadjusted GLD close / matching CPI) | Real-price proxy, fund fees affect long history; not gold fair value |
| DBC | Negative z of log(all-commodity PPI / matching CPI) | Producer-price basket differs from DBC futures; no futures carry |

All five price scores use completed-month **unadjusted closes**, corrected for
verified splits on/before the cutoff. Dividends/total-return adjusted levels are
used for return outcomes only, not for price z. Corporate-action history was
checked separately for all five ETFs; there are no splits in the verified sample.
Real-price value proxies can be correlated with price z. The ablations test
incremental information rather than counting them as independent evidence.

## Models and comparison

The full experiment fits historical mean, macro, value, price, macro + value,
macro + price and macro + value + price. Macro is the frozen four-feature state
and momentum block. Every asset receives only its own value/price features.
All share complete input eligibility, five mature targets, at least 60 past
training starts, expanding training and fixed ridge lambda 100. Winsorisation
and standardisation are fitted to training data only.

Four primary 12M rank-IC comparisons use calendar-block uncertainty and Holm
correction. The separate price experiment has four models (mean, macro, price,
macro + price), requires only macro and price inputs, and is exploratory at
every horizon. Its own cohort is shown explicitly; it never substitutes for a
missing primary value study.

The monthly policy is deliberately unchanged: best forecast asset when positive,
otherwise cash; 10% annual volatility target from 36 prior completed months,
no leverage, costs 10 bp per risky buy/sell leg and stress at 25 bp. Missing
forecasts after inception remain cash. Model and passive references share the
same strategy calendar and risk/cost rules. Monthly realised risks can differ.

These are retrospective reconstructions; previous research was already seen.
No historical row is added to the immutable forward ledger. A positive historical
estimate does not establish a reliable predictive edge.

## Current source availability, 21 October 2026

FRED began returning **Site Maintenance** HTML with HTTP 200 while acquiring
the new original-vintage sources. The downloader rejects these responses instead
of caching them as data. The public artifact consequently has `sourceStatus:
partial`, with six explicit missing sources. The seven-model experiment is
withheld. Original CPI vintages already verified for v2 were reused by hash;
its latest response is used only for the identical original as-of cutoff.

Verified available research includes price scores for all five ETFs, gold's
real-price proxy and the four-model price study. Its 12M matched period is
April 2017–September 2025, 102 overlapping starts. Macro + price rank IC is about
0.060 versus 0.164 for macro alone; the difference's 95% interval includes zero.
The result does not support promoting the price signal as a proven improvement.
Do not choose a different window or sign after seeing this result.

## Reproduce

Requires the privately acquired v2 source inputs and adjusted/unadjusted price
CSVs in `work/research-v2/`; these are intentionally not committed. See the
[v2 acquisition guide](../v2/README.md). Use Python dependencies from
`../v2/requirements.txt` and a server-side `FRED_API_KEY` in ignored `.env.local`.
Never put it in source code, browser storage, command-line arguments or output.

```bash
npm run research:v3:sources
npm run research:v3
npm run research:v3:verify
npm run test:research:v3
npm test
```

Normal acquisition/build fails on required source gaps and retains the previous
verified public artifact. To deliberately publish inspectable **partial**
evidence while a provider is unavailable:

```bash
npm run research:v3:sources -- --allow-gaps
npm run research:v3 -- --allow-gaps
```

Once FRED returns valid data, rerun the normal commands. They regenerate original
vintages, measures and all fixed comparisons; no manual sample/weight changes
are needed. Scores do not refresh with each live dashboard poll. They are a
versioned, dated research artifact, not live market quotes.

`features.py` privately constructs measures and normalisations; `backtest.py`
builds a private candidate. `verify.mjs` independently reconstructs native
measures, 10Y/20Y scores, percentiles, return labels, rank IC and net policies from
the actual private sources, then atomically publishes `data/asset-scores.json`.
The current partial artifact passes 3,312 score, 1,365 asset-outcome and 2,268
net monthly policy checks. Computational consistency does not establish an edge.

## Source receipt

- BEA profits: [NFCPATAX](https://fred.stlouisfed.org/series/NFCPATAX).
- Federal Reserve equity market value:
  [NCBEILQ027S](https://fred.stlouisfed.org/series/NCBEILQ027S) and its
  [documented discontinued duplicate](https://fred.stlouisfed.org/series/MVEONWMVBSNNCB).
  Billions/millions are converted explicitly; overlapping active vintages must
  reconcile before publishing a full result.
- Treasury nominal/real yields:
  [GS10](https://fred.stlouisfed.org/series/GS10),
  [FII10](https://fred.stlouisfed.org/series/FII10).
- BLS price indexes:
  [CPIAUCSL](https://fred.stlouisfed.org/series/CPIAUCSL),
  [PPIACO](https://fred.stlouisfed.org/series/PPIACO).
- Price levels: the existing private Alpha Vantage monthly-adjusted downloads
  contain separate unadjusted `close` and dividend-adjusted `adjusted close`.
  Split histories are checked against Yahoo Finance chart corporate actions.
  Source hashes/links are published, not provider price levels or credentials.
