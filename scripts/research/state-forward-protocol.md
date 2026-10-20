# Static economic state and subsequent asset returns · version 1

Research specification written before computing these conditional results, 20 October 2026.
This is a new descriptive study, not an untouched test of an investment strategy.
The previous momentum walk-forward protocol and model remain frozen.

For every completed monthly reference period with both CFNAI-MA3 and headline
PCE YoY, classify activity by zero and inflation by 2%. Keep exact boundary
observations in a separate bucket. Do not exclude near-boundary readings, tune
thresholds, optimise a lag, or force the illustrative asset map to fit returns.
Below 2% inflation is not necessarily deflation. A constant 2% anchor is a
retrospective convention; the Fed's explicit objective dates from 2012.

Use the locally available monthly adjusted close histories for SPY, IEF, GLD,
TIP and DBC, excluding the unfinished October 2026 row. For state month M,
compute cumulative nominal USD returns P[M + lag + H] / P[M + lag] - 1 for
H = 3, 12 and 36 months and entry lag = 0 or 2 months. Require exact entry
and exit months and every intervening monthly price; never fill gaps, treat
immature outcomes as zero, annualise the displayed cumulative returns, or
substitute synthetic prices before ETF history. Adjusted prices are a provider
total-return proxy; no trading costs, taxes, financing, leverage or shorting.

Lag 0 is a reference-month association with look-ahead and revision bias.
Lag 2 is a fixed publication-delay sensitivity using the SAME revised state;
it is neither ALFRED point-in-time research nor a tradable signal validation.
Historical state vintages and actual release timestamps are not reconstructed.

For each lag and horizon separately, compare (a) each asset's maximum eligible
history and (b) the identical set of state months with mature returns for all
five assets. Report exact cohort dates, all exclusions, means, medians, positive
return rates, 10th/90th percentiles, and state episodes. Benchmark each conditional
mean against that asset's unconditional mean over that SAME cohort, not against
another asset with a different inception date. All monthly states enter once,
regardless of the chart's 12-dot sampling choice.

Quadrants are categorical: do not correlate arbitrary quadrant IDs 1–4 with
returns. Report one-versus-rest point-biserial correlations, categorical eta²,
and continuous Pearson/Spearman correlations with activity and the inflation
gap. These are associations, not causal or predictive claims.

Monthly forward windows overlap. Use 2,500 circular moving-block bootstrap
draws, seed 20261020, block length max(12, H) months, jointly resampling state
and return pairs. Report percentile 95% intervals for each conditional mean's
difference from its own unconditional cohort mean. Withhold intervals if fewer
than 80% of draws contain the category. Counts are overlapping windows, not
independent experiments; episode counts are descriptive and also not independent.
Intervals are exploratory and not adjusted for multiple comparisons or selection
of the best-looking cell. No significance or forecast claims follow from a rank.

Publish derived returns, aggregate results, source hashes, and reproducible code;
retain provider price levels privately. Export one row per state, asset, lag,
and horizon with missing outcomes explicitly labelled. Do not silently refresh
the frozen research snapshot when the live dashboard refreshes.
