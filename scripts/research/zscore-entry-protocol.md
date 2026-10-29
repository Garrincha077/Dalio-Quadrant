# Price z-score extension · 26 October 2026

This is a new exploratory hypothesis suggested after inspecting the previous
macro-only research. Freeze this protocol before inspecting this extension's
results. The earlier study and its hashes remain unchanged.

## Definition and chronology

Primary window: 36 months. Sensitivity window: 60 months, reported separately;
do not select the better window using evaluation returns. For a month-end entry
in t, use log of the adjusted return index / price observations t-L through t-1:

    z(t) = [log(P(t-1)) - mean(log(P(t-L)),...,log(P(t-1)))] / sampleSD

The same observation t-1 belongs to the trailing reference distribution. Require
all L consecutive months, positive finite prices and a nonzero SD (>=1e-12).
Do not use the entry-month price in the signal. Use log prices for scale
invariance. This measures relative historical price position, not fundamental
valuation or a guaranteed Gaussian probability. Trend can keep z positive.
Adjusted ETF closes and some long total-return indices include distributions;
the signal is therefore a return-index z-score, not pure unadjusted spot price.
Long bond reconstructions and monthly-average gold remain non-executable proxies.

Use existing prices, 3/12/36M net forward outcomes, exact macro reference lag,
revised and archived-vintage information sets, annual January fits, >=60 matured
training outcomes, and up to five earlier January validation years. All labels
exit strictly before their refit/selection. Vintage training macro histories
come from the refit snapshot, earlier validation from its own snapshots, target
features from their own snapshot. No revised fallback. Price history must be
available before the corresponding entry, including every training feature.

## Four matched procedures

Use identical training, validation and scored dates across all four procedures
within an asset/horizon/window/information set. Even price-only evaluation uses
the common macro-available cohort, to isolate information rather than coverage.
Compare these fixed feature families; do not select a winning family on outer
results:

1. Macro: a,p,da,dp (four features; controlled macro-only ridge baseline).
2. Price: z only (one feature).
3. Joint: a,p,da,dp,z (five features).
4. Interaction: a,p,da,dp,z,a*z,p*z,da*z,dp*z (nine features).

Each family has the same four penalty/history candidates: ridge penalty 10/100,
equal weights or exponential half-life 120 months. Train-only 1st/99th-percentile
clipping of raw inputs precedes expansion; weighted training centering/scaling,
unpenalised intercept, weights normalised to n, X'WX + lambda I.

Within each family select maximum earlier validation entry lift, requiring three
folds/24 predictions and at least 12 selected starts/three episodes. Entry rule:
positive fitted lift and >= training 75th-percentile fitted score, tolerance
1e-12. If enough folds exist but no candidate qualifies positively, use an
unconditional model (no entry). If folds are insufficient, use that SAME family's
penalty-100/full-history model, explicitly marked as a fallback.

This four-candidate macro baseline is deliberately matched to the new ridge
families. It is not the previous 17-candidate cross-family selector and its
results must not be labelled as that selector's previous published performance.

## Evidence and outputs

Report selected-minus-usual cumulative net returns on the identical scored
cohort, uncertainty, support, downside and selected dates. Also report the paired
incremental lift of each new family versus the matched macro baseline. Resample
the same calendar blocks for both entry masks, preserving gaps; block max(12,h),
5,000 draws, seed 20261026+h. Missing selection or insufficient valid resamples
means unavailable inference, never zero return. A support gate needs 24 selected
starts and six episodes; incremental inference requires both masks to pass.

Holm-adjust all supported absolute and incremental tests together across BOTH
window lengths, assets, horizons and procedures within each panel/information
set. Intervals remain unadjusted. These gates do not remove research selection
or make overlapping holdings independent. Do not interpret conditional return
lift as portfolio CAGR, waiting-cash return, probability or prospective alpha.

Publish all four panel/information sets, both windows, model/validation traces,
dated features and decisions, source/protocol/builder hashes, reproduction,
causality tests and an independent input/prediction audit. Render the new research
card with all families visible rather than promoting a best-looking family.
