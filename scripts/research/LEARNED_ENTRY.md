# Learned entry conditions: methods, sources and reproduction

This experiment learns macro/return relationships from history, then evaluates
later entries. It adds a limited calibration of quadrant boundaries, continuous
linear and curved responses, full/recent history and chronological parameter
selection. User objective remains conditional forward return above the same
asset's usual return. No economic chart anchor is fitted to maximise returns.

## Four separate experiments

- Long proxies / revised history: outer scored entries from 1990; input indices
  January 1973–May 2025. Reconstructed bonds and average gold are not executable
  closes. Full current economic history is revised, so this is retrospective.
- ETFs / revised history: outer entries from 2016; common price histories March
  2006–September 2026, with fully matured 3/12/36M labels only.
- Long proxies / actual macro vintages: fit/target macro data from actual archived
  cutoffs; scored starts become possible from 2012. Proxy-price limitations remain.
- ETFs / actual macro vintages: same actual adjusted prices and target horizons,
  using the historical macro information sets available for training and signals.

All procedures within an experiment/asset/horizon have identical scored dates.
The full cohort's realised mean is the evaluation baseline; each forecast uses
only its own historical training baseline. The joint revised/vintage comparison
uses the intersection of scored dates and recomputes each selection and baseline
on those exact dates. It compares full information-set procedures, including the
historical validation data available to them, not revisions in isolation.

## Actual vintage collection

A manual feature-branch GitHub Actions run used the existing repository FRED
secret, without exposing it in artifacts or code:
https://github.com/Garrincha077/Dalio-Quadrant/actions/runs/40311799966

It obtained **185 complete monthly snapshots**, prior-day cutoffs 2011-05-30 to
2026-09-29, with zero request failures. Another 62 scheduled dates predate archive
coverage and remain unavailable. CFNAIMA3's first FRED vintage is 2011-05-23;
PCEPI's first is 2000-08-01. CFNAI's earlier public availability does not mean that
FRED holds the corresponding earlier vintage archive.

Each snapshot requests `realtime_start = realtime_end = cutoff`, with full
observation history from 1966. Every observation's realtime dates and the file's
SHA-256 are checked against the collection manifest. The schedule contains actual
ETF month-end trading dates only, no price levels. The key remains server-side;
only attributed CFNAI/PCE observations and coverage metadata enter the artifact.
Raw snapshots stay under ignored `work/research/state-vintages/`; the research
publishes source hashes and aggregate evidence. The Actions artifact has a short
retention period, so retain a private downloaded copy or refetch with FRED.

Sources:
- CFNAI-MA3: https://fred.stlouisfed.org/series/CFNAIMA3
- Headline PCE index: https://fred.stlouisfed.org/series/PCEPI
- ALFRED realtime semantics: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
- Asset/proxy input definitions: [extended research](EXTENDED_STATE.md).

## Exact chronology and training interpretation

The signal uses reference month entry−2 and four consecutive monthly pairs for
three-month changes. In vintage mode those pairs come from the entry month's own
prior-day snapshot, even if newer observations were available. No missing vintage
or macro feature is replaced by the revised dataset. PCE YoY uses the exact
12-month base within that same snapshot, so price-index rebasing does not mix
units across vintages.

Annual January fits use only outcomes whose exit month is strictly before the
refit month. The entire historical macro reconstruction available **at that
refit date** supplies training features. Thus a 2012 model may learn from 1970s
backcasts already published by 2012. It never pretends that CFNAI trading signals
were public in the 1970s. This is an as-of-refit reconstruction, distinct from
freezing each historical training feature at its original observation date.

Earlier validation folds use their OWN refit snapshots and each validation
month's OWN signal snapshot. Later revisions cannot rewrite earlier validation
predictions. Every label in the validation set must have finished before the
later model selection date. No random splits, forward-filled macro gaps or
future-fitted transforms. Market price histories were retrieved for research;
this is macro publication-vintage evidence, not a contemporaneously deployed
strategy or an untouched prospective test.

## Candidate procedures and learning

Seventeen candidates:

- Nine pooled-quadrant maps: activity anchors −0.20/0/+0.20; PCE 1.5/2/2.5%.
  Each cell's mean shrinks toward its training global mean with 24 pseudo-cases.
- Linear ridge: activity, PCE, three-month changes in activity and PCE.
- Curved ridge: those four plus activity², PCE² and activity×PCE.
- Each ridge family has penalty 10/100 and full history or ten-year weight half-life.

Raw inputs are clipped at TRAINING 1st/99th percentiles, then expanded, centred
and scaled on weighted training means/SD. Weights sum to the training count;
coefficients solve weighted X'X + lambda I, with an unpenalised intercept. No
future percentile/scaler, unrestricted tree or search across thousands of leaves.

Six evaluated procedures:

1. Fixed zero/2% pooled quadrants.
2. Chronologically calibrated quadrant map.
3. Chronologically selected linear ridge.
4. Chronologically selected curved ridge.
5. Model selected by earlier incremental mean forecast error versus its matching
   unconditional forecast.
6. Model selected by earlier ENTRY LIFT, the user's objective: validation selected
   mean minus its same-date unconditional asset mean. Require at least 12 selected
   validation starts and three episodes. This weaker procedural selection gate
   is not a statistical evidence threshold; outer interpretation retains 24/6.

Use up to five earlier January-origin validation years, requiring three usable
folds and 24 paired predictions. Insufficient validation uses a declared linear
ridge lambda=100/full history fallback. If no eligible earlier candidate improves
the selector's objective, it chooses an unconditional model and emits no macro
entry. Tie-breaking is deterministic by the exact candidate ID string.

The entry screen is fixed: positive fitted macro lift and at least the 75th
percentile of fitted TRAINING scores. Numerical tolerance is 1e-12. Ties in
quadrant cells and changes in later condition frequencies mean realised coverage
need not be 25%. Forecasts can be produced even when no entry is selected.

The objective-aligned selector was added as an explicitly documented exploratory
amendment AFTER initial mean-error results were inspected. Both procedures and
all family results remain visible. It is not presented as an untouched
predeclared success; see the [protocol and amendment](learned-entry-protocol.md).

## Metrics, uncertainty and fitted maps

Mean selected-minus-usual return is cumulative nominal USD at 3/12/36 months,
net of 10 bp each entry/exit side. Show 25 bp sensitivity, selected coverage,
episodes, non-overlapping windows, median, P10, historical loss frequency, rank IC
and incremental forecast error. These are entry-screen comparisons, not a capital
allocation backtest: no portfolio CAGR or return on waiting cash is claimed.

Intervals: 5,000 paired circular calendar blocks, length max(12,h), seed
20261026+h. Missing scored months retain their place in the calendar. Intervals
are unadjusted; Holm adjustment covers adequately repeated asset/horizon/procedure
comparisons within each experiment. Previously researched data, model-family
choice, return-index construction and regime change remain limitations.

The app displays the last fitted model's response grid, with its refit date,
vintage cutoff and latest training exit. Some late fitted frontiers have no
mature outer returns yet; they are labelled separately in refit tables. The map
is an inspectable fitted response, not a current allocation recommendation or
validated forecast probability. Continuous inputs outside the training clipping
range flatten. Learned investment boundaries do not move the economic chart axes.

## Reproduce

Prepare private prices as described in EXTENDED_STATE.md. To collect vintages,
run `node scripts/research/fetch-state-vintage-snapshots.mjs` with the server-side
FRED key, or dispatch the existing Macro monitor workflow on the research branch.
The additional job runs only on manual feature-branch dispatch, not daily/main
archive runs or ordinary PR tests. Download its attributed macro artifact into
`work/research/state-vintages/`.

```sh
OPENBLAS_NUM_THREADS=1 work/research/.venv/bin/python scripts/research/learned_entry.py
work/research/.venv/bin/python scripts/research/test_learned_entry.py
node scripts/research/verify-learned-entry.mjs
node --test test/learned-entry.test.mjs
```

Derived outputs: `data/learned-entry.json` and `.csv`. JSON includes both selectors,
all family results, dated model parameters, validation traces, input hashes and
same-date comparisons. CSV holds the objective-aligned selector's complete
matured forecast/entry-screen records. No provider price levels are published.

The independent Node audit rebuilds source macro features, training baselines,
clipping/scaling, pooled cells, ridge coefficients via a separate solver, entry
cutoffs and objective-aligned forecasts. It verifies 4,487 fitted parameter sets,
9,920 dated forecasts and 930 chronological selections. Selection checks use the
published validation traces; synthetic tests independently enforce no later label
or scaler influence. Browser and artifact checks cover the response map, both
information sets and unavailable-data handling. CI needs no key/private data.

Verification on 26 October 2026: 103 Node tests and 46 Python tests pass. Chromium
checks covered all 324 information-set/panel/asset/horizon/procedure combinations,
keyboard focus on response cells, JSON/CSV downloads, deferred loading, and an
aborted research fetch that preserves the earlier research cards. No page errors
or horizontal page overflow at 320, 360, 390 and 1440 pixels were observed.
