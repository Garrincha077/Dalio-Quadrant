# Price z-score research findings · 26 October 2026

The hypothesis is useful to test: the same economic state can accompany different price positions. This experiment adds a lagged trailing log-price z-score, with a 36-month primary window and a separate 60-month sensitivity. It does not assume that buying a low z-score is always favourable.

**No supported positive incremental comparison of price-based models versus the matched macro control passes Holm 5%. No supported positive absolute result in a price-containing family passes that threshold either.** Much of the ETF evidence is too sparse for reliable incremental inference. This does not rule out all possible price/macro relationships.

Each family selects among four ridge/history candidates using earlier validation entry lift. The macro baseline is a matched four-candidate ridge control, not the earlier 17-candidate selector. Previously studied periods remain exploratory. All lifts are cumulative net percentage-point differences versus the same asset on identically scored dates, not portfolio CAGR.

## Primary example: gold, actual archived macro information

At 12M with the 36-month price window, GLD's joint model has selected mean 32.50% versus usual 14.44%, a +18.07 pp lift. It selects 21 starts across only three episodes (2016, 2019 and 2024), with three non-overlapping starts. The unadjusted lift interval is +1.32 to +29.24 pp, but repetition fails the declared 24-start/six-episode gate. Its macro control also has only nine selected starts/two episodes; the +30.93 pp paired incremental estimate cannot support a robust claim.

All 21 selected GLD price z-scores are positive, ranging +0.93 to +3.23. This describes the selected historical dates; it is not an estimated universal buy threshold. It illustrates that relative price strength can occur in favourable macro/return episodes. A negative-z entry rule was not assumed.

In the separate 60-month experiment, GLD joint lift is -17.35 pp from nine starts/four episodes. That experiment also begins later (2018 versus 2016), with a different training warmup, so the change does not isolate window length alone. The instability and sparse episodes matter more than the attractive primary point estimate.

## A result with more repeated starts

Long reconstructed Treasuries / actual macro vintages / 12M / 36-month price window: joint lift is +1.79 pp from 69 starts/nine episodes, unadjusted interval -0.66 to +4.36 pp. The interaction model is +2.56 pp from 59 starts/11 episodes, interval +0.07 to +5.00 pp, Holm p=0.770. These are reconstructed long bond prices, not an executable IEF history. Neither establishes a supported price-related advantage.

## Complete results

Table cells show lift (selected starts / episodes); “thin” fails 24 starts/six episodes. Each row uses identical scored dates for all four procedures. Price-only retains macro availability to make coverage comparable. Missing selections are unavailable, not zero returns.

### long / revised / 36-month price history

Price inputs 1973-01–2025-05; evaluation dates depend on horizon and warmup. Long reconstruction/average-quote caveats apply to long panels; revised macro panels remain retrospective.

| Asset | Holding | Scored dates | Macro control | Price only | Joint | Interactions |
| --- | ---: | ---: | --- | --- | --- | --- |
| EQUITY | 3M | 422 | +1.39 pp (72/21) | +2.99 pp (25/4) · thin | -0.77 pp (67/16) | -0.75 pp (51/11) |
| TREASURY | 3M | 422 | +0.08 pp (71/14) | +0.26 pp (70/8) | +0.56 pp (107/18) | +0.26 pp (100/18) |
| GOLD | 3M | 422 | +3.69 pp (22/8) · thin | +14.81 pp (2/1) · thin | +3.48 pp (38/9) | +1.20 pp (29/11) |
| COMMODITIES | 3M | 422 | -1.84 pp (27/12) | -3.39 pp (48/7) | -0.95 pp (27/10) | -1.14 pp (32/12) |
| EQUITY | 12M | 413 | -6.76 pp (42/8) | +2.26 pp (1/1) · thin | +10.01 pp (13/3) · thin | +6.57 pp (4/2) · thin |
| TREASURY | 12M | 413 | -0.92 pp (15/7) · thin | +0.69 pp (70/8) | +1.28 pp (81/22) | +2.23 pp (120/26) |
| GOLD | 12M | 413 | — (0/0) · thin | — (0/0) · thin | +1.60 pp (17/5) · thin | +17.61 pp (9/4) · thin |
| COMMODITIES | 12M | 413 | -2.71 pp (91/24) | -2.91 pp (48/10) | -6.08 pp (114/17) | -4.25 pp (81/21) |
| EQUITY | 36M | 389 | — (0/0) · thin | +54.45 pp (7/3) · thin | — (0/0) · thin | -60.64 pp (4/2) · thin |
| TREASURY | 36M | 389 | — (0/0) · thin | -6.05 pp (74/10) | +1.10 pp (87/22) | +0.50 pp (83/17) |
| GOLD | 36M | 389 | — (0/0) · thin | -23.36 pp (59/5) · thin | — (0/0) · thin | -23.24 pp (6/3) · thin |
| COMMODITIES | 36M | 389 | -11.47 pp (107/12) | -10.46 pp (15/2) · thin | -4.08 pp (71/11) | -10.78 pp (81/11) |

### long / revised / 60-month price history

Price inputs 1973-01–2025-05; evaluation dates depend on horizon and warmup. Long reconstruction/average-quote caveats apply to long panels; revised macro panels remain retrospective.

| Asset | Holding | Scored dates | Macro control | Price only | Joint | Interactions |
| --- | ---: | ---: | --- | --- | --- | --- |
| EQUITY | 3M | 422 | -1.16 pp (60/17) | +8.93 pp (6/2) · thin | +5.14 pp (13/4) · thin | -2.71 pp (31/11) |
| TREASURY | 3M | 422 | +0.13 pp (65/15) | +0.08 pp (51/8) | +0.38 pp (81/17) | +0.33 pp (108/18) |
| GOLD | 3M | 422 | +3.46 pp (23/8) · thin | — (0/0) · thin | +4.18 pp (34/9) | +2.56 pp (59/16) |
| COMMODITIES | 3M | 422 | -2.34 pp (52/22) | -3.87 pp (22/3) · thin | -1.66 pp (62/18) | -1.57 pp (28/10) |
| EQUITY | 12M | 413 | +3.70 pp (39/9) | +17.60 pp (6/2) · thin | -3.71 pp (19/5) · thin | +9.47 pp (3/2) · thin |
| TREASURY | 12M | 413 | +1.63 pp (20/9) · thin | -3.39 pp (55/7) | -0.37 pp (108/26) | +1.46 pp (130/27) |
| GOLD | 12M | 413 | — (0/0) · thin | — (0/0) · thin | +10.19 pp (15/4) · thin | +10.73 pp (31/7) |
| COMMODITIES | 12M | 413 | -1.01 pp (150/31) | -15.72 pp (23/2) · thin | -2.51 pp (100/15) | -1.94 pp (62/20) |
| EQUITY | 36M | 389 | +0.51 pp (12/4) · thin | +35.55 pp (15/7) · thin | -3.44 pp (13/6) · thin | +4.90 pp (17/7) · thin |
| TREASURY | 36M | 389 | +12.43 pp (10/3) · thin | -5.31 pp (52/6) | +11.90 pp (12/5) · thin | +11.89 pp (11/2) · thin |
| GOLD | 36M | 389 | -7.07 pp (26/3) · thin | -17.52 pp (47/4) · thin | — (0/0) · thin | -25.26 pp (1/1) · thin |
| COMMODITIES | 36M | 389 | -11.06 pp (140/10) | — (0/0) · thin | +2.46 pp (113/9) | +0.66 pp (136/13) |

### etf / revised / 36-month price history

Price inputs 2006-03–2026-09; evaluation dates depend on horizon and warmup. Long reconstruction/average-quote caveats apply to long panels; revised macro panels remain retrospective.

| Asset | Holding | Scored dates | Macro control | Price only | Joint | Interactions |
| --- | ---: | ---: | --- | --- | --- | --- |
| SPY | 3M | 126 | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin | -2.07 pp (9/2) · thin |
| IEF | 3M | 126 | -1.30 pp (22/5) · thin | +0.37 pp (24/2) · thin | +0.19 pp (19/5) · thin | +0.12 pp (32/9) |
| GLD | 3M | 126 | -3.39 pp (19/8) · thin | +4.47 pp (16/1) · thin | +5.00 pp (25/2) · thin | +10.57 pp (11/2) · thin |
| TIP | 3M | 126 | -2.51 pp (14/2) · thin | -1.55 pp (5/1) · thin | -3.19 pp (8/3) · thin | -3.67 pp (5/2) · thin |
| DBC | 3M | 126 | — (0/0) · thin | -4.59 pp (12/1) · thin | +2.78 pp (1/1) · thin | -4.38 pp (8/3) · thin |
| SPY | 12M | 117 | -5.22 pp (15/7) · thin | +5.45 pp (1/1) · thin | -4.53 pp (15/4) · thin | +0.78 pp (18/7) · thin |
| IEF | 12M | 117 | -0.02 pp (13/5) · thin | -0.53 pp (56/5) · thin | -3.37 pp (37/6) | -3.67 pp (39/10) |
| GLD | 12M | 117 | -14.47 pp (11/1) · thin | +12.67 pp (6/1) · thin | -0.32 pp (11/3) · thin | +13.19 pp (5/1) · thin |
| TIP | 12M | 117 | -3.18 pp (11/6) · thin | +3.39 pp (14/2) · thin | +1.40 pp (14/4) · thin | +2.10 pp (8/4) · thin |
| DBC | 12M | 117 | +7.58 pp (5/4) · thin | -22.81 pp (15/2) · thin | -20.63 pp (4/2) · thin | -19.33 pp (9/2) · thin |
| SPY | 36M | 69 | +8.09 pp (32/6) | +20.40 pp (16/3) · thin | +11.55 pp (26/4) · thin | +8.44 pp (28/6) |
| IEF | 36M | 69 | -15.28 pp (12/3) · thin | +6.26 pp (45/3) · thin | +0.03 pp (28/3) · thin | -0.24 pp (29/4) · thin |
| GLD | 36M | 69 | -48.17 pp (7/1) · thin | -29.26 pp (20/3) · thin | -48.17 pp (7/1) · thin | -48.17 pp (7/1) · thin |
| TIP | 36M | 69 | -10.19 pp (10/4) · thin | -5.71 pp (25/2) · thin | -6.58 pp (18/4) · thin | -4.74 pp (21/6) · thin |
| DBC | 36M | 69 | +50.57 pp (6/1) · thin | +60.37 pp (5/1) · thin | +54.47 pp (5/1) · thin | +24.88 pp (13/3) · thin |

### etf / revised / 60-month price history

Price inputs 2006-03–2026-09; evaluation dates depend on horizon and warmup. Long reconstruction/average-quote caveats apply to long panels; revised macro panels remain retrospective.

| Asset | Holding | Scored dates | Macro control | Price only | Joint | Interactions |
| --- | ---: | ---: | --- | --- | --- | --- |
| SPY | 3M | 114 | +0.20 pp (17/1) · thin | +8.73 pp (3/2) · thin | -0.87 pp (24/4) · thin | -2.01 pp (35/10) |
| IEF | 3M | 114 | -0.94 pp (28/5) · thin | +0.39 pp (21/3) · thin | +0.44 pp (20/2) · thin | +0.34 pp (31/7) |
| GLD | 3M | 114 | +0.30 pp (33/13) | -7.35 pp (8/3) · thin | +1.70 pp (39/13) | -7.37 pp (16/7) · thin |
| TIP | 3M | 114 | -1.26 pp (28/9) | +1.19 pp (21/1) · thin | -0.10 pp (16/8) · thin | +0.09 pp (17/7) · thin |
| DBC | 3M | 114 | -4.32 pp (14/2) · thin | +7.21 pp (7/2) · thin | -2.97 pp (15/2) · thin | -3.58 pp (13/3) · thin |
| SPY | 12M | 93 | +9.67 pp (17/3) · thin | +19.98 pp (3/2) · thin | +11.06 pp (13/2) · thin | +9.40 pp (16/2) · thin |
| IEF | 12M | 93 | -2.94 pp (27/2) · thin | +4.76 pp (25/3) · thin | -1.88 pp (22/2) · thin | -0.36 pp (36/4) · thin |
| GLD | 12M | 93 | -20.57 pp (5/2) · thin | +5.22 pp (1/1) · thin | -11.65 pp (1/1) · thin | -22.80 pp (4/1) · thin |
| TIP | 12M | 93 | -3.22 pp (20/5) · thin | -5.46 pp (14/2) · thin | -4.93 pp (16/3) · thin | -2.82 pp (23/5) · thin |
| DBC | 12M | 93 | -1.18 pp (13/3) · thin | +46.19 pp (4/1) · thin | +6.67 pp (11/4) · thin | +2.82 pp (10/4) · thin |
| SPY | 36M | 45 | +5.13 pp (33/3) · thin | +24.15 pp (12/3) · thin | +15.64 pp (22/2) · thin | +15.64 pp (22/2) · thin |
| IEF | 36M | 45 | -1.60 pp (26/5) · thin | +9.58 pp (22/3) · thin | +4.99 pp (31/1) · thin | +3.44 pp (34/2) · thin |
| GLD | 36M | 45 | -30.29 pp (15/5) · thin | — (0/0) · thin | +15.03 pp (1/1) · thin | +15.03 pp (1/1) · thin |
| TIP | 36M | 45 | -5.07 pp (23/1) · thin | +9.11 pp (14/2) · thin | -0.38 pp (20/4) · thin | -1.74 pp (28/4) · thin |
| DBC | 36M | 45 | +22.61 pp (4/2) · thin | +59.46 pp (3/1) · thin | +59.46 pp (3/1) · thin | +58.73 pp (6/1) · thin |

### long / vintage / 36-month price history

Price inputs 1973-01–2025-05; evaluation dates depend on horizon and warmup. Long reconstruction/average-quote caveats apply to long panels; revised macro panels remain retrospective.

| Asset | Holding | Scored dates | Macro control | Price only | Joint | Interactions |
| --- | ---: | ---: | --- | --- | --- | --- |
| EQUITY | 3M | 156 | +2.40 pp (5/3) · thin | +1.37 pp (24/4) · thin | +0.84 pp (49/11) | -0.81 pp (28/10) |
| TREASURY | 3M | 156 | -0.30 pp (5/3) · thin | +0.47 pp (48/4) · thin | -0.61 pp (53/7) | +0.04 pp (45/10) |
| GOLD | 3M | 156 | -2.16 pp (4/4) · thin | +15.06 pp (2/1) · thin | +5.26 pp (16/4) · thin | +5.99 pp (5/4) · thin |
| COMMODITIES | 3M | 156 | +1.05 pp (28/8) | -2.94 pp (40/4) · thin | -0.33 pp (22/4) · thin | +1.04 pp (8/5) · thin |
| EQUITY | 12M | 147 | +1.97 pp (9/4) · thin | -5.34 pp (2/1) · thin | +1.21 pp (7/3) · thin | — (0/0) · thin |
| TREASURY | 12M | 147 | -1.24 pp (14/6) · thin | +3.81 pp (48/4) · thin | +1.79 pp (69/9) | +2.56 pp (59/11) |
| GOLD | 12M | 147 | — (0/0) · thin | — (0/0) · thin | +6.56 pp (13/4) · thin | +18.39 pp (10/2) · thin |
| COMMODITIES | 12M | 147 | -12.13 pp (15/7) · thin | -8.30 pp (52/4) · thin | -11.68 pp (46/4) · thin | -11.36 pp (22/5) · thin |
| EQUITY | 36M | 123 | — (0/0) · thin | +5.85 pp (3/2) · thin | — (0/0) · thin | — (0/0) · thin |
| TREASURY | 36M | 123 | — (0/0) · thin | +3.68 pp (52/6) | +7.02 pp (39/7) | +6.42 pp (37/8) |
| GOLD | 36M | 123 | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin |
| COMMODITIES | 36M | 123 | -26.87 pp (30/7) | -23.43 pp (55/5) · thin | -23.67 pp (56/5) · thin | -26.25 pp (38/6) |

### long / vintage / 60-month price history

Price inputs 1973-01–2025-05; evaluation dates depend on horizon and warmup. Long reconstruction/average-quote caveats apply to long panels; revised macro panels remain retrospective.

| Asset | Holding | Scored dates | Macro control | Price only | Joint | Interactions |
| --- | ---: | ---: | --- | --- | --- | --- |
| EQUITY | 3M | 156 | — (0/0) · thin | -0.45 pp (3/2) · thin | — (0/0) · thin | +1.16 pp (5/3) · thin |
| TREASURY | 3M | 156 | +0.31 pp (4/3) · thin | +0.82 pp (50/4) · thin | -1.14 pp (36/7) | -0.79 pp (39/6) |
| GOLD | 3M | 156 | -8.63 pp (3/3) · thin | -6.01 pp (1/1) · thin | +5.15 pp (13/2) · thin | +5.33 pp (16/4) · thin |
| COMMODITIES | 3M | 156 | +0.31 pp (33/8) | -1.04 pp (24/1) · thin | -0.66 pp (18/4) · thin | -1.39 pp (7/5) · thin |
| EQUITY | 12M | 147 | -0.32 pp (8/4) · thin | +2.25 pp (3/2) · thin | +12.74 pp (1/1) · thin | — (0/0) · thin |
| TREASURY | 12M | 147 | -2.09 pp (11/7) · thin | +4.24 pp (50/4) · thin | +3.19 pp (60/8) | +3.52 pp (58/7) |
| GOLD | 12M | 147 | -18.80 pp (1/1) · thin | -9.81 pp (1/1) · thin | — (0/0) · thin | +24.70 pp (11/3) · thin |
| COMMODITIES | 12M | 147 | +0.49 pp (46/12) | -11.48 pp (47/2) · thin | -11.53 pp (37/4) · thin | -7.92 pp (12/4) · thin |
| EQUITY | 36M | 123 | — (0/0) · thin | +10.08 pp (2/1) · thin | — (0/0) · thin | — (0/0) · thin |
| TREASURY | 36M | 123 | — (0/0) · thin | +3.49 pp (53/7) | — (0/0) · thin | — (0/0) · thin |
| GOLD | 36M | 123 | -5.49 pp (64/10) | -42.79 pp (3/1) · thin | -41.81 pp (17/2) · thin | -41.62 pp (16/2) · thin |
| COMMODITIES | 36M | 123 | -16.08 pp (67/6) | -24.35 pp (71/2) · thin | -25.35 pp (61/2) · thin | -26.35 pp (58/3) · thin |

### etf / vintage / 36-month price history

Price inputs 2006-03–2026-09; evaluation dates depend on horizon and warmup. Long reconstruction/average-quote caveats apply to long panels; revised macro panels remain retrospective.

| Asset | Holding | Scored dates | Macro control | Price only | Joint | Interactions |
| --- | ---: | ---: | --- | --- | --- | --- |
| SPY | 3M | 122 | +0.71 pp (1/1) · thin | — (0/0) · thin | — (0/0) · thin | — (0/0) · thin |
| IEF | 3M | 122 | +0.16 pp (9/4) · thin | +0.45 pp (24/2) · thin | +0.47 pp (22/3) · thin | +0.30 pp (33/8) |
| GLD | 3M | 122 | -3.39 pp (16/7) · thin | +3.43 pp (14/2) · thin | +3.42 pp (22/5) · thin | +1.49 pp (14/4) · thin |
| TIP | 3M | 122 | -1.04 pp (2/1) · thin | -1.51 pp (5/1) · thin | -3.10 pp (6/2) · thin | -5.34 pp (3/1) · thin |
| DBC | 3M | 122 | +3.67 pp (1/1) · thin | -4.40 pp (12/1) · thin | +3.32 pp (2/2) · thin | -2.22 pp (14/7) · thin |
| SPY | 12M | 115 | -8.70 pp (5/5) · thin | +5.18 pp (1/1) · thin | -8.86 pp (1/1) · thin | -2.52 pp (10/7) · thin |
| IEF | 12M | 115 | -0.15 pp (13/7) · thin | +2.85 pp (37/3) · thin | -2.33 pp (41/8) | -1.73 pp (46/10) |
| GLD | 12M | 115 | -12.86 pp (9/2) · thin | +12.77 pp (6/1) · thin | +18.07 pp (21/3) · thin | +12.77 pp (6/1) · thin |
| TIP | 12M | 115 | -3.77 pp (11/6) · thin | +3.49 pp (14/2) · thin | +1.18 pp (13/4) · thin | +1.85 pp (7/5) · thin |
| DBC | 12M | 115 | +13.64 pp (4/4) · thin | -16.33 pp (16/3) · thin | -13.42 pp (5/4) · thin | -19.25 pp (12/2) · thin |
| SPY | 36M | 67 | +8.69 pp (28/4) · thin | +20.80 pp (16/3) · thin | +13.14 pp (25/4) · thin | +9.49 pp (27/6) |
| IEF | 36M | 67 | -13.95 pp (11/4) · thin | +6.40 pp (43/3) · thin | -0.07 pp (29/4) · thin | -0.48 pp (30/4) · thin |
| GLD | 36M | 67 | -48.36 pp (7/1) · thin | -29.45 pp (20/3) · thin | -48.36 pp (7/1) · thin | -48.36 pp (7/1) · thin |
| TIP | 36M | 67 | -10.78 pp (8/2) · thin | -5.28 pp (25/2) · thin | -6.58 pp (14/4) · thin | -4.79 pp (19/8) · thin |
| DBC | 36M | 67 | +51.18 pp (6/1) · thin | +60.99 pp (5/1) · thin | +55.20 pp (7/1) · thin | +15.57 pp (13/2) · thin |

### etf / vintage / 60-month price history

Price inputs 2006-03–2026-09; evaluation dates depend on horizon and warmup. Long reconstruction/average-quote caveats apply to long panels; revised macro panels remain retrospective.

| Asset | Holding | Scored dates | Macro control | Price only | Joint | Interactions |
| --- | ---: | ---: | --- | --- | --- | --- |
| SPY | 3M | 110 | -0.91 pp (10/2) · thin | +8.59 pp (3/2) · thin | +5.39 pp (5/2) · thin | -1.05 pp (14/4) · thin |
| IEF | 3M | 110 | +0.00 pp (18/6) · thin | +0.48 pp (21/3) · thin | +0.67 pp (19/2) · thin | +0.16 pp (20/4) · thin |
| GLD | 3M | 110 | -4.16 pp (19/10) · thin | -7.09 pp (8/3) · thin | -1.27 pp (28/13) | -3.95 pp (12/7) · thin |
| TIP | 3M | 110 | +0.08 pp (16/8) · thin | +1.25 pp (21/1) · thin | +0.11 pp (15/7) · thin | +0.23 pp (15/7) · thin |
| DBC | 3M | 110 | -3.65 pp (10/2) · thin | +7.44 pp (7/2) · thin | -3.65 pp (10/2) · thin | -0.46 pp (8/3) · thin |
| SPY | 12M | 91 | +10.70 pp (15/2) · thin | +19.64 pp (3/2) · thin | +13.90 pp (6/3) · thin | +10.93 pp (13/4) · thin |
| IEF | 12M | 91 | -2.30 pp (28/2) · thin | +5.06 pp (25/3) · thin | -1.67 pp (23/2) · thin | -2.06 pp (26/3) · thin |
| GLD | 12M | 91 | -19.02 pp (13/4) · thin | +5.26 pp (1/1) · thin | -17.35 pp (9/4) · thin | -19.54 pp (15/2) · thin |
| TIP | 12M | 91 | -4.29 pp (17/5) · thin | -5.35 pp (14/2) · thin | -5.00 pp (16/4) · thin | -2.25 pp (25/4) · thin |
| DBC | 12M | 91 | +7.19 pp (13/5) · thin | +45.49 pp (4/1) · thin | +18.82 pp (10/4) · thin | +13.10 pp (8/5) · thin |
| SPY | 36M | 45 | +6.93 pp (31/2) · thin | +24.15 pp (12/3) · thin | +15.64 pp (22/2) · thin | +14.60 pp (23/2) · thin |
| IEF | 36M | 45 | -1.73 pp (29/3) · thin | +9.58 pp (22/3) · thin | +4.99 pp (31/1) · thin | +3.44 pp (34/2) · thin |
| GLD | 36M | 45 | -28.74 pp (15/4) · thin | — (0/0) · thin | +2.60 pp (4/2) · thin | +2.82 pp (6/1) · thin |
| TIP | 36M | 45 | -5.07 pp (23/1) · thin | +9.11 pp (14/2) · thin | +0.17 pp (20/4) · thin | -0.87 pp (31/4) · thin |
| DBC | 36M | 45 | +49.09 pp (3/1) · thin | +59.46 pp (3/1) · thin | +59.46 pp (3/1) · thin | +55.55 pp (5/1) · thin |

## Multiplicity and what remains unproven

Holm families combine both window lengths and all supported absolute/incremental tests within each panel/information set. One positive macro-only baseline comparison passes in revised ETF history: SPY 36M, primary price-window cohort, +8.09 pp, 32 starts/six episodes, Holm p=0.029. It contains no price z-score feature, uses revised macro data and only two non-overlapping holdings. It is not evidence that price z-score adds value or confirmation of prospective trading skill.

No supported positive incremental result passes in any of the four panel/information-set populations. The archived ETF experiments have **zero incremental comparisons** where both masks pass 24 starts/six episodes. That is an evidence shortfall, not a precise estimate that the price contribution is zero.

Longer price windows shorten the ETF test and alter training cohorts. Treat the 36/60-month panels as separately disclosed experiments; do not choose the most attractive one after seeing the outcomes. Price z-score is not a valuation measure, and the data include adjusted return indices, reconstruction and monthly-average quotes.

All fitted models and dated decisions are in data/zscore-entry.json and .csv. Independent reconstruction passes for 4,578 fitted parameter sets, 18,770 dated five-input rows and 7,080 chronological family choices. 108 Node tests and 58 Python tests pass; browser verification covers all 432 control combinations.

[Methods, sources and reproduction](ZSCORE_ENTRY.md) · [Protocol](zscore-entry-protocol.md).
