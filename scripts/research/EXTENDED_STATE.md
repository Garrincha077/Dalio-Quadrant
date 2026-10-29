# Extended state and trend research

Research snapshot: 26 October 2026. This adds two separate **retrospective** panels
and a full revised-state coverage summary. It does not retrain the current asset
preference card or change the frozen momentum backtest.

- `data/extended-long-state.json`: public-source, four-asset proxy research. Inputs
  January 1973–May 2025; trading simulation January 1980–May 2025 after initial
  learning. Reconstruction and monthly averages limit tradability claims.
- `data/extended-state.json`: five actual ETF adjusted-close histories, common
  March 2006–September 2026; simulation January 2013–September 2026.
- Both include the 712 revised same-month economic states, May 1967–August 2026,
  from the already published and frozen `data/state-forward.json`.

## What the experiment tests

The primary comparison holds the universe, matured training labels, execution,
missing-signal dates and sleeve policy constant. Only conditioning on economic
state/trend changes. Coefficients are not fitted; the existing 24-observation
pooling, anchor buffers and trend bands are retained. Training is expanding and
uses at least 60 completed 12-month labels; a label exiting at today's close is
still excluded before today's decision. Two-reference-month delayed **revised**
states are used in these published panels, not historical publication vintages.

Each month renews one of 12 sleeves; each sleeve holds its selected asset for 12
months. The initial portfolio is cash and introduces one sleeve per month.
Nonpositive estimates or missing signals send only the new sleeve to cash.
Renewing a sleeve in the same asset creates no turnover. Fees apply to net risky
buys/sells and are funded from the traded sleeve, including both sides of a switch.
Open sleeves are marked at the final observation, without a fictional liquidation.

Fixed-allocation equity, 60/40 and equal-weight controls are rebalanced monthly
and ramp their risky target from 1/12 to 12/12 over the same first 12 decisions.
They are labelled **ramped**, not buy-and-hold. Cash has no trading fee. A separate
state-only policy tests the incremental effect of trend. No leverage or taxes.

The primary statistical comparison is the paired annualised **arithmetic mean**
return difference versus unconditional asset selection, not the CAGR difference.
Intervals use 5,000 circular moving-block samples, 12-month blocks, seed 20261026;
24-month blocks are a sensitivity. Historical, dependent samples and researcher
selection limit inference. Neither panel is an untouched or prospective holdout.

## Sources and important differences

| Input | Actual source and treatment |
| --- | --- |
| Economic states | Existing frozen revised CFNAI-MA3 and PCE YoY pairs. CFNAI first appeared publicly in March 2001; reconstructed earlier states are not contemporary signals. |
| Long equities | [Kenneth French data library](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html), monthly `Mkt-RF + RF`, a broad US market, not precisely SPY. |
| Long bonds | [Robert Shiller workbook](https://shillerdata.com/), **Real Total Bond Returns** cumulative index multiplied by CPI to obtain a nominal index. This is a publisher reconstruction, not an observed IEF-equivalent index. Never use the workbook's future 10-year return columns. |
| Long gold | [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets), attributed [datasets/gold-prices mirror](https://github.com/datasets/gold-prices), monthly average USD spot. Not month-end executable quotes or a fund. Only post-1973 true monthly observations are used. |
| Long commodities | [AQR Commodities for the Long Run](https://www.aqr.com/Insights/Datasets/Commodities-for-the-Long-Run-Index-Level-Data-Monthly), monthly equal-weight futures excess returns plus French RF collateral return, added arithmetically. Despite the workbook title, the selected column contains monthly returns, not price levels. This research basket differs from GSCI/DBC and ends May 2025. |
| Long cash | French realised monthly T-bill returns, compounded into a return index. |
| ETF prices | Alpha Vantage `TIME_SERIES_MONTHLY_ADJUSTED`, SPY/IEF/GLD/TIP/DBC. Partial October 2026 rows are excluded. No dividends added a second time. |
| ETF cash | [FRED TB3MS](https://fred.stlouisfed.org/series/TB3MS), two-reference-month delayed revised yield accrued over actual close-to-close days, actual/365.25. An approximate carry proxy; not a vintage-validated cash index. |

The long panel is named `long-public-proxy-1`. It is a new exploratory panel,
not a substitute for a verified month-end total-return-index study. No index or
ETF splice pretends to extend the AQR sample to 2026. US TIPS are excluded from
the four-class panel; first issuance was 1997. The fixed 2% inflation anchor before
2012 is an analytical reference, not the then-official Federal Reserve target.
Monthly drawdowns can understate losses inside a month. More monthly rows do not
create independent economic cycles.

Raw inputs live under ignored `work/research/`. The JSON reports publish hashes,
metadata, derived portfolio returns, source outcome differences and decisions;
no provider price histories are committed. Credentials are not needed to browse
the frozen results. The existing `FRED_API_KEY` remains server-only.

## Reproduction

Node >=22, Python >=3.11. Install exact dependencies:

```sh
python -m venv work/research/.venv
work/research/.venv/bin/pip install -r scripts/research/requirements-extended.txt
```

Private input directory: `work/research/extended/`:

1. `aqr-commodities.xlsx`: publisher's **Commodities for the Long Run: Index Level
   Data, Monthly** workbook, downloadable from the source above.
2. `shiller.xls`: `ie_data.xls` linked on shillerdata.com. The former Yale download
   has moved; resolve the current publisher link rather than using an old mirror.
3. `french-factors.zip`: publisher's `F-F_Research_Data_Factors_CSV.zip`.
4. `worldbank-gold.csv`: `data/monthly.csv` from the attributed gold mirror. For the
   recorded research its Git blob SHA is `0a154d8f61df2d10a590b0cb03b3001dae6839a7`.
5. `TB3MS.csv`: FRED graph CSV with headers `observation_date,TB3MS`, starting 1960.
6. Five provider monthly adjusted CSVs under `work/research/prices/SYMBOL.csv`.

Reports record SHA-256 hashes of the actual input bytes. Later downloads may
contain revisions; a different hash is a new research snapshot, not a byte-exact
reproduction. Retain privately archived originals to reproduce the frozen result.

```sh
work/research/.venv/bin/python scripts/research/prepare_extended_long.py
work/research/.venv/bin/python scripts/research/extended_state.py --panel long \
  --manifest work/research/extended/long-manifest.json --output data/extended-long-state.json
work/research/.venv/bin/python scripts/research/prepare_extended_etf.py
work/research/.venv/bin/python scripts/research/extended_state.py \
  --manifest work/research/extended/etf-manifest.json
node scripts/research/verify-extended-state.mjs \
  data/extended-long-state.json work/research/extended/long-manifest.json
node scripts/research/verify-extended-state.mjs \
  data/extended-state.json work/research/extended/etf-manifest.json
```

For gold carrying-cost sensitivity, rerun the long command with
`--gold-cost-bps 25` or `--gold-cost-bps 50`, and put outputs in ignored `work/`.
The published base panel assumes zero carrying costs and separately shows
0/10/25/50 bp transaction-cost cases. Neither cost model establishes actual
historical execution.

## Input contract for verified indices and publication vintages

A manifest points to a common monthly price/return-index CSV:

```text
date,EQUITY,TREASURY,GOLD,COMMODITIES,CASH
1973-01-31,...positive normalised levels...
```

Declare four or five risky assets in `assets`, equity then Treasury first for
fixed allocation controls, plus `cash`. Each source needs `instrument`, `source`,
`currency: USD`, `assetClass`, and `returnType`. Allowed risky return types are
`total-return`, `adjusted-close`, or explicitly labelled `spot-gold` for gold.
Treasury yield levels and spot commodity baskets are rejected. Dates, currencies,
missing months, duplicate months and partial as-of months are checked. Five-class
TIPS history before 1997 is rejected. Do not backfill nonexistent instruments.

Vintage mode additionally requires `executionBasis: exchange-close` and an
explicit snapshot directory. For each actual trade close date D, supply
`YYYY-MM-DD.json` for cutoff D−1 calendar day:

```json
{
  "cutoff": "2020-06-29",
  "series": {
    "CFNAIMA3": {"observations": [{"date": "2020-05-01", "value": "..."}]},
    "PCEPI": {"observations": [{"date": "2019-05-01", "value": "..."}]}
  }
}
```

Include full required histories, not only the illustrative single rows. Each
snapshot must be an actual archived information set with matching provenance.
The builder requires latest same-reference-month axes, completed periods, freshness
within 90 days, exact PCE year-earlier bases and four consecutive trend pairs.
It refuses pre-March-2001 CFNAI decisions and never falls back to revised data.
Missing vintages remain missing; enough mature eligible labels are needed before
evaluation begins. Historical macro archives and verified price sources have not
yet been supplied here, so **no vintage result is published**. The long proxy
manifest is deliberately rejected for vintage trading.

```sh
work/research/.venv/bin/python scripts/research/extended_state.py --mode vintage \
  --manifest work/research/verified/manifest.json \
  --vintages work/research/state-vintages --output work/research/vintage-result.json
```

## Verification

`test_extended_state.py` checks label maturity, future-data invariance, missing
periods, source types, same-month alignment, pre-launch restrictions, source gaps,
self-financing costs and sleeve behaviour. The independent Node verifier rebuilds
all three conditional-selection policies without importing the Python algorithm,
including ranking and execution costs, from private normalised input data.
Published JSON integrity is also covered by Node tests. CI needs no provider keys
or private price data to run the synthetic and published-artifact checks.

## Reading the results

A positive historical CAGR is insufficient evidence of added value. Compare the
state policy with the matched unconditional policy, fixed-allocation controls,
cost stresses, decades and crises. A paired interval spanning zero leaves the
advantage unconfirmed. The long panel's different instruments and revised inputs
also prevent a causal or point-in-time interpretation of any apparent advantage.
