# Observed US Treasury fund inputs · fixed exploratory protocol · 26 October 2026

User scope: United States only; no international expansion. This continuation
follows inspected prior IEF results. Freeze these rules before inspecting their
returns. The dates were studied previously; this is not an untouched holdout.

## Data upgrade and provenance

Primary universe: IEF, an actual US 7–10Y Treasury ETF. Obtain issuer historical
holdings at exact actual month-end dates through September 2026. Requests must
return the requested fund and as-of date; an ignored date/current snapshot is
unavailable, never a substitute. Retain URL parameters, returned dates, source
hashes and all coverage/error diagnostics. Leave raw payloads private.

Compute normalized Treasury-sleeve weighted YTM (%) and issuer-reported duration
(years) from aligned dated security fields. Include only positive-weight fixed
income US Treasury securities identified by 912 CUSIPs; require >=95% reported
fund weight in eligible Treasuries, <=101%, and >=99% of that weight with finite
YTM and positive duration. Missing bond risk is not imputed. Cash/nonbond assets
are outside these sleeve measures; do not call them exact whole-fund SEC yield
or official fund effective duration. Report captured weights and exclusions.

Use the holdings month entry−2, allowing an extra month for publication. These
are issuer as-of reconstructions retrieved now, not independently timestamped
original publication captures. Do not label the portfolio risk data fully
publication-vintage merely because macro inputs use actual ALFRED archives.

Continue with the existing IEF adjusted total-return proxy, including distributions
and fund expenses. Seek an issuer NAV-with-reinvestment series and reconcile if
available. NAV prices or price-only index levels are not total returns. No new
fee is subtracted for the fund's already embedded expense ratio. Entry/exit costs
remain 10 bp per side, with 25 bp sensitivity.

Pre-result source clarification: the issuer's monthly NAV-reinvestment chart is
available. Keep the existing adjusted market-close series as the primary outcome
and publish issuer NAV total-return outcomes as a separate, matched sensitivity.
Never select the better outcome basis after results. Exclude the chart's dummy
pre-inception points and use only months also covered by observed ETF closes.
Retain provider/market-vs-NAV discrepancies and chart precision as limitations.

## Simple, fixed US rules

Annual carry cushion in percentage points = Treasury-sleeve YTM (%) / duration
(years). In a first-order one-year carry-minus-duration-shock approximation, this
is the parallel yield rise that would offset one year's carry. It omits curve
roll, convexity, fees and changing holdings and is NOT a return forecast.

For entry t use cushion at t−2, and compare it with the median of exactly 60
consecutive earlier monthly cushions t−62 through t−3. Require the complete
history; do not include the tested cushion in its reference distribution, fill
gaps or choose another window after results. Three fixed masks:

1. Carry: cushion > its prior 60-month median.
2. Carry + disinflation: rule 1 and three-month PCE YoY change <−0.20 pp.
3. Carry + disinflation + weak activity: rule 2 and CFNAI-MA3 <0.

Macro reference t−2, exact year-earlier PCE base and four consecutive monthly
pairs, using the frozen earlier method. Numerical anchor tolerance 1e-9. Revised
macro and actual archived macro information remain separate. No coefficient fit,
threshold search, model-family selector or stage replacement after outcomes.
Within each information set, every mask uses identical feature-complete scored
dates and the same IEF returns. No selection is unavailable, not zero return.

## Temporal checks, metrics and duration mechanism

Report 3/12/36M cumulative USD net outcomes: selected mean minus same-asset usual
mean on ALL eligible dates, downside, losses, selection coverage, episodes,
non-overlapping starts and paired gains of rule 2 versus 1 and rule 3 versus 2.
Use 5,000 paired circular calendar blocks, max(12,h), original seed, >=80% valid
draws, support >=24 starts/six episodes for absolute and BOTH masks for paired
inference. Holm pools supported horizons/rules/comparisons within each macro
information set. Intervals remain unadjusted.

Show all fixed temporal segments: through 2015, 2016–2019, 2020–2026. Recompute
each segment's own eligible usual baseline. These descriptive checks never tune
the rule and carry no separate significance claim. A whole-period positive lift
with a failing later segment is not promoted as reliable entry skill.

For 12M rows only, a separate EX-POST diagnostic may compare actual return with
carry minus duration times the subsequent change in observed sleeve YTM, when
both endpoint risk snapshots exist. Future yields may enter that diagnostic only,
never a signal, gate or entry ranking. Rebalancing, cash, roll and convexity leave
a residual; do not present the approximation as exact attribution.

Publish all cases, source feasibility (including unresolved licensed long-history
needs), risk-history coverage, dated inputs/decisions, boundaries, uncertainty,
tests and independent calculations. Preserve earlier studies/live preferences.

## Pre-outcome source-quality clarification

Inspection of the source fields, before computing rule returns, found genuine
missing months and small negative cash/settlement balances. Positive Treasury
weights can consequently exceed 101% even while net fund weights are near 100%.
Replace the provisional <=101% sleeve bound with <=105%, retain >=95%, and require
total reported NET fund weight 95–105%. Treasury-sleeve measures are normalized;
cash/leverage is disclosed, not silently included as a bond. Risk coverage still
requires >=99% of eligible Treasury weight. This is a source-accounting repair,
not a threshold selected on entry performance.

Keep the original complete-60-month reference as PRIMARY. Add one disclosed
missing-history sensitivity: at least 48 observed cushions in that same prior
60-calendar-month window, no gap longer than six months, and a window beginning
no earlier than the first valid source month. Current lagged risk must exist.
Use the median of observed values only; never interpolate missing observations.
Publish both reference modes regardless of outcome, with separate coverage and
fixed temporal checks. Pool supported tests across both reference modes AND both
return bases within each macro information set. Neither mode is selected for
adoption using its measured returns. This availability amendment precedes the
first new rule-return calculation and does not make the experiment prospective.
