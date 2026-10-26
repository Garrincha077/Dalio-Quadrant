# Observed US bond data and fixed-rule findings · 26 October 2026

User scope is United States only. The data upgrade obtains exact-date issuer holdings and a separate issuer reinvestment-performance sensitivity for IEF. The new rules use actual dated Treasury-sleeve yield/duration inputs, with no return-fitted coefficients or threshold search.

**The data are materially more relevant to the bond hypothesis, but no supported positive result passes Holm 5% across the declared fixed-rule experiments.** The primary complete-history test remains sparse because the issuer archive has gaps. A disclosed observed-history sensitivity gives a modest positive pattern that merits further confirmation, not a proven live rule.

## What was obtained

- 233 exact-date issuer snapshots from 290 requests; 57 returned the wrong date, frequently today's portfolio, and were rejected despite successful requests.
- 232 months pass Treasury-sleeve risk gates, spanning September 2006–September 2026. One exact-date month lacks adequate risk fields. Missing 2013/2014/2017 records and early archive unavailability are not backfilled.
- Dated weighted Treasury-sleeve YTM and duration replace the use of a generic 10Y rate plus an assumed current duration in this new study. They are not official whole-fund SEC yield/effective duration.
- Existing adjusted market returns remain primary. Issuer reinvestment-chart NAV returns are a matched sensitivity, on the same eligible dates and the same masks. Across 289 monthly returns, median absolute difference is 5.89 bp, maximum 44.84 bp.
- Historical issuer as-of records were retrieved now; original publication timestamps are not independently captured. A two-month input buffer is an assumption, including when macro inputs use actual archives.

## Primary rule and coverage

The carry cushion is YTM (%) divided by duration (years). It approximates the one-year parallel yield rise that would offset carry, without roll, convexity, changing holdings, cash, fees or execution. For example, 4% / 8 years = 0.5 percentage point / 50 bp. Entry requires this lagged cushion to exceed its earlier five-year median.

The PRIMARY median requires 60 consecutive earlier monthly values. At 12M / actual archived macro / market returns it leaves 57 eligible starts. Carry selects 37 starts in only one episode, with +1.35 pp lift. This lacks repeated independent regimes; it is not a confirmed entry advantage.

A source-quality sensitivity, declared before new rule returns, uses at least 48 observed values in the same 60-calendar-month window, no gap over six months, and no pre-source extrapolation. It does not interpolate data or choose a better window after results. Both variants and both return bases enter the multiplicity family.

## Observed-history sensitivity: a modest positive pattern

For archived macro / market returns / 12M, the sensitivity has 157 scored starts, November 2011–September 2025:

| Fixed rule | Mean selected return | Usual return | Lift | Selected starts / episodes | Holm p |
| --- | ---: | ---: | ---: | ---: | ---: |
| carry | 3.60% | 1.23% | +2.37 pp | 74 / 11 | 0.669 |
| disinflation | 3.64% | 1.23% | +2.42 pp | 30 / 7 | 1.000 |
| weak | 3.66% | 1.23% | +2.43 pp | 21 / 5 | — |

Carry alone has unadjusted interval +0.18 to +5.09 pp and nine non-overlapping starts. Added disinflation gives a similar mean with fewer entries; weak-activity filtering reduces repetition further. These comparisons do not establish a benefit from the additional filters.

Fixed entry-period checks for carry alone, each with its own eligible usual baseline:

| Entry period | Scored starts | Selected / episodes | Lift | Loss frequency among selected |
| --- | ---: | ---: | ---: | ---: |
| Earlier / through 2015 | 48 | 8 / 7 | +1.99 pp | 0.00% |
| 2016–2019 | 40 | 24 / 4 | +1.43 pp | 29.17% |
| 2020–2026 | 69 | 42 / 1 | +3.58 pp | 38.10% |

The direction is positive across these descriptive periods, but the 2020+ carry entries occupy only one episode. Missing observations can also split episodes. Eleven reported episodes are not eleven independent economic cycles. These dates were studied previously and are not untouched holdouts.

## Complete declared results

Cells show cumulative net selected-minus-usual return (selected starts / episodes). Thin fails 24 starts/six episodes. Every rule in a row uses identical eligible dates. The strict primary, gap sensitivity and NAV sensitivity remain separate; none is selected as a winner for adoption.

### vintage macro / complete60 reference / market returns

| Holding | Scored dates | Eligible starts | Carry | Add disinflation | Add weak activity |
| --- | --- | ---: | --- | --- | --- |
| 3M | 2012-01–2026-06 | 64 | +0.17 pp (44/2) · thin | -0.25 pp (24/4) · thin | -0.87 pp (19/4) · thin |
| 12M | 2012-01–2025-09 | 57 | +1.35 pp (37/1) · thin | +0.77 pp (24/4) · thin | +1.06 pp (19/4) · thin |
| 36M | 2012-01–2023-09 | 33 | +0.73 pp (13/1) · thin | +0.61 pp (12/1) · thin | -0.19 pp (9/1) · thin |

### vintage macro / complete60 reference / nav returns

| Holding | Scored dates | Eligible starts | Carry | Add disinflation | Add weak activity |
| --- | --- | ---: | --- | --- | --- |
| 3M | 2012-01–2026-06 | 64 | +0.17 pp (44/2) · thin | -0.25 pp (24/4) · thin | -0.87 pp (19/4) · thin |
| 12M | 2012-01–2025-09 | 57 | +1.35 pp (37/1) · thin | +0.77 pp (24/4) · thin | +1.07 pp (19/4) · thin |
| 36M | 2012-01–2023-09 | 33 | +0.74 pp (13/1) · thin | +0.62 pp (12/1) · thin | -0.18 pp (9/1) · thin |

### vintage macro / observed48 reference / market returns

| Holding | Scored dates | Eligible starts | Carry | Add disinflation | Add weak activity |
| --- | --- | ---: | --- | --- | --- |
| 3M | 2011-11–2026-06 | 164 | +0.32 pp (81/12) | +0.39 pp (30/7) | -0.25 pp (21/5) · thin |
| 12M | 2011-11–2025-09 | 157 | +2.37 pp (74/11) | +2.42 pp (30/7) | +2.43 pp (21/5) · thin |
| 36M | 2011-11–2023-09 | 133 | +7.21 pp (50/11) | +6.53 pp (18/4) · thin | +3.56 pp (11/2) · thin |

### vintage macro / observed48 reference / nav returns

| Holding | Scored dates | Eligible starts | Carry | Add disinflation | Add weak activity |
| --- | --- | ---: | --- | --- | --- |
| 3M | 2011-11–2026-06 | 164 | +0.32 pp (81/12) | +0.39 pp (30/7) | -0.26 pp (21/5) · thin |
| 12M | 2011-11–2025-09 | 157 | +2.37 pp (74/11) | +2.45 pp (30/7) | +2.47 pp (21/5) · thin |
| 36M | 2011-11–2023-09 | 133 | +7.22 pp (50/11) | +6.59 pp (18/4) · thin | +3.61 pp (11/2) · thin |

### revised macro / complete60 reference / market returns

| Holding | Scored dates | Eligible starts | Carry | Add disinflation | Add weak activity |
| --- | --- | ---: | --- | --- | --- |
| 3M | 2012-01–2026-06 | 66 | +0.17 pp (46/1) · thin | -0.64 pp (22/4) · thin | -1.07 pp (18/3) · thin |
| 12M | 2012-01–2025-09 | 57 | +1.35 pp (37/1) · thin | +1.01 pp (22/4) · thin | +1.11 pp (18/3) · thin |
| 36M | 2012-01–2023-09 | 33 | +0.73 pp (13/1) · thin | +0.24 pp (11/1) · thin | -0.19 pp (9/1) · thin |

### revised macro / complete60 reference / nav returns

| Holding | Scored dates | Eligible starts | Carry | Add disinflation | Add weak activity |
| --- | --- | ---: | --- | --- | --- |
| 3M | 2012-01–2026-06 | 66 | +0.17 pp (46/1) · thin | -0.64 pp (22/4) · thin | -1.07 pp (18/3) · thin |
| 12M | 2012-01–2025-09 | 57 | +1.35 pp (37/1) · thin | +1.01 pp (22/4) · thin | +1.12 pp (18/3) · thin |
| 36M | 2012-01–2023-09 | 33 | +0.74 pp (13/1) · thin | +0.25 pp (11/1) · thin | -0.18 pp (9/1) · thin |

### revised macro / observed48 reference / market returns

| Holding | Scored dates | Eligible starts | Carry | Add disinflation | Add weak activity |
| --- | --- | ---: | --- | --- | --- |
| 3M | 2011-11–2026-06 | 168 | +0.36 pp (85/10) | +0.19 pp (29/7) | -0.20 pp (22/5) · thin |
| 12M | 2011-11–2025-09 | 159 | +2.50 pp (76/10) | +2.95 pp (29/7) | +3.23 pp (22/5) · thin |
| 36M | 2011-11–2023-09 | 135 | +7.05 pp (52/10) | +5.98 pp (18/4) · thin | +3.69 pp (13/3) · thin |

### revised macro / observed48 reference / nav returns

| Holding | Scored dates | Eligible starts | Carry | Add disinflation | Add weak activity |
| --- | --- | ---: | --- | --- | --- |
| 3M | 2011-11–2026-06 | 168 | +0.35 pp (85/10) | +0.20 pp (29/7) | -0.19 pp (22/5) · thin |
| 12M | 2011-11–2025-09 | 159 | +2.50 pp (76/10) | +2.98 pp (29/7) | +3.27 pp (22/5) · thin |
| 36M | 2011-11–2023-09 | 135 | +7.05 pp (52/10) | +6.03 pp (18/4) · thin | +3.74 pp (13/3) · thin |

## What remains to improve

The issuer upgrade supplies dated risk inputs, but not a gap-free long observed Treasury total-return index or independently verified original holdings publication times. A long, duration-comparable licensed index/security history remains useful; its concrete input contract is supplied. CRSP documentation was assessed, but no paid source was purchased or accessed. No international analysis is included.

The separate ex-post diagnostic approximates one-year carry minus duration times later observed yield change. Future yields appear only there, never in an entry mask. Residuals retain cash, rebalancing, roll, convexity, fund fees and market/NAV effects. No exact attribution, portfolio CAGR or prospective alpha is claimed.

Independent reconstruction passes for 232 source risk snapshots, 2,452 eligible rows across experiments and all 7,356 fixed-rule decisions. 127 Node tests and 94 Python tests pass. Chromium verifies 72 new control combinations, labels, diagnostics, downloads and missing-data isolation, with no page errors or page overflow at 320/360/390/1440 pixels.

[Sources, methods and reproduction](OBSERVED_US_BONDS.md) · [Protocol and pre-outcome clarifications](observed-us-bonds-protocol.md) · [US long-history data contract](US_TREASURY_INPUT_CONTRACT.md).
