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

## Source verification, 22 October 2026

FRED began returning **Site Maintenance** HTML with HTTP 200 while acquiring
the new original-vintage sources on 21 October. The downloader rejected these
responses instead of caching them as data. That initial partial artifact had
six source gaps and withheld the full experiment. FRED recovered on 22 October;
all seven required sources are now verified and `sourceStatus` is `complete`.
The frozen study retains its 21 October information cutoff. Original CPI
vintages already verified for v2 were reused by hash;
its latest response is used only for the identical original as-of cutoff.

Value and price scores are now available for all five assets. The equity
duplicate check reconciles 54 cutoffs with the same latest quarter, with maximum
relative difference 0.0000194%. Three further cutoffs (September–November 2015)
have an older latest quarter in the discontinued alias. Those are reported as
archive lag, not as mismatched levels: the canonical replacement is used in the
research. The rounding tolerance is unchanged. Neither series is mixed inside
one cutoff, and no prediction result was used to select this data correction.

Nine 2013–14 decision months still have stale original profits data for the
equity measure. They remain missing, shortening the full comparison relative
to the separate price experiment. Source acquisition being complete does not
mean every historical feature is complete.

## Completed primary result

The full 12M ranking sample is January 2018–September 2025: 93 overlapping starts.
Monthly trading-policy returns below cover February 2018–September 2026 (104
holding months), after 10 bp per risky buy/sell leg and the same volatility rule.

| Model | Mean rank IC | Policy CAGR | Policy excess Sharpe |
| --- | ---: | ---: | ---: |
| Historical average | 0.183 | 9.95% | 0.667 |
| State + momentum | 0.172 | 10.79% | 0.724 |
| Value only | 0.068 | 9.95% | 0.667 |
| Price z only | 0.009 | 9.16% | 0.590 |
| Macro + value | 0.045 | 9.16% | 0.590 |
| Macro + price | 0.060 | 9.16% | 0.582 |
| Macro + value + price | 0.057 | 9.16% | 0.582 |

All four primary 12M block intervals include zero; all Holm-adjusted p-values
are 1. The full model's incremental-value rank-IC difference versus macro + price
is -0.0032 (95% interval -0.0473 to 0.0376). This is not evidence of an incremental
predictive edge. The fixed 20-year sensitivity gives full-model IC 0.042 on the
same sample and does not replace the primary 10-year window.

The separate exploratory price-only sample remains April 2017–September 2025,
102 starts: its macro + price IC is 0.060 versus 0.164 for macro alone. These
samples are different and must not be compared as if they were the same cohort.

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
the actual private sources. It independently reconstructs each exact matured
training cohort and refits the winsorised/standardised ridge in JavaScript,
including the 20-year sensitivity, before atomically publishing
`data/asset-scores.json`. The complete artifact passes 5,546 score, 16,545 model
estimate, 609 training-cohort, 2,595 asset-outcome and 5,238 monthly net-policy
checks. Computational consistency does not establish an edge.

## Inspect estimates and prepare prospective validation

The dashboard exposes each dated model estimate alongside its realised excess
outcome when mature, its deviation from the same-date historical-average
estimate, and the actual input scores. Historical reconstructions are labelled;
unmatured outcomes stay unavailable. This does not generate a calibrated
probability of profit or a future return interval.

The immutable ledger accepts this verified v3 artifact as well as v2:

```bash
python scripts/research/v2/ledger.py --from-research data/asset-scores.json \
  --model full --horizon 12 --trade-date YYYY-MM-DD --execution-at YYYY-MM-DDTHH:MM:SSZ
```

This is a preparation command: a genuine planned decision must first be acquired
and built after its actual preceding-day information cutoff. The current
historical rows cannot be backfilled into the forward ledger. The ledger verifies
the complete artifact, input/protocol hashes and actual recording clock; it
preserves the five estimates, ranked assets and model-artifact hash. New future
records are needed to evaluate performance prospectively.

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
