# Shock severity, macro regime and long-horizon asset opportunity — round 10

Declared 22 October 2026 after previous rounds and source-coverage inspection,
before computing this round's asset outcomes. User hypothesis: the largest
long-term asset returns follow the most severe L3 shock; combine levels 0–3 with
static macro states, growth/inflation momentum and asset price/value z-scores.
This is exploratory exposed-history research. No historical holdout is invented.
The ten L3 weeks belong to only two crisis clusters (2008–09 and 2020).

## Fixed universe, dates and targets

Five existing ETF groups: SPY US equities, IEF nominal Treasuries, GLD gold,
TIP inflation-linked Treasuries, DBC commodity futures. Preserve all earlier data,
protocols and issued ledgers. Reuse frozen v5 exact daily SPY/source weeks and v2/v3
original-vintage features; acquire genuine daily histories for the other four
ETFs through the same fixed 21 October 2026 cutoff. Pin raw-source SHA-256s.
Reconcile monthly daily-source total-return ratios against previously verified
monthly prices; report disagreements and exclude unverified assets from strong
claims rather than silently splicing price levels. Provider adjusted prices are
retrospective total-return histories; asset groups start only at ETF inception.

At each complete three-input weekly reading, execute at its original v5 second
SPY session after the completed week. Features stop at the preceding-day cutoff;
price features stop at the input week's actual last session. Require exact start/
end asset closes, no interpolation. Targets span 13/52/156/260 original weekly
execution intervals (approximately 3 months/1/3/5 years). Primary:156 weeks.
Net event return=(1+gross)*(1-.001)/(1+.001)-1; also25bp each leg. Annualize using
actual elapsed days/365.25, not the average event return. Known cash compounds
all intermediate v6 weekly cash returns. Report net excess total return and
annualized net return, positive frequency, lower-tail outcomes and worst daily
close relative to entry (MAE), not intraday loss or portfolio drawdown/CAGR.
Incomplete targets remain visible and null, never zero.

## At-start features and causal grouping

Keep exact original levels 0–3. Static state uses released activity versus0 and
inflation versus2%, four cells (zero belongs to high). Attach most recent v2
monthly cutoff <= weekly cutoff, at most62 days old. Original published state
impulses compare that release with the release three calendar months earlier.
These are available earlier and are DISTINCT from archived multi-indicator
momentum scores, whose complete availability starts2011. Never fill the missing
2008 momentum block with revised or future observations. Positive/negative/zero
momentum are separately labelled. Retain source cutoffs and missingness.

Keep canonical v3 per-asset price/value z and fixed20-year sensitivity. Price z>0
means price above its history; value z>0 means relatively cheaper by that asset's
stated proxy. Add a separately named exploratory1-year price z: current completed
week log unadjusted close versus the252 previous daily log closes, excluding the
current close, sample standard deviation,252 required observations. It does not
replace the canonical10-year/60-month score. Fixed bins:<-1,[-1,0),[0,1),>=1;
missing stays a separate cell. Retain earlier3/12-month asset momentum,52-week
volatility,10/40-week trend, RSI,VIX,HY and four-week VIX/HY improvement.

Causal crisis cluster: any L1+ week continues the previous stress cluster when
within26 weeks of the latest L1+ week; otherwise begin a new cluster. L3-cluster
membership begins only at the FIRST observed L3 in that cluster, never backdated
to its first L1. Memory since that first L3:0–4,5–13,14–26,27–52,53–104,105–156
weeks, then none. Reset at a genuinely new L3 cluster. Do not label prior entries
using the eventual maximum severity, eventual trough or future price recovery.

## Tables, common antecedents and safeguards

Publish all asset/horizon level summaries and level×static, level×state-impulse,
level×dashboard-momentum, level×canonical-price/value-z, level×1-year-price-z,
static×state-impulse, L3-memory×static, L3-memory×stress-improvement cells.
Also show fixed level×static×state-impulse, and level×static×1-year-price-z cells;
small cells remain visible, never promoted as discoveries. Do not tune bins.
Summaries include both every overlapping weekly start and first-in-time starts
spaced by the full target horizon within each cell. Distinct stress-cluster and
calendar-block counts stay explicit; horizon-spaced observations may still be
related. No overlapping count is called an independent sample size.

For each asset/horizon identify retrospective top-decile outcomes on the same
complete feature cohort, compare at-start feature distributions with all other
outcomes, and show all candidate features (including unhelpful/missing ones).
Each feature uses its own complete target/input cohort and its own top-decile
cutoff; requiring every later feature would silently remove the 2008 crisis.
This is descriptive outcome-conditioned discovery, not a live top-decile rule.
A second view lists local highest-return entry examples, labelled hindsight,
without using those dates to optimize a rule. Describe common versus differing
conditions across independent crises and across asset groups. Distinguish weak
contemporaneous published macro, recovery momentum and cheap entry prices.

Primary severity comparisons: net156-week annualized returns L3 versus each
exact other level for all five assets, identical asset-specific complete targets.
Use156-week circular calendar-block resampling,2500 draws,seed20261022; preserve
missing positions. Report paired group-mean differences and percentile intervals;
no significance claim if L3 appears in fewer than five crisis clusters (already
known to be two). This guard cannot be waived because the average is attractive.
Apply Holm to available primary p-values; all interactions,other horizons and
conditioned top tails remain exploratory. Report leave-one-L3-crisis-out changes
and individual first-L3 entry outcomes; no claim of predictable market bottoms.

No new production allocation is selected from retrospective best cells. Any
hypothesis discovered here needs a separately declared causal subsequent test
and genuinely future evidence. No optimization until a desired outcome appears.
Independent implementation must reconstruct source joins, level/memory dates,
all event returns/cash/MAE, grouping summaries and primary resampling before
atomic publication. Publish complete derived outcomes/features without raw daily
provider price levels or credentials; retain reproducible scripts, source hashes,
missingness, all failed comparisons, a readable report and interactive inspection.
