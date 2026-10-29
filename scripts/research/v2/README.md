# State, momentum and long history — research v2

This version compares the existing static state and momentum, without modifying
the frozen v1 experiments. Protocol SHA-256 is in every generated research output.
All historical v2 tests are retrospective walk-forward checks. The already-seen
2021–25 window is not an untouched holdout for this new design.

## Coverage actually verified on 21 October 2026

- US annual context: 1870–2020, native annual observations from JST release 6.
- Broad-US-equity monthly research proxy: July 1926–August 2026, Fama/French
  market excess plus RF. It is not SPY or an earlier ETF price history.
- Revised static-state history: May 1967–August 2026, 712 monthly positions.
- The 12-month broad-equity descriptive study has 700 overlapping starts from
  May 1967 through August 2025, not 700 independent observations.
- Original Chicago releases: 302 verified releases, March 2001–May 2026;
  ALFRED supplies the later releases and separate vintages for other inputs.
- First available same-month state at a decision: March 2001; original
  momentum's 75% coverage first passes in March 2011.
- Common primary 12M model evaluation: March 2017–September 2025, 103 monthly
  starts. A five-year warm-up and matured 12M labels shorten the test.
- Actual provider price history: SPY Dec 1999, IEF Aug 2002, GLD Dec 2004,
  TIP Jan 2004, DBC Mar 2006, through Sep 2026. SPY launched in 1993; earlier
  verified adjusted prices remain a source gap rather than fabricated history.

The dates above describe this frozen output. Builders calculate dates and counts
from sources; no 2000/2003 start, fixed sample size or silently extended holdout
is used. Full/last-20-year/custom display filters never change model fitting.
Each model's maximum-history diagnostic uses only its own required inputs;
the state+trend reference and unconditional baseline do not require momentum.

## Reproduce

Node >=22, Python >=3.11. Raw source files stay in ignored `work/research-v2/`.

1. `python -m pip install -r scripts/research/v2/requirements.txt`
2. Export full monthly **adjusted** CSVs for SPY/IEF/GLD/TIP/DBC from the
   connected Alpha Vantage source into `work/research-v2/prices/SYMBOL.csv`.
   Preserve `timestamp` and `adjusted close`; partial current months are excluded.
   A public-source price history is not automatically a redistribution licence.
3. Put the existing FRED key in the environment or ignored `.env.local`.
   `npm run research:v2:sources -- --as-of=2026-10-21` downloads full FRED
   history and ALFRED vintage chunks, Chicago release workbooks and the two
   separately labelled academic context sources. Requests paginate and reject
   truncated responses. No key is printed or written into a public artifact.
4. `npm run research:v2` builds original-release features, the three model
   comparisons and analogue reference, all horizons and strategy outcomes,
   descriptive long-history studies, and independent Node verification.
5. `npm test` and `npm run test:research:v2` run without network/private inputs.

Public files: `research-v2.json` (derived forecasts, outcomes and strategy rows),
`research-history.json` (derived historical evidence), `evidence-audit.json`
(sources, hashes and check counts), and `forecast-ledger.json`.

The 12M combined model's rank-correlation lift over the unconditional mean is
about 0.0175. Its 95% paired block interval includes zero, and Holm-adjusted
p=1.0 for all three primary comparisons. There is no confirmed predictive edge.
The monthly rotation policy is distinct from holding the selected asset for H
months. Volatility targeting is capped at full investment; low-volatility
baselines can remain below the 10% target because leverage is prohibited.

## Forward records

The ledger starts empty intentionally. A historical reconstruction cannot be
backfilled into it as a genuine recorded forecast. Use:

```
python scripts/research/v2/ledger.py work/research-v2/next-record.json
```

A record requires model, cutoff date, planned trade date and timezone-aware
`executionAt`, horizon, input/protocol/model-artifact hashes, and all five ranked symbols.
The clock must be after 23:59:59 UTC on the preceding cutoff day and before
execution. Duplicate identical decisions are idempotent; conflicting replacements
are rejected. An outcome uses `forecastId` and a complete `returns` map, and can
only be appended after its horizon has matured. The CLI uses the actual UTC clock.
Run the verifier again after recording a real forecast. Commit/publish the
derived files through the normal review flow; the daily macro archive does not
automatically retrain this study or refresh market prices.

For a genuine new monthly decision, after its cutoff has passed and before the
verified planned trading close, acquire with `--next-trade-date=YYYY-MM-DD`,
then rebuild. Record the generated estimate without manually copying rankings:

```
python scripts/research/v2/ledger.py --from-research data/research-v2.json \
  --trade-date YYYY-MM-DD --execution-at YYYY-MM-DDTHH:MM:SSZ \
  --model combined --horizon 12
```

Use the actual exchange trading date and close (including holidays and daylight
saving time). A future information cutoff or a past execution is rejected.

## Sources and reuse

- [FRED/ALFRED](https://fred.stlouisfed.org/docs/api/fred/series_observations.html)
- [Chicago Fed original-release workbooks](https://www.chicagofed.org/research/data/cfnai/cfnai-historical-data-preview)
- [Alpha Vantage monthly adjusted prices](https://www.alphavantage.co/documentation/#monthlyadj)
- [Fama/French data library](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html)
- [JST database, documentation and licence](https://www.macrohistory.net/database/)

JST-derived annual context is CC BY-NC-SA 4.0, attributed to Jordà, Schularick &
Taylor (2017) and Jordà, Knoll, Kuvshinov, Schularick & Taylor (2019). It is
noncommercial research context, separate from the monthly predictive models.
Do not integrate it into a commercial data service without appropriate rights.
Raw provider ETF price levels are excluded from public files and Git.
