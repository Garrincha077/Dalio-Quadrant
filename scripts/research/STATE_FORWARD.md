# Static state and subsequent asset returns

Frozen descriptive research as of 2026-10-20. Complete adjusted prices end September 2026.

## One-year common-date results

Reference-month entry; 235 monthly starts, March 2006–September 2025.
All values are cumulative nominal USD returns, without costs. N counts overlapping
monthly windows. A state below 2% PCE is not necessarily deflation.

| State | N | SPY | IEF | GLD | TIP | DBC |
|---|---:|---:|---:|---:|---:|---:|
| Above trend / PCE >2% | 45 | +6.14% | +1.60% | +13.57% | +2.28% | +15.61% |
| Above trend / PCE <2% | 37 | +15.45% | +0.97% | -4.96% | +1.21% | +2.04% |
| Below trend / PCE >2% | 66 | +8.16% | +5.89% | +20.88% | +4.08% | +0.35% |
| Below trend / PCE <2% | 85 | +17.17% | +4.17% | +10.59% | +5.10% | +2.78% |
| Exactly on an anchor | 2 | +17.66% | -3.45% | +1.62% | -1.56% | +5.64% |
| Unconditional same-cohort mean | 235 | +12.26% | +3.59% | +11.53% | +3.60% | +4.46% |

## Highest mean among the four quadrants

Exact-anchor cases are retained in the study, but are not a fifth ranked quadrant.
These are retrospective leaders, not selected trading rules.

| Asset | Horizon | Leading state | Mean | Median | N / episodes | Lift vs own baseline · pp | 95% block interval · pp |
|---|---:|---|---:|---:|---:|---:|---|
| SPY | 3M | Above trend / PCE <2% | +4.93% | +4.67% | 37 / 9 | +1.98 | +0.14 to +4.89 |
| IEF | 3M | Below trend / PCE >2% | +1.82% | +1.68% | 71 / 12 | +0.95 | -0.00 to +2.30 |
| GLD | 3M | Below trend / PCE >2% | +5.57% | +4.77% | 71 / 12 | +2.96 | +0.32 to +5.99 |
| TIP | 3M | Below trend / PCE <2% | +1.16% | +1.52% | 85 / 12 | +0.28 | -0.49 to +1.08 |
| DBC | 3M | Above trend / PCE >2% | +1.84% | +1.09% | 49 / 14 | +0.68 | -3.69 to +4.43 |
| SPY | 12M | Below trend / PCE <2% | +17.17% | +16.70% | 85 / 12 | +4.91 | -0.17 to +10.76 |
| IEF | 12M | Below trend / PCE >2% | +5.89% | +6.27% | 66 / 11 | +2.30 | -0.06 to +5.23 |
| GLD | 12M | Below trend / PCE >2% | +20.88% | +17.14% | 66 / 11 | +9.35 | +1.16 to +18.87 |
| TIP | 12M | Below trend / PCE <2% | +5.10% | +5.89% | 85 / 12 | +1.49 | -0.50 to +3.94 |
| DBC | 12M | Above trend / PCE >2% | +15.61% | +8.65% | 45 / 12 | +11.15 | +0.28 to +24.14 |
| SPY | 36M | Below trend / PCE <2% | +46.53% | +45.75% | 85 / 12 | +5.84 | -1.41 to +16.44 |
| IEF | 36M | Below trend / PCE >2% | +17.60% | +15.00% | 45 / 10 | +7.50 | +1.19 to +14.98 |
| GLD | 36M | Below trend / PCE >2% | +67.93% | +71.11% | 45 / 10 | +35.01 | -20.82 to +70.18 |
| TIP | 36M | Below trend / PCE >2% | +14.68% | +12.66% | 45 / 10 | +4.20 | -0.97 to +8.98 |
| DBC | 36M | Below trend / PCE <2% | +14.49% | +9.88% | 85 / 12 | +8.73 | -6.33 to +24.76 |

SPY's one-year leader is below-trend activity / PCE below 2%: +17.17%,
versus its +12.26% unconditional cohort mean. Its lift interval includes zero.
Gold's one-year leader is below-trend activity / PCE above 2%: +20.88%
versus +11.53% unconditional. These in-sample, unadjusted intervals do not
remove revision/look-ahead bias or establish a forecasting edge.

## Publication-delay sensitivity

Two-month-delayed entry, then a full 12-month holding period: 235 common state
months, January 2006–July 2025. For SPY, below-trend / PCE below 2% remains
the four-quadrant mean leader (+17.00%). For GLD, below-trend / PCE above
2% remains the leader (+23.12%). Commodity returns after above-trend / PCE
above 2% average +14.19%; their lift interval now includes zero. Both modes
use revised economic data. A delay is not a substitute for historical vintages.

## Coverage and limitations

712 revised economic states cover May 1967–August 2026, but returns exist only
where ETF price histories allow. Price levels begin SPY December 1999, IEF
August 2002, GLD December 2004, TIP January 2004 and DBC March 2006.
The common reference cohort ends June 2026 for 3M outcomes, September 2025
for 12M and September 2023 for 36M. Cohorts differ by horizon; 36M returns
are cumulative, not annualised. Each-asset maximum-history results are also
included in the app; comparisons across assets should use common dates.

Adjusted closes are a provider total-return proxy. There are no costs, taxes,
financing, shorts or leverage. All intervening monthly prices are required.
Near-boundary states are retained. Only two common-date states are exactly
on an anchor; their attractive-looking averages are especially fragile.
The fixed 2% anchor predates the Fed's explicit 2012 objective in early history.

Quadrants are categorical. One-versus-rest point-biserial correlations and
categorical eta² measure sample association; Pearson/Spearman correlations
separately describe continuous activity and inflation gaps. No numeric IDs
are used as ordinal quadrant scores. All are descriptive, not causal.

Overlapping outcomes are addressed with 2,500 paired circular moving-block
resamples, block length max(12, horizon), seed 20261020. Intervals estimate
conditional-minus-unconditional mean uncertainty, not future-return ranges.
They are exploratory, without correction for multiple comparisons, selected
ranks, structural breaks or all data revisions. Episodes are not independent
trials either. Full state history is not full investable price history.

## Reproduce and inspect

Raw input locations and SHA-256 hashes are recorded in `data/state-forward.json`.
Keep provider monthly adjusted CSVs in ignored `work/research/prices/`.
Keep full FRED CFNAIMA3 and PCEPI observations in ignored
`work/state-history-sources.json` as `{SERIES: {observations: [{date, value}]}}`.
The builder rejects duplicate/invalid price months and excludes the partial
October row. It emits derived outcomes only, not provider price levels.

```sh
python scripts/research/state_forward.py
python scripts/research/test_state_forward.py
node scripts/research/verify-state-forward.mjs
npm test
```

The independent Node verifier recomputes all 712 classifications and 21,360
point/asset/lag/horizon outcomes from actual sources, plus all 60 cohorts'
counts, means, medians and positive-return rates without Python helpers.
The 95% intervals are separately checked with synthetic dependent samples.
See [static-state specification](state-forward-protocol.md). The previous
[momentum protocol](protocol.md) and investment-model parameters are unchanged.

Sources: [CFNAI-MA3](https://fred.stlouisfed.org/series/CFNAIMA3),
[PCE](https://fred.stlouisfed.org/series/PCEPI),
[monthly adjusted data](https://www.alphavantage.co/documentation/#monthlyadj),
[Fed 2012 objective](https://www.federalreserve.gov/newsevents/pressreleases/monetary20120125c.htm).
