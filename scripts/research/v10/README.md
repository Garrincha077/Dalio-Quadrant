# Shock severity, macro regimes and asset opportunity

[Sažetak nalaza na hrvatskom](FINDINGS.hr.md).

The user hypothesized that the largest shocks (L3) precede the best long-term
returns, conditional on static macro states, growth/inflation momentum and asset
price/value z-scores. The [protocol](protocol.md) was committed before these
outcomes. Every historical regime had already been inspected in earlier work;
this is descriptive hypothesis discovery, not an untouched predictive test.

## Main findings

There is partial support, not a universal L3 rule. Mean **annualized net event
returns** over approximately three years, using every eligible weekly start:

| ETF group | L0 | L1 | L2 | L3 |
|---|---:|---:|---:|---:|
| SPY equities | 10.02% | 12.63% | **17.08%** | 15.54% |
| IEF nominal Treasuries | 3.33% | 2.26% | 3.40% | **6.91%** |
| GLD gold | 9.36% | 11.89% | 9.46% | **25.42%** |
| TIP inflation-linked bonds | 3.14% | 3.32% | 5.40% | **9.54%** |
| DBC commodity futures | −0.54% | 4.43% | 7.76% | **8.06%** |

For five-year SPY outcomes, the level means rise monotonically:9.47%,13.34%,
16.42%,17.77%. On three years, L2 beats L3. Ten L3 weeks are only **two crisis
clusters**: nine observations in2008–09 and one in2020. Overlapping weekly means
therefore heavily overweight one crisis; they are not independent samples or a
continuous strategy CAGR. Spacing entries by a full holding horizon changes the
three-year L3 means materially: SPY12.96%, IEF1.69%, GLD13.64%, TIP4.58%, DBC11.17%.
The spacing rule retains the first qualifying date, without choosing the trough.

The first observable L3 in each independent crisis is more revealing:

| Asset | First L3: 3 Oct2008 | First L3: 20 Mar2020 |
|---|---:|---:|
| SPY | 6.17% | 19.75% |
| IEF | 8.68% | −5.31% |
| GLD | 21.79% | 5.50% |
| TIP | 8.15% | 1.01% |
| DBC | −4.34% | 26.69% |

These are annualized three-year net outcomes from execution7 Oct2008 /24 Mar2020.
The2008 first-L3 SPY entry still experienced a31.36% subsequent daily-close loss;
DBC lost37.72% at its worst point. Systemic stress is not a timestamped bottom.
The asset ordering reverses across crises. Known static macro was weak activity /
inflation above2% in2008 and weak activity / inflation below2% in2020. Released
three-month impulses also differed. Dashboard multi-indicator momentum is absent
in2008 and was still positive in March2020 because published inputs lagged the
fast shock. It must not be filled with later revisions or actual future recovery.

## Shared and asset-specific antecedents

These findings look backward from each feature's matched top10% of completed
three-year outcomes. They are candidate hypotheses, not live selection rules,
calibrated probabilities, causal mechanisms or validated feature importance.
Each feature has its own dated complete-input cohort and top-decile cutoff.
Horizon-spaced top counts remain visible; many top starts share a market cycle.

- **Equities:** lower one-year price z, weak prior52-week returns and lower RSI
  commonly preceded the best later outcomes. Top-outcome one-year z median−0.40
  versus1.29 elsewhere; positive value z also appears in the shorter available
  cohort. Several promising static/impulse cells combine inflation above2% but
  falling with activity below trend. Growth direction is not uniform.
- **Gold:** weak activity with inflation above2% and falling growth/inflation
  impulses is a strong descriptive cell. Gold need not have a negative canonical
  price z: top-outcome median is1.49 versus0.74 elsewhere. Thus a universal
  "only buy below the long-run average" rule would reject some strong gold runs.
- **Nominal Treasuries:** weak activity and a lower own one-year price z recur,
  but the post2020 rate regime produces negative long-horizon outcomes. L3 alone
  does not distinguish2008's bond opportunity from2020's subsequent bond losses.
- **Inflation-linked bonds:** high HY spreads, high VIX and elevated own past
  volatility feature prominently. Top-outcome HY median8.38% versus4.29%, VIX25.14
  versus15.89. This resembles crisis dislocation, with small effective samples.
- **Commodities:** relative-value and depressed-price inputs are prominent.
  Value-z median1.41 versus−0.91 elsewhere; one-year price z−0.74 versus0.31.
  First-L3 results differ dramatically between2008 and2020. These findings have
  the additional historical-source disagreement below.

The interactive view retains all12 fixed grouping families, including levels ×
static states × impulses, level × state × short-price z, and time since first L3
× stress improvement. Sparse cells and missing inputs remain visible. No best
historical cell is turned into a production rule. Local five-entry examples are
explicitly chosen with hindsight, separated by52 weeks while targets may overlap.

## Source checks and limitations

The original three-input weekly level history begins in September 2003. Earlier
macro/market archives remain descriptive context; they cannot provide this exact
L3 indicator before its required sources were available. ETF inception further
limits individual asset samples.

Freeze21 October2026. Five genuine daily Yahoo histories are checked against
older verified monthly adjusted-return ratios. No raw price history is public.
SPY and GLD pass the predeclared maximum20bp /95th-percentile2bp tolerance.
IEF, TIP and DBC do **not** pass the maximum test: largest differences are0.962,
0.570 and3.678 percentage points respectively, concentrated in limited historical
months. Some raw closing prices disagree as well; these are not merely price-level
normalization differences. The source receipts retain every outlier. Third-source
checks were unavailable (Stooq endpoint404, Financial Datasets unauthorized/no
credits, Alpha Vantage daily-adjusted premium/rate limit). No tolerance was relaxed,
no provider was silently spliced and no older frozen artifact was overwritten.
All affected-asset results remain exploratory and visibly marked `needs-review`.

Targets span13/52/156/260 actual weekly execution intervals, not exact calendar
years. Require exact asset execution/end closes and complete three-input levels.
Execute at the original second SPY session after the input week; the preceding
calendar day is the information cutoff. Incomplete outcomes remain null. Net
return includes10bp entry/exit costs and a separate25bp check. Cash compounds each
intermediate then-known weekly carry. Annualization uses actual elapsed days.
MAE is the lowest daily adjusted close relative to entry, without intraday data.

Static state uses original-vintage activity versus trend and inflation versus2%.
The last stored monthly feature cutoff is carried for at most62 days. This is
a conservative information set, not a reconstruction of every weekly release;
canonical monthly z can also miss a shock that the current-week one-year z sees.
The current-week score and older canonical score differ in both window and date.
Three-month state changes remain distinct from the full dashboard momentum block,
available only from2011. Canonical value/price z uses its original coverage and
fixed10Y/20Y reference. Value proxies differ by asset; price distance is not fair
value. The extra one-year price z excludes the current close from its252-prior-
session sample and never replaces the canonical score. Missing is never zero.

Fifteen primary L3-versus-exact-level comparisons use156-week calendar blocks,
2,500 draws and the fixed seed. All inferential p-values are withheld because
only two L3 crises are available; percentile intervals do not overcome this.
Individual-crisis omissions remain inspectable. `confirmedEdge` stays false.
Earlier forward records, risk findings and all prior research remain unchanged.

## Reproduce

Requires the frozen private v2/v3 features, v5 histories and v6 calendar. Additional
ETF histories cache under ignored `work/research-v10`; no new API key is required.

```sh
npm run research:v10
npm run research:v10:verify
npm run test:research:v10
npm test
```

Python creates a private candidate. JavaScript independently reconstructs sources,
1,204 causal calendar rows,60,200 asset feature values,24,080 outcome slots
(20,863 complete),4,798 summaries,440 feature comparisons and15 primary block
comparisons before atomic publication to `data/shock-asset-research.json`.
A failure retains the previously published artifact. Source SHA receipts,
monthly-ratio checks, original-feature hashes and the committed protocol are kept.
The Shock & assets tab exposes all five assets/four horizons, exact levels,
first-L3 cases, every combination, top-tail antecedents, dated input inspection,
sample-size filters, source failures, downloads and uncertainty. Evidence loads
only when visited and remains available offline after a successful read.
