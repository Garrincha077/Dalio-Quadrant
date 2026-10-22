# One-year excess-return forecasts from continuous stress inputs

The user requested continued research. After earlier entry confirmations and
forecast guards failed the joint economic gates, this round tests continuous
RSI/VIX/HY as annual return predictors. The [protocol](protocol.md) was committed
before its outcomes. No previously inspected history becomes an untouched test.

## Models and causal labels

Target: actual SPY adjusted-close total return minus compounded cash carry across
52 actual weekly execution intervals. Training uses only targets whose final
execution was already on/before the current preceding-day cutoff. Require156,
retain up to520 source-eligible mature starts; fixed ridge100, unpenalized target
mean, training-only sample scaling and standardized clipping at±5. Bound forecasts
to±50% annual excess return and disclose bound hits; bounds are not confidence
intervals.

MAIN models: earlier mean, past-price model, and past price plus continuous weekly
RSI/VIX/HY. Market inputs are13/52-week index log returns and log13/52-week SPY
variances. PRICE adds completed-month price z; CONTEXT adds value z and the four
original macro state/momentum inputs. All models in each cohort share exact
current/training availability and targets. Twelve return procedures are retained.

Every model has sign and utility allocations. Sign holds the known past52-risk
cap when expected excess return is positive. Utility uses the smaller of that cap
and max(0,expected annual excess/(3×known near-term VIX variance)). These horizons
differ and the allocation is a declared heuristic. No leverage or new risk fit.
Missing forecasts retain the holding interval in cash. Matched passive and
risk-only references stay on the same continuous calendar. Thirty policy paths
include actual drifted10/25bp trades, cash and final liquidation; drawdowns use
daily portfolio closes rather than only weekly endpoints.

## Results

| Matched cohort | First forecast week | Mature overlapping annual targets |
|---|---|---:|
| MAIN | 21 September 2007 | 942 |
| PRICE | 23 January 2009 | 872 |
| CONTEXT | 1 January 2016 | 512 |

The longer MAIN experiment did not improve annual forecasts. MSE is0.03109 for
the earlier mean,0.05441 for the past-price model and0.06125 with continuous
stress. Stress-model out-of-sample R² versus mean is approximately−0.970. Sign
policy net CAGR is5.31% versus5.94% for the matched mean policy and6.81% for the
continuous risk-capped passive reference. No full economic candidate is found.

Some shorter-context comparisons improve, but remain exploratory:

| CONTEXT2016–2026 policy | Net CAGR | Weekly risk | Daily max drawdown |
|---|---:|---:|---:|
| Matched past52 passive | 9.16% | 10.06% | −24.20% |
| Mean sign policy | 9.36% | 10.03% | −24.20% |
| Stress + price z sign | 9.82% | 9.77% | −24.20% |
| Combined-stress utility | 9.42% | 8.87% | −19.01% |
| Matched VIX risk-only | 8.68% | 8.34% | −15.68% |

The price model beats three references on the declared return gates but fails
the complete comparison against the stronger defensive risk-only reference.
The stress utility variant improves some risk/return comparisons, but not every
reference. A higher return on a shorter source sample is not evidence that the
longer-history problem was solved. Availability-related cash gaps affect all
matched model policies and remain explicit; passive has no stress-input gap gate.

Two primary paired MSE comparisons and eight primary paired policy-Sharpe tests
use52-week blocks,2,500 draws and separate Holm corrections. Shorter cohorts are
exploratory. Every confirmed-edge flag remains false. Direction accuracy is
historical classification rather than a calibrated probability of gain.

## Reproduce and inspect

Reproduce the exact v5/v6/v7 sources first, then:

```sh
npm run research:v9
npm run research:v9:verify
npm run test:research:v9
```

Independent JavaScript reconstructs the raw features and annual labels, verifies
2,469 exact mature training cohorts, refits6,964 regressions, checks9,433 forecasts,
23,966 portfolio intervals,55 forecast summaries and10 paired calculations before
atomic publication to `data/return-research.json`. All30 policy paths and all
forecasts remain inspectable. Raw provider prices and credentials stay private.

The Recovery & risk tab loads these additional tests when their details section
opens. It exposes cohort/allocation/model/date controls, every source-matched
comparison, actual known cutoffs, predicted/realized excess returns, independent
near-term risk, fixed folds and complete downloadable evidence. Desktop/mobile,
source failure/retry and offline use after a successful visit are verified.
Earlier risk findings and the12 genuine future forecasts remain unchanged.

## Genuinely prospective annual pilot

The separate [forward protocol](forward-protocol.md) was committed before the
future target starts. All12 annual estimates, including the earlier mean and
weaker models, were issued22 October2026 at15:42:38 UTC. Planned target dates are
27 October2026–26 October2027. These12 predictions share **one annual outcome**;
they are not12 independent forward trials. Inputs remain the completed16 October
week with19 October cutoff, one weekly execution older than the retrospective
20 October schedule. This timing mismatch stays visible in the app and ledger.

`data/return-forward-ledger.json` freezes current feature values, training-only
transforms, regression slopes/intercepts, training counts and all12 estimates.
All outcomes remain null. The exact research source and original issued record
are preserved in commit `e4aa204b91c91cfd46268326740e358ef9542890`.
`verify-forward.mjs` checks those actual Git blobs, the protocol hash, issue timing
and every estimate recomputed from its frozen model. Later outcomes must be
appended separately; the issued record cannot be rewritten. The standard round9
pipeline now retains and verifies this record after the retrospective audit.
These expected excess returns are estimates rather than probabilities of profit.
