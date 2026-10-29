# Asset entry opportunities: methodology and reproduction

The user chose all 3/12/36-month horizons and all three condition families, ranked
by **conditional mean return minus that asset's usual return**. This study answers
that question directly, independently of the earlier portfolio rotation experiment.

## Evidence and interpretation

`data/entry-opportunities.json` and CSV contain 4,804 asset/horizon/condition cells:
2,704 long public-proxy and 2,100 ETF comparisons. There are 164 and 75 adequately
repeated comparisons respectively under the fixed 24-start/six-episode rule.
**No state + direction + distance cell meets that repetition requirement.** Raw
maxima remain inspectable, explicitly labelled as thin samples. Do not lower the
thresholds or change the bins after seeing the returns.

The shared common-date inputs remain January 1973–May 2025 for long public proxies
and March 2006–September 2026 for ETFs. All historical monthly starts are considered
when complete outcomes exist; the 1980/2013 evaluation cutoffs of the separate
portfolio simulation do not restrict this descriptive study. End dates differ
by horizon. All assets and condition families in a panel/horizon share one cohort
requiring four consecutive economic pairs and complete intervening prices.

For reference month m, entry is m+2 and exit is m+2+h. Prices and economic states
are revised/frozen observations, not the vintage data available at a historical
trade date. Two months of delay does not remove that bias. Below-trend activity
is not necessarily negative growth or recession. Inflation below 2% is not
necessarily deflation. The pre-2012 2% anchor is an analytical historical reference.

Means, medians, P10 and lift are cumulative nominal USD returns, not annualised.
10 bp is charged on each entry/exit side, using
`(1 + grossReturn) * (1 - cost) / (1 + cost) - 1`. The baseline has identical costs.
A separate 25 bp scenario is included. Asset-specific fees in adjusted prices are
not charged twice. No leverage, taxes or currency hedge. Base long gold has no
custody fee; monthly-average gold and reconstructed bonds are research proxies,
not executable month-end products. Sources are unchanged from
[extended research](EXTENDED_STATE.md); no ETF/index splice was introduced.

## Methodology audit and changes

The axes themselves remain CFNAI-MA3 relative to zero and headline PCE YoY relative
to 2%. There is no evidence-based reason to optimise those descriptive anchors for
returns, and the observed historical winners are not used to redefine quadrants.

Two actual implementation problems were corrected in `economic-state-3`:

1. Previously the live joint quadrant accepted activity and inflation reference
   months one month apart. The joint state now requires the same completed month.
   Individual fresh readings keep their own dates and remain visible. The current
   chart also refuses to plot a mixed-month pair from an older saved snapshot.
2. Exact economic anchors now use a numerical tolerance of 1e-9, so arithmetic
   such as `100 * (102 / 100 - 1)` is correctly treated as 2%, not infinitesimally
   above the anchor. This is numerical tolerance, not an economic confidence band.

The frozen historical pairs were already same-month. Tolerance changes **zero**
classifications in that source. Original frozen momentum and portfolio research
files and their hashes are preserved. PWA/API shell versions advance together.

Trend uses the fixed three-month activity/inflation differences and the existing
±0.10 index / ±0.20 pp flat bands. Distance categories use absolute distances:
activity near ≤0.10, intermediate ≤0.50, distant beyond; inflation gap near ≤0.20 pp,
intermediate ≤2 pp, distant beyond. Outer bounds reuse the existing Close chart
view. These bins are descriptive and were declared before inspecting cell returns;
"distant" is not a percentile, statistical tail probability or forecast confidence.

## Baselines, selection and uncertainty

Each cell uses the same asset's unconditional mean over the full eligible cohort
at the same horizon. Never rank an asset against another asset's baseline or a
longer/shorter sample. Median, downside and counts are context; mean lift is the
ranking criterion selected by the user. Raw and adequately repeated maxima are
stored separately. Exact-anchor cases remain a separate category and contribute
to unconditional averages; they are not a fifth signed-quadrant winner.

Supporting diagnostics include the number of contiguous condition episodes,
greedily selected non-overlapping holding windows, largest-episode share, and
worst lift after dropping one selected-condition episode from both the condition
and baseline. These are robustness checks, not proof of independent cycles.
A decade-matched baseline reweights each decade's unconditional asset mean to the
condition's decade mix. A buffer-excluded lift uses a baseline excluding the same
near-anchor observations, avoiding mismatched populations.

Paired circular calendar-block bootstrap: 5,000 draws, block max(12,h), base seed
20261026 plus the horizon. Missing calendar months stay gaps. Both condition and
baseline are recomputed on each sample. Intervals are **unadjusted** 95% intervals
and require at least 80% usable draws. Centred two-sided bootstrap p-values use a
plus-one correction. Holm adjustment covers all adequately repeated asset × horizon
× condition tests in each panel. Thin cells receive no multiplicity claim.
No adequately repeated positive cell passes Holm at 5% in this snapshot. This does
not prove the absence of useful information; it means these scans do not establish
a reliable forecasting edge. Revision bias, researcher selection and structural
breaks remain beyond what those p-values correct.

## Temporal and source checks

For each asset/horizon/family, select one adequately repeated condition using
only development outcomes completed **before** 2000-01 (long) or 2016-01 (ETF).
Drop development labels crossing the split. Freeze the selected identity and
report its lift on starts at/after the split, relative to the later cohort's own
baseline. If the selected condition disappoints, do not replace it with the
later winner. Insufficient development repetition means no selected condition.
These already researched periods are a retrospective temporal check, not an
untouched holdout. Full-sample and earlier-selected winners can differ.

`sameDateProxyCheck` compares four equivalent proxy/ETF classes over exactly the
intersection of eligible entry dates at each horizon. Differences on those dates
reflect instruments/return constructions, not just differing sample periods.
TIPS have no counterpart in the long four-class panel. Leading-condition episode
windows include reference months, two-month-delayed entry months, number of starts
and average forward return; those overlapping averages are not an episode trading
strategy.

## Reproduce and verify

Use the private normalised manifests/inputs described in EXTENDED_STATE.md.
Only numpy/pandas are required for the analysis; original workbook preparation
uses requirements-extended.txt. Run from the repository root:

```sh
OPENBLAS_NUM_THREADS=1 work/research/.venv/bin/python scripts/research/entry_opportunities.py
work/research/.venv/bin/python scripts/research/test_entry_opportunities.py
node scripts/research/verify-entry-opportunities.mjs
node --test test/entry-opportunities.test.mjs
npm test
```

The study writes derived aggregate JSON and CSV, never provider price levels.
Builder, protocol, state source and private panel hashes identify the exact inputs.
Synthetic tests cover exact-anchor tolerance, dates and label maturity, gaps,
asset-specific baselines, episode support, decade matching, reproducible paired
bootstrap, Holm adjustment and no later-outcome influence on temporal selection.

The independent Node verifier does not import Python functions or precomputed
forward labels. It reconstructs every condition and return from the private input
prices and economic pairs, checking **4,804 cells, 1,107 leading episodes and 81
temporal selections**. Bootstrap/multiplicity logic is additionally covered by
synthetic checks. CI validates the public artifact and synthetic examples without
private data or API credentials.
