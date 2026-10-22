# Recovery confirmation and continuous portfolios

The user authorized continued research toward predictive/economic value. This
round tests investable recovery rules after the original L2+ signal rather than
annualizing selected event returns. The main [protocol](protocol.md) was committed
before these outcomes. The [memory extension](memory-protocol.md) was committed
after the first 41 paths failed, before its ten additional outcomes. All history
was already inspected in earlier rounds; no untouched holdout is claimed.

## What was tested

Seven entry rules: immediate L2+, improving VIX/HY over four weeks, those changes
plus a 10-week price trend, price trend alone, recovery plus price z<=0, recovery
plus benign macro momentum, recovery plus value z>=0. Their opposite z-score
signs reflect different meanings: high value z is relatively cheap; high price
z is a high log price versus history. Missing filters do not pass.

An episode arms a 26-week waiting window; merged setups cannot extend it. Each
rule has event/cash and 40-week-core overlay policies, with 52 weekly holding
intervals after entry and no timer reset while already holding. Source-defined
main/price/context cohorts start in 2003/2005/2011. All 41 paths remain visible.

Ten later paths use rolling stress memory: any complete L2+ reading in the
current/prior 26 weeks permits early recovery participation. Recheck the condition
weekly and return to the core if it fails. Compare risk from 52 weeks against
max(13,52)-week risk, with matched passive, trend40 and ungated fast10-or40
references. All ten remain visible, including failures.

## Execution and accounting

Reuse the exact source-verified v5 archive and daily price files. Decisions use
completed Friday-labelled weeks and execution at the second subsequent SPY
session. Known cash uses earlier original TB3MS yields with at most 62 days of
context age. Its effective-yield carry is an approximation and is disclosed.

Hold SPY/cash without leverage, target 10% prior risk, and solve actual post-fee
weights with drifted holdings. Buy notional=(target-before)/(1+fee*target), sell
notional=(before-target)/(1-fee*target). Charge 10bp per risky leg, independently
25bp stress and final liquidation. Daily cash carry and adjusted-close SPY marks
produce the actual portfolio drawdown; it excludes intraday losses. Net wealth
charts show weekly endpoints while drawdown statistics use daily marks.

The last complete portfolio interval ends 20 October 2026. A 52-week event hold
is separate from the preserved v5 252-trading-session event study. A source gap
never silently removes a holding interval. All fixed folds and omitted-block
sensitivity results are retained; omitted blocks concatenate retained returns
and are not continuously tradable policies.

## Result

No strategy met all predeclared return or defensive gates against every required
matched reference. Main cohort, 2003–2026, annual net returns:

| Policy | Net CAGR | Weekly risk | Daily max drawdown |
|---|---:|---:|---:|
| Risk-capped passive SPY | 7.52% | 10.10% | −30.01% |
| 40-week trend | 5.80% | 7.85% | −15.46% |
| Core + immediate L2 hold | 6.83% | 8.82% | −24.33% |
| Core + VIX/HY recovery | 6.03% | 8.62% | −26.76% |
| Rolling memory + recovery, slow risk | 6.32% | 8.00% | −15.07% |
| Matched ungated fast price trend | 6.62% | 8.12% | −15.07% |

Price z reduced some drawdowns while sacrificing return. State/value/momentum
filters on their shorter matched sample did not establish incremental value.
Six initial and eight extension paired Sharpe comparisons use 52-week blocks,
2,500 replications and separate Holm corrections. These corrections do not erase
the earlier experiments. Every `confirmedEdge` remains false.

## Reproduction and audit

Reproduce v2/v3 features and verified v5 sources first, then:

```sh
npm run research:v6
npm run research:v6:verify
npm run test:research:v6
```

`experiment.py` builds the original candidate; `memory.py` adds the separate
extension without changing original paths. `verify.mjs` independently rebuilds
raw-source indicators, timing, complete known contexts, setup state machines,
all self-financing trades, daily drawdowns, folds, omitted blocks and bootstrap
results before atomic publication to `data/recovery-research.json`.

Audit: 1,204 calendar rows, 198 setup records, 51 procedures, 53,779 policy
intervals, 425 summaries, 1,204 memory states and 14 paired block calculations.
The public file losslessly packs portfolio rows into arrays with an explicit
`policyColumns` schema; `lib/research-paths.mjs` decodes them. Raw prices and
private yields remain outside browser assets. The app loads these larger
research files only when the new tab opens, then caches successful reads offline.
