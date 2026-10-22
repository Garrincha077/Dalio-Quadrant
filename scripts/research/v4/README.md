# Macro research lab — complete round 4

This is exploratory retrospective research using the verified v2/v3 private
sources. All historical periods were already exposed to earlier research.
There is no untouched holdout or confirmed predictive edge.

Three protocols were committed before their respective results:

- [Ranking protocol](protocol.md): market trend/risk, original-vintage state
  changes and interactions; separate value/price cohort. 84 configurations.
- [Risk protocol](risk-protocol.md): future monthly-return second moments.
  36 further configurations, declared after inspecting the ranking results.
- [Utility-selection protocol](policy-protocol.md): 18 additional causal
  selector procedures over the existing return predictions, declared after
  inspecting the first 120 configurations. No additional predictor tuning.

Every family has identical candidate regularisation/history settings. Selection
uses earlier genuinely out-of-sample outcomes known by the actual cutoff, not
the eventual full-history result. This does not make the overall retrospective
research design prospective.

## What was learned

None of the tested procedures establishes incremental macro advantage. The
results distinguish some local improvements from stronger competing references.

| Experiment, main sample | Market reference | Macro / interaction | Interpretation |
| --- | ---: | ---: | --- |
| 12M ranking selector, rank IC | 0.273 | 0.119 / 0.127 | Macro did not improve ranking |
| 3M ranking selector, rank IC | 0.076 | 0.139 / 0.105 | Improvement is exploratory; paired intervals cross zero |
| 3M risk selector, mean QLIKE | -3.006 | -3.028 / -3.023 | Lower is better; simple past risk scores -3.379 |
| 12M utility selector, net CAGR | 5.76% | 5.73% / 5.88% | Interaction gains over market, but historical mean earns 6.29% |

These rows use different matched calendars and must not be pooled. Main 12M
ranking has 90 completed overlapping starts, April 2018–September 2025, and
101 holding months. Main 3M ranking/risk has 115 starts and 119 holding months.
Main 12M utility selection has 101 starts, May 2017–September 2025, and 112
holding months, June 2017–September 2026. Utility selectors can act earlier
because monthly trading outcomes mature sooner than 12M ranking outcomes.

The 12M utility interaction policy has CAGR 5.88%, excess Sharpe 0.520,
volatility 6.74% and drawdown -14.86%; selected market has 5.76%, 0.510, 6.63%
and -14.97%. Its paired Sharpe difference is 0.0095, 95% block interval
[-0.0662, 0.0808], with Holm p=1. Historical-mean policy has 6.29%, 0.601,
6.46% and -14.24% on the identical holding calendar. This is not a discovery.

Value/price inputs shorten the separate cohort and generally do not improve
the causal selectors. All configurations, losses, selection paths and policy
references remain inspectable in `data/research-lab.json` and the UI.

## Measurement and causal boundaries

- Market features stop at the preceding completed month. No decision-month
  close appears in momentum, past risk or model inputs.
- Macro impulses compare original published state estimates three calendar
  months apart, including revisions. They are not surprises relative to market
  expectations. Frozen dashboard momentum remains a separate calculation.
- Main eligibility requires market/state/impulse availability, not the later
  archived multi-indicator momentum block. The value sample additionally requires
  all five original v3 value and unadjusted-price z-scores; no missing zero.
- Return labels and risk labels mature on the exact future calendar. Only
  mature labels enter training. IC/loss selectors use mature prior forecasts.
- Utility selection uses at most 36 known monthly policy returns, at least 24,
  and excludes the currently incomplete trading interval. The selected strategy
  pays its own actual switching costs, not a splice of standalone candidate P&L.
- Return policies use bounded positive rank tilts around inverse volatility.
  Risk policies forecast monthly-return second moments and use past correlations,
  with forecast volatility bounded to 0.5–2 times past volatility for allocation
  only. Both cap exposure without leverage and charge 10bp/25bp per risky leg.
- QLIKE can be negative because it includes log variance. Lower is better;
  it is neither a probability nor a financial return. Monthly second moments
  are not intramonth volatility or drawdown forecasts.

The complete comparison families are six prediction-primary and ten policy-
primary pairs. Separate Holm corrections cover those families. All other
configuration rankings, horizons and selection diagnostics remain exploratory.
Bootstrap boundaries include exact mathematical ties with a fixed 1e-12 floating
tolerance; independent recalculation found that raw floating ordering could
otherwise drop two of 2,500 boundary ties. No predictor or selection changed.

## Reproduce

The previously verified private sources in `work/research-v2` and
`work/research-v3` are required. No new source download or credential is needed
for this round; do not replace the frozen inputs with today's revisions.

```bash
npm run research:v4
npm run test:research:v4
npm test
```

`experiment.py`, `risk.py` and `policy.py` write private candidates and audit
inputs. Only `verify.mjs` atomically publishes the public file, after independent
source and calculation checks pass. A failed build preserves the previous public
artifact. To check existing private candidates without refitting:

```bash
npm run research:v4:verify
```

The JavaScript verifier independently reconstructs source-derived features,
all 76,380 ridge estimates and 15,276 training cohorts, 4,253 selector decisions,
7,821 outcome values, 11,071 monthly policy rows, all 120 attempt summaries and
32 paired bootstrap calculations. Resampling draws are private audit inputs;
the verifier checks their circular-block structure and independently recalculates
the intervals, p-values and cumulative Holm families from reconstructed outcomes.
Raw provider price levels and credentials remain private. Earlier public v1–v3
research, protocols and forward ledgers remain unchanged.

## Next distinct hypothesis

The present features describe released macro levels and changes. They do not
measure what markets expected, real discount-rate changes, or futures carry.
Further work should acquire and validate those economic inputs before declaring
a new protocol. Repeating regularisation/window searches on this same history
would not answer that missing-information question. Any newly designed historical
experiment remains exploratory; genuinely unseen future observations are needed.
