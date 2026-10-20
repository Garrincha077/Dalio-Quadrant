# State + trend research recommendation · state-tilt-1

Specification fixed before inspecting state/trend return rankings, 20 October 2026.
This adds an inspectable asset-class recommendation to the existing dashboard,
using its frozen state-forward-1 outcomes. It is a new research rule, not a
strategy validated by the prior walk-forward investment backtest. Do not change
the frozen momentum experiment, state axes, source data or research summary.

## Inputs and universe

Use the latest fresh, same-month CFNAI-MA3 and headline PCE YoY. If either axis
is missing/stale, reference months differ, or the 3-month trend cannot be built
from four consecutive completed monthly pairs, withhold the recommendation.
Historical replay or selecting a different chart dot does not replace the live
recommendation. Show its exact reference month and trend window separately.

Trend is the change from M−3 to M: CFNAI-MA3 index units and PCE YoY percentage
points. Classify each as rising (>+0.1 activity / >+0.2 pp inflation), falling
(<−0.1 / <−0.2), or broadly flat. Thresholds use the existing boundary-buffer
magnitudes as fixed noise bands, not fitted return parameters. A floating-point
tolerance of 1e−9 keeps the exact band edges flat. No momentum or forecast is
inferred from the chart's monthly/quarterly/annual sampling.

Use common eligible state months for all SPY/IEF/GLD/TIP/DBC assets, a fixed
two-month entry delay, and the selected 3/12/36-month cumulative return horizon.
Require all five actual return labels and a complete preceding trend window.
Use no exit after the frozen price cutoff or the last completed current month.
The lag remains a revised-data sensitivity, not a historical publication vintage.
Return units are nominal USD total-return proxies without costs or annualisation.

## Pooling and boundaries

At each of the four quadrants q, let Nq be the quadrant's count and Nt the count
with the current pair of trend directions. Pool empirical distributions in two
steps using a fixed 24 pseudo-observations:

    parent(q) = Nq/(Nq+24) × quadrant(q) + 24/(Nq+24) × unconditional
    component(q) = Nt/(Nt+24) × same state+trend + 24/(Nt+24) × parent(q)

Zero counts fall back completely to the parent distribution. Weights apply to
the same historical rows for every asset. Means and weighted quantiles are then
computed from the resulting empirical distribution, not averages of quantiles.
Weighted quantiles use the first ordered return whose cumulative weight reaches
the requested probability. Each asset's lift is relative to its own unconditional
mean on the exact same eligible cohort. It is not alpha or risk-adjusted return.

Use soft membership only inside the chart's existing boundary buffers: activity
above-trend share = clip((activity + 0.1)/0.2, 0, 1); inflation-above-2 share =
clip((PCE−2 + 0.2)/0.4, 0, 1). Multiply the axis shares to obtain four quadrant
weights. Outside the buffers membership is entirely in the signed quadrant.
These shares are blending weights, not quadrant probabilities. Exactly zero
activity gives equal weight to either side; +0.01 gives 55%/45%, not a strong
expansion call. The chart's hard classification is unchanged.

## Output and evidence

Rank the five classes by the blended, pooled historical mean for the chosen
horizon, not by raw mean from a tiny cell. Show all five, emphasise the first
three, and disclose median, P10, weighted historical loss frequency, lift,
cohort dates, sample/episode counts and the trend/parent/global mixing weights.
If the leader's mean is non-positive, show no positive historical preference.
If the first two means differ by less than one percentage point, flag close
leaders. Show which active neighbouring quadrant components prefer which asset.
This is a relative asset-class research preference, not portfolio weights.

Call state+trend coverage thin below 24 distinct matched monthly starts or six
separate matched episodes. Overlapping returns and shared episodes make neither
count independent. Broader coverage does not imply validated forecasting skill.
Always disclose near-boundary sensitivity, revised-data bias, price cutoff,
research date, structural regime risk and the absence of an out-of-sample test
of this new ranking rule. Do not borrow confidence intervals from the earlier
static tables or portray weighted loss frequencies as future probabilities.
