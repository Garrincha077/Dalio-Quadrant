# Expanded periods: independent asset coverage and fixed model recipe

This extension answers the request for longer historical periods. It removes
common-asset truncation and arbitrary outer-start floors while preserving the
previous yield/trend fitting, selection, gates, costs and 3/12/36M horizons. It is
exploratory follow-up to inspected results, not a new untouched holdout. Earlier
reports and private inputs remain unchanged.

## Independent source histories

| Panel | Asset | Price inputs | Source / basis |
| --- | --- | --- | --- |
| Long | US equities | 1960-01–2026-08 | French Mkt−RF + RF, compounded total-return index |
| Long | Treasuries | 1960-01–2026-09 | Shiller reconstructed real bond index × CPI |
| Long | Gold | 1973-01–2026-09 | World Bank monthly-average USD spot via attributed mirror |
| Long | Commodities | 1960-01–2025-05 | AQR equal-weight futures excess return + French RF collateral |
| ETF | SPY | 1993-01–2026-09 | One consistent Yahoo daily-adjusted-close source, last actual traded close each month |
| ETF | IEF | 2002-08–2026-09 | Existing Alpha Vantage adjusted history |
| ETF | GLD | 2004-12–2026-09 | Existing Alpha Vantage adjusted history |
| ETF | TIP | 2004-01–2026-09 | Existing Alpha Vantage adjusted history |
| ETF | DBC | 2006-03–2026-09 | Existing Alpha Vantage adjusted history |

Raw sources and attribution remain in the earlier [extended methods](EXTENDED_STATE.md).
The source workbooks/factor files are reused without alteration. Prices before
1960 are unnecessary for the retained macro method, whose first usable state is
May 1967; 1960 supplies sufficient trailing-price warmup. Gold is deliberately
trimmed to 1973 so peg-era levels do not train a supposed free-floating price model.

The SPY daily query is the public Yahoo chart endpoint with period1=725846400,
period2=1790812800, interval=1d, events=div,splits. Raw payload SHA-256 is
b9f57deb2c247c945f3558ba5f2a176fe5a45c23d854de70d48513a8d119bb7c.
There are 8,475 daily observations, first 1993-01-29, last 2026-09-30. Daily
timestamps are converted to New York dates before selecting the actual last
observed trade each month. No monthly first-day timestamp is treated as a close.
No Alpha Vantage/Yahoo price splice is made.

Over 321 overlapping monthly SPY returns, January 2000–September 2026, the median
absolute provider difference is 0.0050105 bp and maximum 5.261281 bp. The series are
close but not identical; provider/retrieval effects are disclosed in comparison
interpretation. Other ETF source files remain the same.

The private preparation writes separate two-column date/price CSVs and manifests
under work/research/periods/. Each series must be positive, finite, ordered and
complete between its own first/last month. Nulls outside individual coverage are
permitted in the joined research frame; interior gaps are errors. Manifest/file
hashes and declared bounds are checked on load. October 2026 is excluded.

Each source keeps its own end: AQR's May-2025 cutoff does not erase later stock,
bond or gold data. No synthetic commodity extension is added. Long bond/gold
prices remain reconstruction/averages, not executable closing prices. Gold's
1973 research start is not a claim of unrestricted US physical-gold tradability.

## Model chronology and separate information sets

The frozen [yield/trend method](RATES_ENTRY.md) supplies fit, predict, selection,
rank, paired-gain and uncertainty helpers. Inputs remain macro state/direction,
36-month log-price z-score, prior-month GS10/FII10 yields and prior 12-month return.
Nominal-only and nominal-plus-real cohorts remain separate. There is no fabricated
pre-2003 actual real yield, macro state before May 1967 or macro vintage before
May 2011. Revised histories are retrospective.

The annual loop no longer waits arbitrarily until 1990/2016. The original >=60
matured-label rule, feature warmup and exact archive availability determine first
scoring. Exits must be strictly before each fit; earlier validation must also
have matured before later selection. Sparse earlier validation retains the same
declared same-stage strong-ridge fallback. Nothing is fitted to the outer results.

At 12M, long nominal revised scoring begins 1974 for equities/bonds/commodities,
1982 for gold. Earlier 3M scoring can begin 1973; 36M can begin 1976 (gold 1984).
Long actual-vintage scoring still cannot begin before January 2012. ETF nominal
revised scoring begins 2002 for SPY, 2012 IEF, 2014 GLD, 2013 TIP, 2016 DBC.
SPY's real-yield revised cohort starts 2010; the other ETF starts are unchanged.
Actual-vintage SPY/IEF start 2012, GLD 2014, TIP 2013, DBC 2016 at 12M.

All stages use the same training, validation and scored rows WITHIN each asset,
cohort, information set and horizon. Cross-asset historical averages can span
different eras. The displayed rank comparison still uses the latest common
complete entry date, so those dated ranks share a calendar date.

Existing macro/yield source snapshots are reused. For an ETF vintage target,
its actual monthly trade date must equal the archived schedule date; disagreement
is an error. Long monthly proxies retain their non-executable limitation even
with actual macro cutoffs. Training uses then-published historical reconstructions,
not claims of contemporaneous original availability for every backcast.

## Old/new comparison and era checks

Every target reports the original and expanded scored counts, input bounds,
added earlier/later dates and the exact-calendar intersection of old/new results.
Both procedures are recomputed from their own dated models on those shared dates.
Longer training, changed candidate choices and SPY provider history can affect
results; the comparison does not isolate a calendar-only treatment.

Fixed descriptive eras are 1970–1989, 1990–2007, 2008–2019 and 2020–2026. Each
era gets its own same-asset scored-return baseline, counts/episodes and stage
lifts. No era chooses a model or gate; no new era-specific significance is claimed.
Earlier-added/later-added subsets are also point summaries, not new strategies.

Full expanded results retain 5,000 calendar-block resamples, length max(12,h),
the original seed, paired selection masks, 24-start/six-episode gates and Holm
pooling of supported absolute/incremental tests across both cohorts within a
panel/information set. Intervals are unadjusted. Empty selections mean unavailable
conditional results, not zero investment return. Prior research, revised sources,
overlap, regime change and proxy construction remain limitations. No portfolio
CAGR, waiting-cash performance or prospective alpha is established.

## Reproduction and verification

Retain the attributed Yahoo payload at work/research/extended/spy-yahoo-daily.json;
prepare other inputs and archives as in the linked earlier methods. Then:

```sh
work/research/.venv/bin/python scripts/research/prepare_period_histories.py
OPENBLAS_NUM_THREADS=1 work/research/.venv/bin/python scripts/research/expanded_periods.py
work/research/.venv/bin/python scripts/research/test_expanded_periods.py
node scripts/research/verify-expanded-periods.mjs
npm test
```

Outputs data/expanded-periods.json and .csv retain eight experiments, 21,376 dated
input rows across those experiments, 64,128 stage decisions/ranks, parameter and
earlier-validation traces, source hashes, coverage, original-date comparisons and
era summaries. These counts include overlapping experiments, not independent
economic cycles. Private prices are not published.

Independent Node reconstruction passes for 3,890 parameter sets, 21,376 feature
rows and 5,970 chronological stage choices. It verifies independent price files,
per-asset availability, exact ETF cutoff dates, macro/price/yield/trend features,
training transforms, coefficients via a separate solver, gates/rank quantiles,
selected means and paired gains. Choice checks use published validation traces.
Node artifact tests separately reconcile all comparison/era summaries, historical
ranks and CSV entries. Ten new Python tests check ragged coverage, boundary/gap/
hash/date guards, monthly trade aggregation and unavailable outcomes.

121 Node and 83 Python tests pass. Chromium covers all 648 expanded/original
control combinations, deferred/cached loading, history switching, per-asset
coverage, fixed-era/shared-date tables, downloads and both failure paths. No page
errors or page overflow at 320/360/390/1440 pixels. The app defaults to expanded
histories and retains the original report through its history selector.

[Findings](EXPANDED_PERIODS_FINDINGS.md) · [Protocol](expanded-periods-protocol.md)
· [Data upgrade priorities](DATA_UPGRADE_PLAN.md).
