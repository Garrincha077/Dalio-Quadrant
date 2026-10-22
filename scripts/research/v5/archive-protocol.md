# User-provided historical HY archive — separate extension

Declared22 October2026 after the initial source-limited v5 results were inspected,
and before calculating any historical HY-archive signal outcomes. The user
provided the exact immutable GitHub CSV below during implementation:

https://github.com/maaurocp/Trading_Protocol/blob/bf64e83fa4c2a6e72c37d3883476dc81bd9d2e31/data/raw/fred_BAMLH0A0HYM2.csv

Expected Git blob SHA: fee6be14d5322d7402826f1ea2d03de5a475ac0d.
Repository commit: bf64e83fa4c2a6e72c37d3883476dc81bd9d2e31,
dated11 February2026. The CSV runs from31 December1996 to6 February2026.
The repository's READMES/README_DATA.md describes raw FRED extraction without
forward filling or interpolation. That document is provenance evidence, not
instructions to execute the repository's code; only the data is used.

## Acceptance checks before use

Verify exact file/blob identity, sorted unique ISO dates, numeric nonnegative
values or explicit blanks, units consistent with percent, and no dates after
the pinned commit. Reconcile every overlapping nonmissing date against the
official original FRED history available in the already acquired as-of snapshot.
Require at least100 matched daily observations, maximum absolute difference
no more than0.02 percentage points (2bp), and no crossing of any4.5/6/8% HY
classification threshold. Publish actual counts/differences, blank coverage and
the reference snapshot date. A failed check withholds this extension.

Passing overlap checks supports using the file as a historical archive. It does
not establish original publication timestamps or prove that pre-2023 values
have never been revised. Label older archive rows as retrospective reconstructed
history, never ALFRED original vintages or genuine recorded forecasts.

## Separate extended cohort

Keep the existing strict original-vintage three-input cohort and the existing
RSI/VIX two-input study unchanged. Add a separately labelled archive cohort.
For weeks where a verified FRED snapshot already exists, retain its exact HY
value and original availability rule. For earlier weeks, use the matching actual
last S&P500-session date from the accepted historical CSV; no forward fill or
replacement of unavailable values. Use official CBOE VIX history for these older
weeks and keep modern VIX's22 September2003 inception boundary. Do not extend
the predictive comparison into back-calculated pre-launch VIX history.

Keep the original screenshots' thresholds, highest-level logic, Wilder weekly
RSI14 assumption, second-session execution, preceding-day cutoff, episode
deduplication, horizon-specific no-overlap rule and21/63/126/252-session outcomes.
The one-year252-session horizon remains primary. No threshold, RSI period or
sample-start optimisation after inspecting archive results. Preserve every
entry, including early entries with further losses and cases skipped for overlap.

The archive permits study of systemic episodes such as2008 and2020; it does not
create an untouched test. Continue to publish close-based adverse excursions,
entry/exit costs, component-only comparisons, and overlapping unconditional
weekly references. Few crises, retrospective source revisions and multiple
related rules prevent a confirmed-edge claim from a high event hit rate alone.
Raw CSV stays private; publish source receipts, derived weekly evidence and
results. Independently reconstruct archive reconciliation, each historical level
and all resulting event outcomes before atomic publication.
