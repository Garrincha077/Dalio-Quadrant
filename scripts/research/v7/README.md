# Forward risk forecasts: a useful near-term result, separate from return alpha

The user authorized continued research. After the 51 recovery strategies failed
their joint economic gates, this round tests whether VIX/HY predict **future
risk** beyond past price volatility. The [protocol](protocol.md) was committed
before its outcomes. This is a retrospective reconstruction on already seen
regimes; it does not prove higher expected returns or correct bottom timing.

## Models, target and causal fitting

Targets are 52 times the mean squared SPY weekly returns over the next 4/13/52
actual execution intervals. This is annualized realized risk, including return
drift, rather than a directional return target. Forecast inputs, training labels
and known cash align to the verified v6 information cutoffs and execution dates.

Six main models: earlier mean risk, past52, past13, fitted past-risk regression,
VIX-only regression, and past risk + VIX + HY. The separate price cohort adds
price z, and the separate full-context cohort adds price/value z and the four
original macro state/momentum inputs. All 63 model/horizon/cohort procedures
remain visible, with their actual matched histories.

At each cutoff, fit only on the last 520 source-eligible targets whose actual end
was already on/before the cutoff, requiring at least 104. Same-execution maturity
is too late for its preceding-day cutoff. Use fixed ridge10, training-only means
and sample SDs, standardized clipping at ±5, and training-only retransformation
calibration. Bound every variance forecast to [0.0001,1], disclosing bound hits.
No hyperparameter search, full-history normalization or winner substitution.

Compare QLIKE loss, volatility MAE and calibration. Portfolio policies cap
forecast risk at 10% without leverage, rebalance weekly and pay actual drifted
10/25bp costs, known cash and final liquidation. A better risk loss is a separate
finding from portfolio return or drawdown improvement.

## Results through 21 October 2026

Main four-week cohort: 1,090 mature overlapping starts, input weeks from October
2005; continuous policies end 20 October 2026.

| Model | QLIKE ↓ | Annual-risk MAE | Policy net CAGR | Daily max drawdown |
|---|---:|---:|---:|---:|
| Past52 | 0.6999 | 7.16pp | 7.38% | −30.01% |
| Past13 | 0.7744 | 6.60pp | 7.58% | −31.83% |
| Fitted past-risk regression | 0.6230 | 6.12pp | 7.26% | −36.12% |
| VIX-only | **0.4909** | **5.05pp** | 7.54% | −33.10% |
| Past risk + VIX + HY | 0.5024 | 5.06pp | 7.27% | −35.79% |

VIX-only reduced loss **21.21%** versus the fitted past-risk model. Paired mean
loss reduction 0.1321, 95% block interval [0.0716,0.2011], Holm-adjusted p=0.0040.
Its gain was positive in every fixed calendar fold. The combined stress model
also beat all three past-risk references under the predeclared near-term risk
criteria. It did not establish extra value over VIX alone: difference versus VIX
was −0.0115, interval [−0.0576,0.0282], adjusted p=1.

The annual target did not meet the stronger support criteria. Price/value/macro
additions on shorter matched samples did not establish an incremental advantage.
The many related targets and earlier attempts remain disclosed. `confirmedEdge`
remains false; the narrower finding is stronger retrospective evidence for
near-term risk prediction, especially the VIX component, rather than return alpha.
Portfolio differences do not establish a new economic winner.

Ten primary tests at 4/52 weeks use 2,500 paired circular 52-week blocks, retaining
missing calendar positions. The ten-test Holm correction is separate from prior
rounds. Thirteen-week and added-feature results are exploratory.

## First actual prospective pilot

The [forward pilot protocol](forward-protocol.md) was declared after these
historical results. On 22 October 2026, before its planned 27 October start, all
six main models at both4 and52 weeks were frozen: **12 future forecasts**,
including weaker references. Planned ends are 24 November 2026 and 26 October
2027, subject to the actual subsequently observed execution calendar.

`data/risk-forward-ledger.json` preserves issuance, dates, all input/model
transforms/slopes/calibration and source hashes. It intentionally reuses week
16 October inputs for a target one execution later than the historical schedule;
this extra lag is explicit. It does not relabel the past20 October forecast as
prospectively issued. Outcomes are null. Later outcome records must be separate;
issued records cannot be changed.

The exact public source artifact was committed with the issued record before
lossless row packing. `sourceReceipts` links that immutable Git snapshot and its
SHA-256. Independent verification checks the actual archived bytes, the original
record, all12 forecasts and transforms. Current publication uses a smaller
lossless column schema; it does not change any issued model or forecast.

## Reproduction and independent checks

Reproduce v6 first, then (full Git history is needed for the issuance receipt):

```sh
npm run research:v7
npm run research:v7:verify
npm run test:research:v7
npm test
```

`experiment.py` stores every training cohort, transform, fit and forecast privately;
`verify.mjs` independently reconstructs features and target maturities, refits
31,310 regressions across8,155 exact training cohorts, checks55,775 predictions,
56,766 portfolio intervals,291 forecast summaries and10 block comparisons before
atomic publication. `forward.py` retains existing issued records;
`verify-forward.mjs` checks the issuance snapshot and immutable records. Raw
provider prices, yields and credentials stay private. Public portfolio rows use
the explicit `policyColumns` schema. Duplicate risk-policy costs reconstruct exactly
as turnover×0.001; event flags are false and core states come from the linked
verified recovery calendar. The verifier checks the complete lossless roundtrip.

The Recovery & risk tab includes horizon/cohort/model/date controls, every policy,
calibration, prospective dates, fixed periods, all recovery failures and receipts.
Desktop,390px mobile, source failure/retry and offline loading are verified.
The large research files load on demand, then cache after successful visits.
