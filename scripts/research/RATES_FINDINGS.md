# Initial yields and trend findings · 26 October 2026

Adding initial nominal/actual real Treasury yields and then prior 12-month trend does not establish a consistently repeated improvement over macro + 36-month price z-score in this experiment. **No supported positive absolute or paired incremental result passes the pooled-cohort Holm 5% threshold.** This is a limited exploratory model family, not evidence that all yield/return relationships are absent.

Three nested stages use identical training, validation and scored dates within each experiment. Four ridge/history candidates per stage are selected by earlier validation entry lift. Nominal-only and nominal-plus-real cohorts are separate; FII10 has no invented pre-2003 history. Revised and archived information sets are also separate. Earlier frozen experiments are retained.

All table lifts are cumulative net percentage-point differences versus the SAME asset's usual return on the SAME scored cohort. They are not portfolio CAGR, prospective alpha or a cross-asset expected-return ranking.

## Treasury ETF example: promising point estimate, only two episodes

For IEF at 12M using actual archived macro/yield information and the real-yield cohort, adding yields changes lift from -2.33 pp to +5.45 pp. The selected mean is 6.01% versus usual 0.55%; the paired gain versus base is +7.78 pp. The unadjusted lift interval is +1.77 to +10.32 pp; the paired-gain interval is +0.94 to +13.02 pp.

However, the 32 selected starts occupy only two episodes, March 2018–January 2019 and January 2024–September 2025, with three non-overlapping starts. This fails the declared six-episode gate, so adjusted inference is withheld. Nominal yields among these selected dates range 2.83–4.63%, real yields 0.74–2.23%. These are observed selected conditions, not universal entry thresholds.

Adding price trend selects exactly the same 32 starts in this case: incremental selected-return gain versus the yield stage is 0.00 pp. Coefficients/scores can differ despite the same selected mask. The result does not establish a further trend contribution.

## Other assets and sparse/empty decisions

In the real-yield archived ETF 12M experiment, the final trend stage has +3.40 pp for SPY from five starts/three episodes and -20.16 pp for DBC from nine starts/one episode. GLD and TIP have no selected starts in the added-yield/trend stages. Empty selection is unavailable conditional performance, not a zero-return investment outcome.

Across all archived ETF horizons there are only two supported paired comparisons: trend versus rates for IEF at 3M, one per yield cohort. Their gains are +0.24 pp nominal-only and -0.26 pp real cohort, each Holm p=1.000. The data do not support a broad claim of incremental entry skill.

Within each cohort the matching is exact. Cross-cohort differences can include changed training histories. In long revised data the nominal cohort scores from 1990, whereas real-yield scoring begins 2009/2010/2012 at 3/12/36M. Both long archived experiments begin 2012 because macro vintage coverage starts in 2011.

## Complete results

Cells show lift (selected starts / episodes); thin means fewer than 24 starts or six episodes. Missing selection is shown as unavailable. Full intervals, paired gains, rankings and traces are in JSON/CSV. No best-performing outer-period stage is selected for adoption.

### long / revised / nominal yield cohort

Price inputs 1973-01–2025-05. First scored dates: 3M 1990-01, 12M 1990-01, 36M 1990-01.

| Asset | Holding | Scored dates | Macro + z | Add yields | Add trend |
| --- | ---: | ---: | --- | --- | --- |
| EQUITY | 3M | 422 | -0.77 pp (67/16) | +0.23 pp (31/6) | +4.42 pp (11/4) · thin |
| TREASURY | 3M | 422 | +0.56 pp (107/18) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 3M | 422 | +3.48 pp (38/9) | +3.04 pp (75/13) | +1.12 pp (84/14) |
| COMMODITIES | 3M | 422 | -0.95 pp (27/10) | -0.56 pp (74/12) | +0.39 pp (71/16) |
| EQUITY | 12M | 413 | +10.01 pp (13/3) · thin | +17.86 pp (6/1) · thin | +15.61 pp (8/2) · thin |
| TREASURY | 12M | 413 | +1.28 pp (81/22) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 12M | 413 | +1.60 pp (17/5) · thin | +9.27 pp (44/6) | +7.19 pp (46/4) · thin |
| COMMODITIES | 12M | 413 | -6.08 pp (114/17) | -4.00 pp (79/12) | -2.21 pp (59/11) |
| EQUITY | 36M | 389 | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin |
| TREASURY | 36M | 389 | +1.10 pp (87/22) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 36M | 389 | — (0/0) · thin | -20.90 pp (123/18) | -20.45 pp (147/18) |
| COMMODITIES | 36M | 389 | -4.08 pp (71/11) | -1.61 pp (92/8) | -8.74 pp (131/6) |

### long / revised / real yield cohort

Price inputs 1973-01–2025-05. First scored dates: 3M 2009-01, 12M 2010-01, 36M 2012-01.

| Asset | Holding | Scored dates | Macro + z | Add yields | Add trend |
| --- | ---: | ---: | --- | --- | --- |
| EQUITY | 3M | 194 | -0.12 pp (39/7) | -0.96 pp (38/6) | -0.94 pp (39/5) · thin |
| TREASURY | 3M | 194 | +1.88 pp (23/5) · thin | — (0/0) · thin | — (0/0) · thin |
| GOLD | 3M | 194 | -0.71 pp (13/4) · thin | — (0/0) · thin | -5.61 pp (1/1) · thin |
| COMMODITIES | 3M | 194 | -1.03 pp (34/8) | -6.39 pp (12/1) · thin | -4.42 pp (19/4) · thin |
| EQUITY | 12M | 173 | +2.84 pp (6/1) · thin | -23.43 pp (1/1) · thin | -20.90 pp (4/1) · thin |
| TREASURY | 12M | 173 | -6.12 pp (33/9) | -7.03 pp (2/1) · thin | -0.47 pp (7/3) · thin |
| GOLD | 12M | 173 | -20.60 pp (21/1) · thin | -21.99 pp (13/3) · thin | -20.01 pp (20/2) · thin |
| COMMODITIES | 12M | 173 | -5.66 pp (61/4) · thin | -9.21 pp (13/2) · thin | -4.66 pp (16/3) · thin |
| EQUITY | 36M | 125 | +3.97 pp (23/4) · thin | -1.76 pp (75/6) | -3.00 pp (79/4) · thin |
| TREASURY | 36M | 125 | +5.61 pp (50/11) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 36M | 125 | -22.50 pp (46/2) · thin | -35.81 pp (24/1) · thin | -35.40 pp (23/2) · thin |
| COMMODITIES | 36M | 125 | -38.15 pp (12/4) · thin | -37.64 pp (30/2) · thin | -37.64 pp (30/2) · thin |

### etf / revised / nominal yield cohort

Price inputs 2006-03–2026-09. First scored dates: 3M 2016-01, 12M 2016-01, 36M 2018-01.

| Asset | Holding | Scored dates | Macro + z | Add yields | Add trend |
| --- | ---: | ---: | --- | --- | --- |
| SPY | 3M | 126 | — (0/0) · thin | +5.07 pp (1/1) · thin | -3.80 pp (18/2) · thin |
| IEF | 3M | 126 | +0.19 pp (19/5) · thin | -0.69 pp (38/5) · thin | +0.02 pp (43/6) |
| GLD | 3M | 126 | +5.00 pp (25/2) · thin | -10.55 pp (6/1) · thin | -10.55 pp (6/1) · thin |
| TIP | 3M | 126 | -3.19 pp (8/3) · thin | -0.26 pp (8/1) · thin | -0.26 pp (8/1) · thin |
| DBC | 3M | 126 | +2.78 pp (1/1) · thin | -4.25 pp (6/2) · thin | -4.25 pp (6/2) · thin |
| SPY | 12M | 117 | -4.53 pp (15/4) · thin | -11.98 pp (22/6) · thin | -4.58 pp (15/5) · thin |
| IEF | 12M | 117 | -3.37 pp (37/6) | +6.40 pp (21/3) · thin | +6.15 pp (19/3) · thin |
| GLD | 12M | 117 | -0.32 pp (11/3) · thin | — (0/0) · thin | +25.30 pp (9/1) · thin |
| TIP | 12M | 117 | +1.40 pp (14/4) · thin | — (0/0) · thin | — (0/0) · thin |
| DBC | 12M | 117 | -20.63 pp (4/2) · thin | -17.92 pp (8/2) · thin | -17.92 pp (8/2) · thin |
| SPY | 36M | 69 | +11.55 pp (26/4) · thin | +11.55 pp (26/4) · thin | +11.57 pp (27/5) · thin |
| IEF | 36M | 69 | +0.03 pp (28/3) · thin | +7.10 pp (18/2) · thin | +7.10 pp (18/2) · thin |
| GLD | 36M | 69 | -48.17 pp (7/1) · thin | +9.64 pp (8/3) · thin | -5.89 pp (6/3) · thin |
| TIP | 36M | 69 | -6.58 pp (18/4) · thin | +1.51 pp (15/2) · thin | +1.51 pp (15/2) · thin |
| DBC | 36M | 69 | +54.47 pp (5/1) · thin | +35.13 pp (5/2) · thin | +22.90 pp (9/3) · thin |

### etf / revised / real yield cohort

Price inputs 2006-03–2026-09. First scored dates: 3M 2016-01, 12M 2016-01, 36M 2018-01.

| Asset | Holding | Scored dates | Macro + z | Add yields | Add trend |
| --- | ---: | ---: | --- | --- | --- |
| SPY | 3M | 126 | — (0/0) · thin | +5.07 pp (1/1) · thin | -3.80 pp (18/2) · thin |
| IEF | 3M | 126 | +0.19 pp (19/5) · thin | -0.36 pp (34/5) · thin | -0.33 pp (49/7) |
| GLD | 3M | 126 | +5.00 pp (25/2) · thin | +9.36 pp (14/2) · thin | +10.80 pp (12/1) · thin |
| TIP | 3M | 126 | -3.19 pp (8/3) · thin | -0.53 pp (18/3) · thin | -0.74 pp (13/2) · thin |
| DBC | 3M | 126 | +2.78 pp (1/1) · thin | -6.82 pp (12/4) · thin | -7.32 pp (21/5) · thin |
| SPY | 12M | 117 | -4.53 pp (15/4) · thin | -7.23 pp (12/5) · thin | -7.23 pp (12/5) · thin |
| IEF | 12M | 117 | -3.37 pp (37/6) | +5.20 pp (32/2) · thin | +5.20 pp (32/2) · thin |
| GLD | 12M | 117 | -0.32 pp (11/3) · thin | — (0/0) · thin | — (0/0) · thin |
| TIP | 12M | 117 | +1.40 pp (14/4) · thin | — (0/0) · thin | — (0/0) · thin |
| DBC | 12M | 117 | -20.63 pp (4/2) · thin | -19.59 pp (11/2) · thin | -20.04 pp (10/2) · thin |
| SPY | 36M | 69 | +11.55 pp (26/4) · thin | +12.97 pp (25/4) · thin | +11.57 pp (27/5) · thin |
| IEF | 36M | 69 | +0.03 pp (28/3) · thin | +8.49 pp (15/2) · thin | +8.68 pp (16/1) · thin |
| GLD | 36M | 69 | -48.17 pp (7/1) · thin | +51.56 pp (14/2) · thin | +59.75 pp (13/2) · thin |
| TIP | 36M | 69 | -6.58 pp (18/4) · thin | +4.46 pp (12/1) · thin | +4.46 pp (12/1) · thin |
| DBC | 36M | 69 | +54.47 pp (5/1) · thin | -9.57 pp (10/2) · thin | -7.43 pp (11/1) · thin |

### long / vintage / nominal yield cohort

Price inputs 1973-01–2025-05. First scored dates: 3M 2012-01, 12M 2012-01, 36M 2012-01.

| Asset | Holding | Scored dates | Macro + z | Add yields | Add trend |
| --- | ---: | ---: | --- | --- | --- |
| EQUITY | 3M | 156 | +0.84 pp (49/11) | — (0/0) · thin | — (0/0) · thin |
| TREASURY | 3M | 156 | -0.61 pp (53/7) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 3M | 156 | +5.26 pp (16/4) · thin | +0.65 pp (33/8) | +1.15 pp (31/8) |
| COMMODITIES | 3M | 156 | -0.33 pp (22/4) · thin | -2.34 pp (34/6) | -2.21 pp (33/5) · thin |
| EQUITY | 12M | 147 | +1.21 pp (7/3) · thin | — (0/0) · thin | — (0/0) · thin |
| TREASURY | 12M | 147 | +1.79 pp (69/9) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 12M | 147 | +6.56 pp (13/4) · thin | -10.21 pp (20/3) · thin | -8.19 pp (34/2) · thin |
| COMMODITIES | 12M | 147 | -11.68 pp (46/4) · thin | -10.54 pp (51/3) · thin | -11.76 pp (48/1) · thin |
| EQUITY | 36M | 123 | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin |
| TREASURY | 36M | 123 | +7.02 pp (39/7) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 36M | 123 | — (0/0) · thin | -9.64 pp (67/3) · thin | -10.24 pp (68/3) · thin |
| COMMODITIES | 36M | 123 | -23.67 pp (56/5) · thin | -25.73 pp (59/1) · thin | -26.27 pp (57/1) · thin |

### long / vintage / real yield cohort

Price inputs 1973-01–2025-05. First scored dates: 3M 2012-01, 12M 2012-01, 36M 2012-01.

| Asset | Holding | Scored dates | Macro + z | Add yields | Add trend |
| --- | ---: | ---: | --- | --- | --- |
| EQUITY | 3M | 156 | -1.49 pp (31/6) | -1.03 pp (34/6) | -0.92 pp (35/6) |
| TREASURY | 3M | 156 | -1.81 pp (24/3) · thin | +1.08 pp (2/2) · thin | +0.59 pp (6/3) · thin |
| GOLD | 3M | 156 | -3.58 pp (23/3) · thin | — (0/0) · thin | -3.56 pp (6/2) · thin |
| COMMODITIES | 3M | 156 | -2.60 pp (40/6) | -0.50 pp (15/6) · thin | -1.68 pp (26/6) |
| EQUITY | 12M | 147 | -10.64 pp (11/1) · thin | -13.03 pp (14/2) · thin | -13.76 pp (16/2) · thin |
| TREASURY | 12M | 147 | -1.59 pp (44/8) | -5.43 pp (3/1) · thin | +1.45 pp (8/2) · thin |
| GOLD | 12M | 147 | -16.47 pp (34/2) · thin | -18.87 pp (14/3) · thin | -18.04 pp (20/2) · thin |
| COMMODITIES | 12M | 147 | -11.76 pp (48/1) · thin | -17.63 pp (1/1) · thin | -9.49 pp (9/3) · thin |
| EQUITY | 36M | 123 | +4.19 pp (19/7) · thin | -1.39 pp (75/6) | -2.74 pp (80/4) · thin |
| TREASURY | 36M | 123 | +5.67 pp (45/8) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 36M | 123 | -20.18 pp (43/3) · thin | -35.32 pp (24/1) · thin | -34.92 pp (23/2) · thin |
| COMMODITIES | 36M | 123 | -36.05 pp (18/3) · thin | -36.79 pp (30/2) · thin | -36.79 pp (30/2) · thin |

### etf / vintage / nominal yield cohort

Price inputs 2006-03–2026-09. First scored dates: 3M 2016-01, 12M 2016-01, 36M 2018-01.

| Asset | Holding | Scored dates | Macro + z | Add yields | Add trend |
| --- | ---: | ---: | --- | --- | --- |
| SPY | 3M | 122 | — (0/0) · thin | -2.92 pp (2/1) · thin | -2.66 pp (20/3) · thin |
| IEF | 3M | 122 | +0.47 pp (22/3) · thin | -0.46 pp (47/7) | -0.23 pp (47/6) |
| GLD | 3M | 122 | +3.42 pp (22/5) · thin | +2.71 pp (16/2) · thin | -10.32 pp (6/1) · thin |
| TIP | 3M | 122 | -3.10 pp (6/2) · thin | -0.21 pp (8/1) · thin | -0.21 pp (8/1) · thin |
| DBC | 3M | 122 | +3.32 pp (2/2) · thin | -1.31 pp (5/3) · thin | -4.60 pp (6/3) · thin |
| SPY | 12M | 115 | -8.86 pp (1/1) · thin | -6.39 pp (12/5) · thin | -6.39 pp (12/5) · thin |
| IEF | 12M | 115 | -2.33 pp (41/8) | +5.01 pp (28/3) · thin | +6.40 pp (19/3) · thin |
| GLD | 12M | 115 | +18.07 pp (21/3) · thin | — (0/0) · thin | +25.40 pp (9/1) · thin |
| TIP | 12M | 115 | +1.18 pp (13/4) · thin | — (0/0) · thin | — (0/0) · thin |
| DBC | 12M | 115 | -13.42 pp (5/4) · thin | -22.87 pp (6/1) · thin | -22.87 pp (6/1) · thin |
| SPY | 36M | 67 | +13.14 pp (25/4) · thin | +14.66 pp (24/4) · thin | +13.14 pp (25/4) · thin |
| IEF | 36M | 67 | -0.07 pp (29/4) · thin | +7.37 pp (18/2) · thin | +7.37 pp (18/2) · thin |
| GLD | 36M | 67 | -48.36 pp (7/1) · thin | +28.03 pp (9/3) · thin | +40.99 pp (12/3) · thin |
| TIP | 36M | 67 | -6.58 pp (14/4) · thin | +1.94 pp (15/2) · thin | +1.94 pp (15/2) · thin |
| DBC | 36M | 67 | +55.20 pp (7/1) · thin | +25.45 pp (7/3) · thin | +18.55 pp (11/3) · thin |

### etf / vintage / real yield cohort

Price inputs 2006-03–2026-09. First scored dates: 3M 2016-01, 12M 2016-01, 36M 2018-01.

| Asset | Holding | Scored dates | Macro + z | Add yields | Add trend |
| --- | ---: | ---: | --- | --- | --- |
| SPY | 3M | 122 | — (0/0) · thin | -2.92 pp (2/1) · thin | -2.99 pp (16/4) · thin |
| IEF | 3M | 122 | +0.47 pp (22/3) · thin | -0.03 pp (46/6) | -0.29 pp (46/7) |
| GLD | 3M | 122 | +3.42 pp (22/5) · thin | -2.38 pp (1/1) · thin | — (0/0) · thin |
| TIP | 3M | 122 | -3.10 pp (6/2) · thin | -0.70 pp (13/2) · thin | -0.70 pp (13/2) · thin |
| DBC | 3M | 122 | +3.32 pp (2/2) · thin | -2.95 pp (11/3) · thin | -4.44 pp (14/5) · thin |
| SPY | 12M | 115 | -8.86 pp (1/1) · thin | +0.69 pp (3/2) · thin | +3.40 pp (5/3) · thin |
| IEF | 12M | 115 | -2.33 pp (41/8) | +5.45 pp (32/2) · thin | +5.45 pp (32/2) · thin |
| GLD | 12M | 115 | +18.07 pp (21/3) · thin | — (0/0) · thin | — (0/0) · thin |
| TIP | 12M | 115 | +1.18 pp (13/4) · thin | — (0/0) · thin | — (0/0) · thin |
| DBC | 12M | 115 | -13.42 pp (5/4) · thin | -20.16 pp (9/1) · thin | -20.16 pp (9/1) · thin |
| SPY | 36M | 67 | +13.14 pp (25/4) · thin | +15.83 pp (23/4) · thin | +14.66 pp (24/4) · thin |
| IEF | 36M | 67 | -0.07 pp (29/4) · thin | +8.97 pp (14/2) · thin | +8.94 pp (16/1) · thin |
| GLD | 36M | 67 | -48.36 pp (7/1) · thin | +59.56 pp (13/2) · thin | +59.56 pp (13/2) · thin |
| TIP | 36M | 67 | -6.58 pp (14/4) · thin | +4.89 pp (12/1) · thin | +4.89 pp (12/1) · thin |
| DBC | 36M | 67 | +55.20 pp (7/1) · thin | -2.30 pp (12/2) · thin | -6.82 pp (11/1) · thin |

## What the extension adds

- It separates initial yield information from the later realised return and checks genuine historical yield vintages. 247 reconstructions per series were collected, plus revised snapshots, without synthesising real yields before 2003.
- It keeps the original macro/z baseline comparable: every nominal-cohort base result reproduces the previous frozen 36-month joint price model.
- It tests the incremental contribution of rates and trend with matched data and paired selection masks, rather than comparing unrelated date windows.
- Historical favourability ranks make the fitted score inspectable relative to each asset/model's own training history. They are approximate percentiles, not probabilities, cross-asset expected returns or current recommendations. Unconditional/flat models remain unranked.
- Attractive bond episodes are a hypothesis for further temporal confirmation. Repeatedly adding factors until an attractive historical result appears would add another researcher-selection layer. No live entry rule or economic anchor is changed.

Independent verification passes for 3,213 fitted parameter sets, 16,432 dated input rows and 4,728 chronological stage choices. 114 Node tests and 73 Python tests pass; Chromium checks cover all 324 new control combinations.

[Sources, methods and reproduction](RATES_ENTRY.md) · [Protocol](rates-entry-protocol.md).
