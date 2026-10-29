# User-specified weekly bottoming indicator — round 5

Declared 22 October 2026 before calculating this indicator's historical outcomes.
All previous macro research and market history have already been inspected.
This is a separate retrospective event study, not an untouched holdout or proof
that the earlier macro return-ranking models work.

## Original rules

The user supplied two screenshots of the original "Bottoming Indicator (Levels
0–3)" conversation, dated14 December2025 in its text. Preserve these thresholds:

| Level | Label | Weekly S&P500 RSI | VIX close | HY OAS | Required |
| --- | --- | ---: | ---: | ---: | --- |
| 0 | No signal | | | | L1 conditions not satisfied |
| 1 | Bull Reset | <=40 | >=25 | >=4.5% | At least2 of3 |
| 2 | Cyclical Bottom | <=33 | >=30 | >=6% | At least2 of3 |
| 3 | Systemic Bottom | <=30 | >=40 | >=8% | All3 |

Assign the highest satisfied level, with inclusive comparisons. These are stress
severity labels, not a required sequence of economic recovery phases. A high
level does not establish that a price bottom has already occurred.

Screenshots specify weekly RSI and weekly-close confirmation but do not show
the RSI period or exact repeat-alert implementation. Explicit implementation
assumptions: Wilder RSI(14) on completed weekly S&P500 price-index closes;
deduplicate by recording a new signal only on an increase from a previously
known exact level. Downgrades and repeated equal levels remain history, not new
entries. No alerts or messages are sent. No threshold/period optimisation.

Missing inputs are not zero. Compute the lowest confirmed and highest possible
levels by evaluating missing conditions as false/true. Publish an exact level
only if both bounds coincide. An exact level can sometimes be logically known
with one missing input; label its source completeness separately. Primary
historical comparisons require all three actual inputs regardless of the bound.

## Sources and timing

RSI: Yahoo Finance ^GSPC daily price-index closes aggregated into completed
Friday-labelled calendar weeks. This is the S&P500 index, not SPY RSI. SPY
adjusted daily closes are a separate total-return outcome proxy. Verify daily
granularity, positive finite prices, sorted unique dates, no missing weekly
buckets and complete weeks. Use only weeks ending before the information date;
the unfinished current week never becomes a confirmed observation.

VIX: original FRED VIXCLS vintages for the primary cohort, official CBOE VIX
history for the separately labelled longer two-input study. Modern VIX began
22 September2003; earlier back-calculated modern-index history is excluded from
predictive comparisons. Do not use intraday highs or the weekly maximum.

HY: BAMLH0A0HYM2 from FRED, in percent (4.5%=450bp). Provider currently exposes
only approximately3 years. Do not extend this with Moody's investment-grade
spreads, HY ETF prices, another ICE series or unverifiable mirrors. Publish
actual source/vintage coverage and unavailable earlier HY inputs.

For historical decisions, execute at the SECOND actual SPY session after the
Friday-labelled week end, using its adjusted close. The information cutoff is
23:59:59UTC on the preceding calendar day. Reconstruct both FRED series at that
cutoff. Require observations to match the last S&P500 trading session of the
completed week; otherwise withhold that component. This explicitly accommodates
release lag instead of treating the economic reference date as availability.

Live display is a separately dated refresh of the latest completed week using
currently published sources. Until the matching weekly VIX/HY observation is
published, keep that component missing and show bounds. A live reading is not
silently relabelled as an original pre-execution forecast.

## Historical questions and comparisons

Primary: the full three-input rule on the verified complete-source cohort. Show
L1+, L2+ and L3 against single RSI<=40, VIX>=25 and HY>=4.5% component rules,
all on the same eligible weekly calendar. Current source coverage may be too
short to observe systemic events; a zero event count is not a zero return.

Separate longer ablation: RSI<=40 AND VIX>=25 and RSI<=33 AND VIX>=30, alongside
single RSI<=40 and VIX>=25. Begin no earlier than modern VIX's launch. This is
a TWO-input experiment, not a reconstruction of missing historical HY or of
L3. Preserve the source distinction prominently in the UI and exports.

For each rule, a setup episode begins on false-to-true with a known previous
eligible week; a left-censored positive at the first valid week is not a new
event. Repeated weeks are one episode. Apply a horizon-specific no-overlap
cooldown before accepting another entry. Retain all proposed entries with
included/skipped/unmatured status, execution and end dates.

Outcomes: SPY adjusted-close total return at21,63,126,252 actual trading sessions
after execution.252 sessions (~12M) remains primary; shorter bounce horizons
are exploratory. Net return subtracts10bp at entry and10bp at exit, with25bp
per-leg stress. Also show the minimum close-based return from entry during the
holding path (MAE, including the entry's zero). It is not intraday drawdown.
Do not annualise these event outcomes into a continuously invested portfolio
CAGR or report their overlapping observations as independent Sharpe estimates.

Show an unconditional eligible-week outcome reference, retaining its overlapping
windows, as descriptive context. Conditional averages versus that reference are
not a paired causal advantage estimate. Report counts, episodes, medians, hit
rates, net returns, stress returns and MAE. With few stress episodes, withhold
formal significance and any confirmed-edge status. This round publishes no
p-value-driven promotion or threshold search. Include last prior verified
monthly macro-state/momentum and value/price context where available, explicitly
dated; no model is fitted on those retrospective context groupings.

## Reproducibility

Commit this protocol before outcomes. Keep raw index/ETF prices and credentials
private. Publish source hashes, derived weekly RSI/VIX/HY observations, exact
levels or bounds, all setup entries and actual dates, outcome summaries and
missing-source coverage. Independently reconstruct RSI, classification, FRED
availability, event sampling, return paths and fees before atomic publication.
Earlier v1–v4 outputs, protocols and the forward ledger stay bytewise unchanged.
