# Learned entry conditions · fixed protocol · 26 October 2026

Objective: learn repeatable macro/asset-return relationships from history and test
whether they identify later starts with higher returns than the same asset's
usual return. Evaluate every asset at 3/12/36 months. Keep earlier frozen studies.
This protocol is written before inspecting results of the new fitted procedures.

## Information sets and populations

Use existing common-date ETF and four-class long-proxy inputs and nominal USD
outcomes. Reference month = entry month minus two; require activity/PCE pairs and
three-month changes from four consecutive reference months. Entry/exit costs are
10 bp each side, with 25 bp stress. Only complete price paths and completed labels.

Publish revised-history and real-time-vintage panels separately. Revised mode
uses the frozen current macro history and is explicitly retrospective. Vintage
mode uses CFNAIMA3/PCEPI observations as published at the exact prior calendar day
of each actual month-end trade. The signal deliberately uses the same fixed
reference-month lag even if newer releases were available; no future release is
assumed. Model fitting uses the full historical macro reconstruction available
at its refit cutoff, including backcasts that had by then been published. It does
not pretend those reconstructed pre-2001 features were public trading signals.

Inner validation fits use the information set archived at each earlier fold's
own cutoff; later macro revisions cannot rewrite that fold's forecast. Training
labels must exit strictly before the refit month. Actual monthly target features
come from that target month's own snapshot. All feature transforms, clipping,
weights, model/threshold choices and entry cutoffs use training-only data. No
revised-history fallback in vintage mode. Missing snapshots or inputs withhold a
prediction and stay visible in coverage. Compare policies on identical dates.

## Small prespecified candidate set

Common raw inputs: CFNAI-MA3 a; PCE YoY p; their exact three-month differences da,
dp. Current descriptive economic axes remain zero and 2%.

1. Fixed quadrant reference: a=0, p=2, with 24 pseudo-observations pooling each
   quadrant mean toward the training unconditional mean.
2. Calibrated quadrants: the same pooling and a small grid of activity anchors
   −0.20/0/+0.20 and inflation anchors 1.5/2/2.5%. These are investment-response
   candidates, not revised definitions of economic growth or the Fed target.
3. Continuous linear ridge: a,p,da,dp.
4. Continuous curved ridge: a,p,da,dp,a²,p²,a×p. There are seven features, no
   unrestricted tree or search across thousands of subgroups.

For each ridge family use penalty 10 or 100 and either equal historical weights
or a ten-year exponential half-life. Training-only 1st/99th percentile clipping
of the four raw inputs precedes feature expansion; expanded features are centred
and scaled on weighted training means/SD. Use weighted squared loss divided by
sum of weights plus lambda/n times squared coefficients; intercept unpenalised.
The score is the macro-conditioned predicted return minus that model's weighted
training unconditional mean. No asset's forecast is compared to another asset.

## Refitting, selection and entry rule

Refit annually using the January information set and only already matured labels;
reuse coefficients during the rest of that year. At least 60 training labels.
Outer evaluation begins 1990 for long history and 2016 for ETFs, or later where
required information is unavailable. Vintage models can start only after archives
exist; their training may include earlier history reconstructed by that refit date.

Choose hyperparameters within each fitted family and across fitted families using
up to five earlier January-origin validation folds, each covering 12 entry months.
All validation outcomes must have completed before the current refit month. Each
fold refits using its own historical vintage and purges crossing labels. Require
at least three usable folds / 24 paired validation predictions. Selection minimises
incremental mean squared error relative to that candidate's matching unconditional
forecast. This estimates conditional means without searching for a high-profit
threshold on sparse validation trades.

If every candidate fails to improve validation error, the overall selector uses
an unconditional model and emits no macro-conditioned entry. If validation is
insufficient, use a predeclared strong linear ridge (lambda=100, full history),
with explicit fallback labels. Family comparisons still show their best or
predeclared fallback candidate; never substitute an outer-window winner.

The entry screen is fixed: the score must be positive and exceed the 75th
percentile of that fitted model's score over its training-feature distribution.
Thus the screen asks whether current conditions rank favourably in the past
feature distribution. This percentile is not computed from future evaluation
scores. It is neither a calibrated probability nor a guaranteed 25% future
coverage. Keep all continuously scored forecasts for rank diagnostics.
Use a numerical score tolerance of 1e-12 at zero and at the entry cutoff so
matrix/vector arithmetic rounding cannot create a different entry decision.

## Outputs and evidence

For each asset/horizon/procedure report selected-start mean return minus the
same asset's mean on all eligible scored outer starts, plus median, P10, loss
frequency, episode counts, non-overlapping windows, selection coverage, rank IC
and incremental forecast MSE against the matching unconditional forecast.
No selected starts means no entry result, not zero profit.

Use 5,000 paired circular calendar-block resamples with block max(12,h) and seed
20261026+h, keeping gaps in the monthly clock. Recompute selected and unconditional
means within each draw. Intervals are retrospective and unadjusted. Holm-adjust
centred bootstrap p-values across all adequately repeated asset/horizon/procedure
comparisons within an information-set/panel; retain the 24-start/six-episode
interpretation threshold. These checks do not erase prior researcher selection,
backcast/proxy bias or provide prospective validation.

Show family choices, learned anchors, sample/fallback counts and dated decisions.
Keep the last fitted response shape inspectable, with model date and information
set; it is not a live forecast. Do not alter live preferences or apply learned
investment anchors to the economic-state chart from these research results.
Publish findings including failures, a reproducible script, aggregate JSON/CSV,
meaningful causality tests and independent prediction verification.

## Explicit exploratory amendment: objective-aligned selector

The first exploratory revised/vintage runs of the mean-error selector were
inspected before this amendment. Retain that selector and every family result;
do not replace them with a subsequently better-looking procedure. Add a separate
`timing_selected` procedure because the user's objective is entry lift, whereas
mean forecast error measures a different property. This is a disclosed additional
research hypothesis, not part of an untouched predeclared test.

Use the same 17 candidates and the same earlier validation folds. For each
candidate apply its training-only positive/top-quartile entry rule to validation
dates. Select maximum validation selected-minus-unconditional return, requiring
12 selected validation starts and three episodes; otherwise emit no macro entry.
Insufficient folds use the same predeclared linear fallback. No outer return
selects the candidate or changes its thresholds. Include this extra procedure in
the multiplicity family. It becomes the reported objective-aligned research
selector, while the original MSE selector remains directly inspectable.
