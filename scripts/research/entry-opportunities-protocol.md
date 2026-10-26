# Asset entry opportunities · protocol fixed 26 October 2026

User objective: for each asset, find economic conditions after which its own
3/12/36-month return most exceeded its usual return. Evaluate all three families:
state; state + three-month direction; state + direction + distance from anchors.
This is conditional-return research, not a portfolio rotation optimisation.

## Axes and methodological corrections

Keep official CFNAI-MA3 zero and headline PCE YoY 2% as economic anchors. They
measure activity relative to trend and inflation relative to an analytical target,
not growth/inflation surprises or market expectations. Do not fit anchors or
weights to returns. Apply a numerical tolerance of 1e-9 to exact anchor equality.
Live joint state now requires the two latest axes to describe the same completed
month. Previously a one-month mismatch was accepted; that can describe a pair
that never existed in one reference month. Individual dated readings remain
visible when the joint state is withheld. Historical research already uses exact
same-month pairs; report any change in historical classifications from tolerance.

Use the fixed published revised state snapshot and private common-date asset
panels from extended research. Long public proxies: four risky classes, January
1973–May 2025. ETFs: SPY/IEF/GLD/TIP/DBC, March 2006–September 2026. No splicing.
Reference month m → entry m+2 → exit m+2+h. Require all intervening price months,
full matured outcomes and four consecutive monthly state pairs for the trend.
The two-month delay is a sensitivity to release lags, not a cure for revision bias.
Use a shared eligible cohort for every asset AND every family within panel/horizon.
The long bond/gold observations are reconstructed/monthly averages, not executable
closes. Outcomes are cumulative nominal USD, not annualised or risk-adjusted alpha.

## Fixed categories

- Four signed quadrants, with on-anchor cases retained as a separate category.
  Missing values do not become zero. Near-anchor observations keep their signed
  quadrant but are flagged and separately tested after removing the buffers.
- Three-month change in activity: rising >+0.10; falling <−0.10; otherwise flat.
  Inflation: rising >+0.20 pp; falling <−0.20 pp; otherwise flat. All four monthly
  pairs must exist. Numerical equality belongs to flat.
- Absolute activity distance: near ≤0.10; intermediate >0.10 to ≤0.50; distant >0.50.
  Absolute PCE-minus-2 distance: near ≤0.20 pp; intermediate >0.20 to ≤2.00 pp;
  distant >2.00 pp. Outer bands reuse the existing Close chart's native bounds.
  These are descriptive fixed bands, not fitted cutoffs, tail probabilities or
  claims of economic extremity. No extra threshold search after viewing outcomes.

## Ranking and baseline

For each asset and horizon: lift = conditional mean return − that asset's mean
return over the SAME eligible full cohort. Apply identical round-trip transaction
costs to conditional and baseline outcomes: net=(1+gross)*(1−c)/(1+c)−1. Publish
10 bp each side as the main scenario and 25 bp stress. Asset fund fees already
inside adjusted prices are not deducted twice. Gold custody is zero in the base
panel, as previously disclosed. Ranking is by lift, not absolute return or Sharpe.

Return the raw historical maximum and, separately, the maximum with at least 24
monthly starts and six contiguous condition episodes. Neither threshold proves
independence. Report non-overlapping h-month starts, mean, median, P10, loss
frequency, dates, matching episodes, largest-episode share and worst lift after
removing one episode. Raw maxima from small cells remain visible but explicitly
unsupported. Do not lower sample thresholds to manufacture a winner.

Also report a decade-matched baseline: weight each asset's within-decade cohort
mean by the condition's decade composition. This checks whether lift largely
reflects which decades contain the condition. It is a descriptive sensitivity,
not a causal estimate. Repeat signed-quadrant means excluding the anchor buffers.

## Uncertainty, many comparisons and temporal check

Use paired circular moving-block bootstrap, 5,000 draws, base seed 20261026
(generator seed = base + horizon), block
length max(12,h). Resample the full calendar, keeping return/condition pairs.
Compute conditional-minus-own-baseline mean intervals; suppress intervals when
fewer than 80% of draws contain a case. These are unadjusted 95% intervals. Report
centred two-sided bootstrap p-values with the plus-one correction and apply Holm
across ALL adequately supported asset × horizon × condition comparisons within
each panel. Unsupported cells have no significance claim. Selected maxima and
regime shifts still require independent validation; an unadjusted interval alone
cannot validate the winner. State the total number of comparisons.

Retrospective temporal check: choose the best supported condition on development
outcomes that finished strictly before 2000-01 for the long panel, or 2016-01 for
ETFs. Freeze its identity; evaluate only starts at/after that split, using the
asset's later-period eligible baseline. Do not select a replacement if it loses.
Purge crossing outcomes from development. Selection uses the development lift
only, never the later result. Windows have already been researched, so this is
not an untouched holdout. Missing support means no selected condition.

Compare long proxies and corresponding ETFs over their intersection of eligible
entry dates, separately for each horizon. This isolates source differences from
different sample periods; it does not make the proxy instruments equivalent.

## Deliverables and checks

Add reproducible Python analysis, derived aggregate JSON/CSV, a per-asset/horizon
conditions explorer inside the existing app and a concise findings document.
Keep raw provider inputs private. Verify exact calendar offsets and maturity,
fixed baselines across families, near-anchor classification, sampling support,
bootstrap reproducibility, multiplicity control and temporal leakage. Independently
recompute every exported cell mean/baseline/count from source inputs in Node.
Preserve the previous frozen portfolio research and its published hashes.
