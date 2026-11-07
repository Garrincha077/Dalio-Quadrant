# Expanded historical periods · findings · 26 October 2026

Independent per-asset histories materially extend both inputs and evaluation while keeping the frozen yield/trend model recipe. The extension removes the 1990/2016 outer-start floors and common-asset truncation, but retains the original training, maturity, archive and feature requirements.

**The earlier favourable IEF result is not stable when additional pre-2006 training history is admitted. No supported positive absolute or paired incremental comparison passes Holm 5% in the expanded experiments.** Longer history adds useful regimes; it can also weaken a promising result. This does not prove all yield/return relationships are absent.

## How much longer is the evaluation?

At 12M, selected examples of scored monthly starts are:

| Asset / information / cohort | Original first–last | Expanded first–last | Original starts | Expanded starts |
| --- | --- | --- | ---: | ---: |
| EQUITY / revised / nominal | 1990-01–2024-05 | 1974-01–2025-08 | 413 | 620 |
| TREASURY / revised / nominal | 1990-01–2024-05 | 1974-01–2025-09 | 413 | 621 |
| GOLD / revised / nominal | 1990-01–2024-05 | 1982-01–2025-09 | 413 | 525 |
| COMMODITIES / revised / nominal | 1990-01–2024-05 | 1974-01–2024-05 | 413 | 605 |
| SPY / revised / nominal | 2016-01–2025-09 | 2002-01–2025-09 | 117 | 285 |
| SPY / vintage / real | 2016-01–2025-09 | 2012-01–2025-09 | 115 | 163 |
| IEF / vintage / real | 2016-01–2025-09 | 2012-01–2025-09 | 115 | 163 |
| GLD / vintage / real | 2016-01–2025-09 | 2014-01–2025-09 | 115 | 139 |
| TIP / vintage / real | 2016-01–2025-09 | 2013-01–2025-09 | 115 | 151 |
| DBC / vintage / real | 2016-01–2025-09 | 2016-01–2025-09 | 115 | 115 |

The first long nominal 3M scores begin 1973; 36M scores begin 1976 where macro/training availability permits. Gold excludes peg-era training prices and therefore starts later. Actual macro archive evidence still begins only in 2011, allowing January-2012 annual fits. Real yields are not fabricated before 2003. Input histories are longer than eligible learned evaluation histories.

## IEF robustness check: longer history changes the procedure

Original archived real-yield IEF 12M: +5.45 pp lift, 32 selected starts/two episodes. Expanded history increases scored starts from 115 to 163, adding 2012–2015 and earlier training observations from IEF's own 2002-onward source. Its three remaining selected starts belong to one early episode; full expanded lift is -4.00 pp, with no usable 95% bootstrap interval.

On the EXACT same original 115 evaluation dates, the expanded procedure selects zero yield-stage entries. Thus this is not simply averaging the same rule over extra calendar rows: longer training changes validated model choices and fitted scores. Empty selection is unavailable conditional performance, not zero investment return. The original historical +5.45 pp observation remains in the preserved report; it is not erased or replaced.

IEF retains its original price provider, and its same-date usual return is identical in the two procedures. This example therefore directly exposes sensitivity to training coverage/model selection rather than a change to IEF pricing source. It does not justify a reliable negative-return rule either.

## Long reconstructed bonds: positive, concentrated in an earlier regime

Long nominal revised Treasury 12M evaluation expands from 413 to 621 starts, 1974-01–2025-09. The yield stage has +7.66 pp lift, 92 starts/10 episodes, with an unadjusted +1.22 to +14.94 pp interval, but Holm p=1.000. The source remains a reconstructed bond index, not observed executable IEF-like total returns.

Of those 92 selected starts, 91 occur in the added pre-1990 history. Their lift against that earlier cohort's own usual return is +4.37 pp. Only one selected start lies on the old 1990–2024 calendar intersection. The full-period positive point estimate is not evidence of a broadly recurring modern entry advantage.

## Complete extended results

Cells show cumulative net selected-minus-usual return (selected starts / episodes). Thin means fewer than 24 starts or six episodes. Usual return is the same asset on all scored dates of that experiment. Individual assets can cover different eras; compare model stages within each row. No best-looking stage/era is adopted after inspection.

### long / revised / nominal cohort

| Asset | Holding | First–last scored entry | Scored starts | Macro + z | Add yields | Add trend |
| --- | ---: | --- | ---: | --- | --- | --- |
| EQUITY | 3M | 1973-01–2026-05 | 641 | -0.85 pp (82/25) | -1.29 pp (15/9) · thin | +2.24 pp (35/12) |
| TREASURY | 3M | 1973-01–2026-06 | 642 | -0.34 pp (121/20) | +0.25 pp (98/12) | +1.70 pp (136/11) |
| GOLD | 3M | 1982-01–2026-06 | 534 | +3.59 pp (54/10) | +3.52 pp (94/14) | +1.73 pp (100/14) |
| COMMODITIES | 3M | 1973-01–2025-02 | 626 | -0.31 pp (39/12) | -1.30 pp (69/12) | +0.23 pp (109/25) |
| EQUITY | 12M | 1974-01–2025-08 | 620 | +8.34 pp (21/2) · thin | +6.75 pp (22/2) · thin | +6.75 pp (22/2) · thin |
| TREASURY | 12M | 1974-01–2025-09 | 621 | -0.19 pp (160/40) | +7.66 pp (92/10) | +5.96 pp (138/13) |
| GOLD | 12M | 1982-01–2025-09 | 525 | +5.32 pp (31/9) | +13.62 pp (51/7) | +11.84 pp (55/5) · thin |
| COMMODITIES | 12M | 1974-01–2024-05 | 605 | -13.57 pp (62/7) | -6.22 pp (73/13) | -1.30 pp (73/9) |
| EQUITY | 36M | 1976-01–2023-08 | 572 | +2.40 pp (21/3) · thin | +20.62 pp (43/6) | +11.52 pp (25/3) · thin |
| TREASURY | 36M | 1976-01–2023-09 | 573 | +0.95 pp (126/20) | +10.35 pp (56/6) | +12.55 pp (51/6) |
| GOLD | 36M | 1984-01–2023-09 | 477 | -10.74 pp (42/5) · thin | -11.18 pp (172/25) | -12.58 pp (198/26) |
| COMMODITIES | 36M | 1976-01–2022-05 | 557 | -1.29 pp (111/15) | -5.64 pp (114/14) | -9.02 pp (104/13) |

### long / revised / real cohort

| Asset | Holding | First–last scored entry | Scored starts | Macro + z | Add yields | Add trend |
| --- | ---: | --- | ---: | --- | --- | --- |
| EQUITY | 3M | 2009-01–2026-05 | 209 | -0.30 pp (39/7) | -1.13 pp (38/6) | -1.11 pp (39/5) · thin |
| TREASURY | 3M | 2009-01–2026-06 | 210 | +1.89 pp (23/5) · thin | -1.55 pp (3/2) · thin | -1.55 pp (3/2) · thin |
| GOLD | 3M | 2009-01–2026-06 | 210 | +1.60 pp (24/6) | — (0/0) · thin | -5.93 pp (1/1) · thin |
| COMMODITIES | 3M | 2009-01–2025-02 | 194 | -1.03 pp (34/8) | -6.39 pp (12/1) · thin | -4.42 pp (19/4) · thin |
| EQUITY | 12M | 2010-01–2025-08 | 188 | +2.46 pp (6/1) · thin | -23.82 pp (1/1) · thin | -21.28 pp (4/1) · thin |
| TREASURY | 12M | 2010-01–2025-09 | 189 | -6.26 pp (33/9) | -7.16 pp (2/1) · thin | -0.60 pp (7/3) · thin |
| GOLD | 12M | 2010-01–2025-09 | 189 | -10.75 pp (27/3) · thin | -25.24 pp (13/3) · thin | -23.25 pp (20/2) · thin |
| COMMODITIES | 12M | 2010-01–2024-05 | 173 | -5.66 pp (61/4) · thin | -9.21 pp (13/2) · thin | -4.66 pp (16/3) · thin |
| EQUITY | 36M | 2012-01–2023-08 | 140 | +0.44 pp (23/4) · thin | -5.29 pp (75/6) | -6.53 pp (79/4) · thin |
| TREASURY | 36M | 2012-01–2023-09 | 141 | +4.70 pp (66/11) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 36M | 2012-01–2023-09 | 141 | -35.10 pp (46/2) · thin | -48.41 pp (24/1) · thin | -48.00 pp (23/2) · thin |
| COMMODITIES | 36M | 2012-01–2022-05 | 125 | -38.15 pp (12/4) · thin | -37.64 pp (30/2) · thin | -37.64 pp (30/2) · thin |

### etf / revised / nominal cohort

| Asset | Holding | First–last scored entry | Scored starts | Macro + z | Add yields | Add trend |
| --- | ---: | --- | ---: | --- | --- | --- |
| SPY | 3M | 2002-01–2026-06 | 294 | +0.93 pp (26/13) | +0.62 pp (76/18) | -0.23 pp (63/16) |
| IEF | 3M | 2011-01–2026-06 | 186 | +3.00 pp (5/3) · thin | -2.20 pp (7/2) · thin | -2.20 pp (7/2) · thin |
| GLD | 3M | 2014-01–2026-06 | 150 | -13.56 pp (3/1) · thin | -9.91 pp (6/1) · thin | -9.91 pp (6/1) · thin |
| TIP | 3M | 2013-01–2026-06 | 162 | -1.36 pp (29/4) · thin | -0.07 pp (7/1) · thin | -1.11 pp (10/2) · thin |
| DBC | 3M | 2015-01–2026-06 | 138 | -6.32 pp (9/3) · thin | -4.88 pp (11/4) · thin | -6.12 pp (16/4) · thin |
| SPY | 12M | 2002-01–2025-09 | 285 | +15.45 pp (5/2) · thin | +10.53 pp (10/4) · thin | -1.46 pp (6/2) · thin |
| IEF | 12M | 2012-01–2025-09 | 165 | -6.59 pp (29/5) · thin | — (0/0) · thin | — (0/0) · thin |
| GLD | 12M | 2014-01–2025-09 | 141 | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin |
| TIP | 12M | 2013-01–2025-09 | 153 | -0.98 pp (38/1) · thin | -2.09 pp (25/2) · thin | -2.28 pp (24/1) · thin |
| DBC | 12M | 2016-01–2025-09 | 117 | -20.63 pp (4/2) · thin | -17.92 pp (8/2) · thin | -17.92 pp (8/2) · thin |
| SPY | 36M | 2004-01–2023-09 | 237 | -54.14 pp (17/6) · thin | -76.75 pp (1/1) · thin | -19.23 pp (5/3) · thin |
| IEF | 36M | 2014-01–2023-09 | 117 | +1.34 pp (35/5) · thin | — (0/0) · thin | — (0/0) · thin |
| GLD | 36M | 2016-01–2023-09 | 93 | -35.54 pp (7/2) · thin | -41.62 pp (4/1) · thin | -41.62 pp (4/1) · thin |
| TIP | 36M | 2015-01–2023-09 | 105 | -2.95 pp (33/5) · thin | -4.92 pp (11/3) · thin | -4.91 pp (10/2) · thin |
| DBC | 36M | 2018-01–2023-09 | 69 | +54.47 pp (5/1) · thin | +35.13 pp (5/2) · thin | +22.90 pp (9/3) · thin |

### etf / revised / real cohort

| Asset | Holding | First–last scored entry | Scored starts | Macro + z | Add yields | Add trend |
| --- | ---: | --- | ---: | --- | --- | --- |
| SPY | 3M | 2009-01–2026-06 | 210 | -0.43 pp (39/8) | -1.45 pp (27/3) · thin | -1.13 pp (29/3) · thin |
| IEF | 3M | 2011-01–2026-06 | 186 | +3.00 pp (5/3) · thin | -2.20 pp (7/2) · thin | -1.78 pp (8/2) · thin |
| GLD | 3M | 2014-01–2026-06 | 150 | -13.56 pp (3/1) · thin | — (0/0) · thin | — (0/0) · thin |
| TIP | 3M | 2013-01–2026-06 | 162 | -1.36 pp (29/4) · thin | -0.14 pp (6/1) · thin | -1.29 pp (9/2) · thin |
| DBC | 3M | 2015-01–2026-06 | 138 | -6.32 pp (9/3) · thin | -5.66 pp (18/6) · thin | -7.42 pp (33/6) |
| SPY | 12M | 2010-01–2025-09 | 189 | +2.17 pp (6/1) · thin | — (0/0) · thin | -20.29 pp (4/1) · thin |
| IEF | 12M | 2012-01–2025-09 | 165 | -6.59 pp (29/5) · thin | -3.78 pp (2/1) · thin | — (0/0) · thin |
| GLD | 12M | 2014-01–2025-09 | 141 | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin |
| TIP | 12M | 2013-01–2025-09 | 153 | -0.98 pp (38/1) · thin | -2.24 pp (23/2) · thin | -2.24 pp (23/2) · thin |
| DBC | 12M | 2016-01–2025-09 | 117 | -20.63 pp (4/2) · thin | -19.59 pp (11/2) · thin | -20.04 pp (10/2) · thin |
| SPY | 36M | 2012-01–2023-09 | 141 | -2.90 pp (11/3) · thin | -5.63 pp (76/7) | -6.18 pp (80/4) · thin |
| IEF | 36M | 2014-01–2023-09 | 117 | +1.34 pp (35/5) · thin | — (0/0) · thin | — (0/0) · thin |
| GLD | 36M | 2016-01–2023-09 | 93 | -35.54 pp (7/2) · thin | — (0/0) · thin | — (0/0) · thin |
| TIP | 36M | 2015-01–2023-09 | 105 | -2.95 pp (33/5) · thin | — (0/0) · thin | — (0/0) · thin |
| DBC | 36M | 2018-01–2023-09 | 69 | +54.47 pp (5/1) · thin | -9.57 pp (10/2) · thin | -7.43 pp (11/1) · thin |

### long / vintage / nominal cohort

| Asset | Holding | First–last scored entry | Scored starts | Macro + z | Add yields | Add trend |
| --- | ---: | --- | ---: | --- | --- | --- |
| EQUITY | 3M | 2012-01–2026-05 | 169 | -0.12 pp (55/20) | — (0/0) · thin | -5.48 pp (1/1) · thin |
| TREASURY | 3M | 2012-01–2026-06 | 170 | -0.31 pp (61/9) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 3M | 2012-01–2026-06 | 170 | +4.57 pp (28/5) · thin | +1.73 pp (44/9) | +1.56 pp (45/9) |
| COMMODITIES | 3M | 2012-01–2025-02 | 156 | -0.16 pp (1/1) · thin | -0.57 pp (16/4) · thin | -2.71 pp (16/6) · thin |
| EQUITY | 12M | 2012-01–2025-08 | 162 | +3.39 pp (12/6) · thin | — (0/0) · thin | — (0/0) · thin |
| TREASURY | 12M | 2012-01–2025-09 | 163 | +2.17 pp (72/10) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 12M | 2012-01–2025-09 | 163 | +13.70 pp (20/6) · thin | +0.76 pp (28/4) · thin | -2.31 pp (43/3) · thin |
| COMMODITIES | 12M | 2012-01–2024-05 | 147 | — (0/0) · thin | -11.12 pp (28/7) | -12.15 pp (29/5) · thin |
| EQUITY | 36M | 2012-01–2023-08 | 138 | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin |
| TREASURY | 36M | 2012-01–2023-09 | 139 | +6.22 pp (55/7) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 36M | 2012-01–2023-09 | 139 | — (0/0) · thin | -22.47 pp (67/3) · thin | -23.07 pp (68/3) · thin |
| COMMODITIES | 36M | 2012-01–2022-05 | 123 | — (0/0) · thin | -35.04 pp (16/5) · thin | -35.19 pp (15/4) · thin |

### long / vintage / real cohort

| Asset | Holding | First–last scored entry | Scored starts | Macro + z | Add yields | Add trend |
| --- | ---: | --- | ---: | --- | --- | --- |
| EQUITY | 3M | 2012-01–2026-05 | 169 | -1.81 pp (31/6) | -1.35 pp (34/6) | -1.24 pp (35/6) |
| TREASURY | 3M | 2012-01–2026-06 | 170 | -1.82 pp (24/3) · thin | -0.75 pp (5/4) · thin | -0.25 pp (10/5) · thin |
| GOLD | 3M | 2012-01–2026-06 | 170 | -3.05 pp (29/5) · thin | — (0/0) · thin | -3.84 pp (6/2) · thin |
| COMMODITIES | 3M | 2012-01–2025-02 | 156 | -2.60 pp (40/6) | -0.50 pp (15/6) · thin | -1.68 pp (26/6) |
| EQUITY | 12M | 2012-01–2025-08 | 162 | -11.04 pp (11/1) · thin | -13.44 pp (14/2) · thin | -14.16 pp (16/2) · thin |
| TREASURY | 12M | 2012-01–2025-09 | 163 | -1.87 pp (44/8) | -5.72 pp (3/1) · thin | +1.16 pp (8/2) · thin |
| GOLD | 12M | 2012-01–2025-09 | 163 | -11.91 pp (40/4) · thin | -22.82 pp (14/3) · thin | -22.00 pp (20/2) · thin |
| COMMODITIES | 12M | 2012-01–2024-05 | 147 | -11.76 pp (48/1) · thin | -17.63 pp (1/1) · thin | -9.49 pp (9/3) · thin |
| EQUITY | 36M | 2012-01–2023-08 | 138 | +0.57 pp (19/7) · thin | -5.01 pp (75/6) | -6.36 pp (80/4) · thin |
| TREASURY | 36M | 2012-01–2023-09 | 139 | +4.71 pp (61/8) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 36M | 2012-01–2023-09 | 139 | -33.02 pp (43/3) · thin | -48.16 pp (24/1) · thin | -47.76 pp (23/2) · thin |
| COMMODITIES | 36M | 2012-01–2022-05 | 123 | -36.05 pp (18/3) · thin | -36.79 pp (30/2) · thin | -36.79 pp (30/2) · thin |

### etf / vintage / nominal cohort

| Asset | Holding | First–last scored entry | Scored starts | Macro + z | Add yields | Add trend |
| --- | ---: | --- | ---: | --- | --- | --- |
| SPY | 3M | 2012-01–2026-06 | 170 | -1.40 pp (34/4) · thin | -1.04 pp (42/3) · thin | -0.50 pp (45/4) · thin |
| IEF | 3M | 2012-01–2026-06 | 170 | -2.13 pp (22/3) · thin | -1.84 pp (6/1) · thin | -1.94 pp (7/2) · thin |
| GLD | 3M | 2014-01–2026-06 | 146 | +3.78 pp (16/5) · thin | -9.70 pp (6/1) · thin | -9.70 pp (6/1) · thin |
| TIP | 3M | 2013-01–2026-06 | 158 | -1.59 pp (23/5) · thin | -1.25 pp (9/2) · thin | -1.43 pp (11/2) · thin |
| DBC | 3M | 2015-01–2026-06 | 134 | -5.97 pp (9/4) · thin | -4.75 pp (11/5) · thin | -6.74 pp (15/5) · thin |
| SPY | 12M | 2012-01–2025-09 | 163 | -1.53 pp (36/5) · thin | -1.16 pp (52/8) | -4.69 pp (36/6) |
| IEF | 12M | 2012-01–2025-09 | 163 | -2.70 pp (45/13) | — (0/0) · thin | — (0/0) · thin |
| GLD | 12M | 2014-01–2025-09 | 139 | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin |
| TIP | 12M | 2013-01–2025-09 | 151 | -0.90 pp (38/1) · thin | -2.20 pp (24/1) · thin | -2.20 pp (24/1) · thin |
| DBC | 12M | 2016-01–2025-09 | 115 | -13.42 pp (5/4) · thin | -22.87 pp (6/1) · thin | -22.87 pp (6/1) · thin |
| SPY | 36M | 2012-01–2023-09 | 139 | -5.35 pp (24/5) · thin | -3.54 pp (33/2) · thin | -4.87 pp (34/4) · thin |
| IEF | 36M | 2014-01–2023-09 | 115 | +0.95 pp (34/5) · thin | — (0/0) · thin | — (0/0) · thin |
| GLD | 36M | 2016-01–2023-09 | 91 | -41.61 pp (4/1) · thin | -44.39 pp (3/1) · thin | -44.39 pp (3/1) · thin |
| TIP | 36M | 2015-01–2023-09 | 103 | -3.16 pp (24/5) · thin | -5.82 pp (4/3) · thin | -3.82 pp (8/3) · thin |
| DBC | 36M | 2018-01–2023-09 | 67 | +55.20 pp (7/1) · thin | +25.45 pp (7/3) · thin | +18.55 pp (11/3) · thin |

### etf / vintage / real cohort

| Asset | Holding | First–last scored entry | Scored starts | Macro + z | Add yields | Add trend |
| --- | ---: | --- | ---: | --- | --- | --- |
| SPY | 3M | 2012-01–2026-06 | 170 | -1.73 pp (31/6) | -1.48 pp (33/5) · thin | -1.07 pp (35/6) |
| IEF | 3M | 2012-01–2026-06 | 170 | -2.13 pp (22/3) · thin | -1.84 pp (6/1) · thin | -1.94 pp (7/2) · thin |
| GLD | 3M | 2014-01–2026-06 | 146 | +3.78 pp (16/5) · thin | — (0/0) · thin | -9.70 pp (6/1) · thin |
| TIP | 3M | 2013-01–2026-06 | 158 | -1.59 pp (23/5) · thin | -0.10 pp (6/1) · thin | -1.25 pp (9/2) · thin |
| DBC | 3M | 2015-01–2026-06 | 134 | -5.97 pp (9/4) · thin | -3.45 pp (16/5) · thin | -5.33 pp (22/7) · thin |
| SPY | 12M | 2012-01–2025-09 | 163 | -10.06 pp (11/1) · thin | -7.90 pp (15/2) · thin | -10.58 pp (12/1) · thin |
| IEF | 12M | 2012-01–2025-09 | 163 | -2.70 pp (45/13) | -4.00 pp (3/1) · thin | -4.39 pp (2/1) · thin |
| GLD | 12M | 2014-01–2025-09 | 139 | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin |
| TIP | 12M | 2013-01–2025-09 | 151 | -0.90 pp (38/1) · thin | -2.16 pp (23/2) · thin | -2.16 pp (23/2) · thin |
| DBC | 12M | 2016-01–2025-09 | 115 | -13.42 pp (5/4) · thin | -20.16 pp (9/1) · thin | -20.16 pp (9/1) · thin |
| SPY | 36M | 2012-01–2023-09 | 139 | -3.10 pp (8/2) · thin | -5.69 pp (77/7) | -5.91 pp (80/4) · thin |
| IEF | 36M | 2014-01–2023-09 | 115 | +0.95 pp (34/5) · thin | — (0/0) · thin | — (0/0) · thin |
| GLD | 36M | 2016-01–2023-09 | 91 | -41.61 pp (4/1) · thin | — (0/0) · thin | — (0/0) · thin |
| TIP | 36M | 2015-01–2023-09 | 103 | -3.16 pp (24/5) · thin | — (0/0) · thin | — (0/0) · thin |
| DBC | 36M | 2018-01–2023-09 | 67 | +55.20 pp (7/1) · thin | -2.30 pp (12/2) · thin | -6.82 pp (11/1) · thin |

## Sources, limits and next data priority

SPY uses a consistent Yahoo adjusted history from January 1993, without a provider splice. Its 321 overlapping monthly returns differ from the earlier provider by median 0.0050105 bp, maximum 5.261281 bp. The remaining ETF files are unchanged. Long series retain their own end dates: stocks August 2026, reconstructed bonds/gold September 2026, commodities May 2025.

The shared-calendar comparisons and fixed-era point summaries remain descriptive: models can change with longer training, providers can differ, and era results are not newly validated strategies. Overlapping starts are not independent cycles. Revised macro history, backcasts, duration mismatch, monthly-average prices and prior research selection remain. These are not portfolio CAGR or prospective alpha estimates.

The most useful next upgrade for the bond hypothesis is an observed, duration-comparable total-return history with coupons, reinvestment, initial yields and historical duration. Additional markets can add different cycles, provided currencies and local inflation are handled explicitly. More daily rows mainly help execution/drawdown checks. These preferred sources have not been procured by this work.

Independent verification passes for 3,890 fitted parameter sets, 21,376 dated input rows across the experiments and 5,970 chronological choices. 64,128 stage decisions/ranks are exported. 121 Node and 83 Python tests pass; Chromium covers 648 original/expanded control combinations and both failure paths.

[Sources and reproduction](EXPANDED_PERIODS.md) · [Protocol](expanded-periods-protocol.md) · [Data upgrade priorities](DATA_UPGRADE_PLAN.md).
