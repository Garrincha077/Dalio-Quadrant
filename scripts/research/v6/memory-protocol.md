# Rolling stress memory and invalidated recovery — separate extension

Declared22 October2026 AFTER the initial41 recovery strategy paths were inspected,
and BEFORE this extension's outcomes. The initial waiting rules did not meet
any economic gate: delayed entries were worse than immediate entry; price z
reduced drawdown but sacrificed return. In particular, a confirmed event held
for52 intervals could remain invested after recovery failed. Preserve all41 paths
unchanged; this is another exposed-history experiment, not an untouched test.

Test a separate continuous policy with a fixed26-week stress memory. At a decision,
`recentStress` is true if any complete L2+ reading exists in the current or prior26
consecutive completed weeks. Each new actual qualifying reading refreshes memory.
A missing reading does not qualify. This differs from an episode-onset waiting
window and is labelled separately; no historical setup/confirmation is rewritten.

Two overlay rules, evaluated anew each week, with no forced52-week holding:
- `memory-price`: risky if40-week core trend is on OR recentStress AND price>10SMA.
- `memory-recovery`: risky if40-week core trend is on OR recentStress AND price>10SMA
  AND both VIX/HY below their respective four-week-earlier known readings.
When the early recovery condition fails, return to the core allocation at the
next verified weekly execution. Re-entry is allowed while the fixed rolling
memory still contains an actual L2+ reading. No stop level is fitted.

Two declared risk estimates for all models and references:
- `slow`: initial52-completed-week sample volatility and10% cap, unchanged.
- `responsive`: cap using max(13-week,52-week sample volatility), both from completed
  SPY weekly returns; it can reduce exposure, never introduce leverage.

For each risk estimate, evaluate both overlays and three matched references:
passive SPY, trend40, and the ungated fast reference risky when price>10SMA OR
price>40SMA. This fast reference tests whether stress memory adds information
beyond the same price signals. Ten paths total, on the initial MAIN2003 calendar,
with identical self-financing10/25bp costs, actual cash, final liquidation and
independently reconstructed daily-close drawdown. No new price/value/macro filter
is fitted; their earlier failures remain visible in the original cohorts.

Apply the initial economic-return and defensive gates against ALL THREE matched
references. Primary eight tests: memory-recovery versus passive, trend40, fast and
memory-price for each of the two risk estimates. Same paired52-week blocks,
2,500 replications, seed20261022 and the initial saved draw starts; Holm over
these eight extension tests. Report correction separately and disclose all
initial experiments. memory-price comparisons are exploratory. Stronger support
requires economic gates, all relevant positive lower95% intervals/Holm p<.05,
and positive annual mean excess differences in every fixed fold. No confirmed
edge; all earlier history was inspected. Preserve every weekly exposure,
source-defined memory state, all ten paths, fixed folds and block omissions.
