# Forecast-risk guard: a practical test that did not pass

After near-term risk forecasts improved but the first sized portfolios did not
establish economic value, the user requested continued research. The
[protocol](protocol.md) was committed before these additional outcomes. No model
is refitted: every guard reuses the exact verified MAIN four-week forecasts.

For all six models, use the lower SPY exposure allowed by forecast risk and the
existing52-week realized-risk cap, without leverage. Preserve all holding dates,
known cash, source-gap cash,10/25bp self-financing costs and final liquidation.
Compare against original past52/fitted-market policies and guarded fitted market.

A per-reference pass requires either higher CAGR at comparable risk and no worse
drawdown, or at most0.5pp less CAGR with20% less drawdown, higher Sharpe and
comparable risk. Every reference must pass at least one declared alternative.
No guarded policy met all gates. Main2005–2026 matched results:

| Policy | Net CAGR | Weekly risk | Daily-close max drawdown |
|---|---:|---:|---:|
| Original past52 cap | 7.38% | 10.24% | −30.01% |
| Original fitted past-risk | 7.26% | 10.36% | −36.12% |
| Guarded fitted past-risk | 6.91% | 9.58% | −30.01% |
| Guarded VIX-only | 6.63% | 9.03% | −29.12% |
| Guarded combined stress | 6.35% | 9.05% | −29.80% |

The guard reduced exposure and return without enough drawdown reduction. These
findings do not negate the earlier risk-loss improvement and do not turn it into
return alpha. Six primary paired excess-Sharpe tests use52-week blocks,2,500
replications and local Holm correction; no stronger economic support is claimed.

```sh
npm run research:v8
npm run research:v8:verify
npm run test:research:v8
```

Requires the exact v5 sources, v6 calendar and v7 forecasts/shards. Independent
JavaScript reconstructs8,760 policy intervals,6,570 guard bounds,54 summaries and
six paired block tests, including replication of the original past52 path, before
atomic publication to `data/risk-guard.json`. Existing issued forecasts and earlier
artifacts remain unchanged. All six guarded paths and per-reference gates are
available in the Recovery & risk tab's additional-research section.
