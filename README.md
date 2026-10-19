# Dalio Quadrant — Principles & Evidence

Independent US macro monitor inspired by the public All Weather framework. Uses
FRED for the live macro dashboard; no Finviz Elite, public CORS proxy, AI provider
or browser API key. The separate dated research experiment uses adjusted ETF
histories from Alpha Vantage and Yahoo Finance in addition to ALFRED vintages.
The formulas are transparent application heuristics, not Bridgewater's model.

## Run and deploy

Node 22 or newer, no package dependencies:

1. Copy `.env.example` to `.env.local` and set `FRED_API_KEY` locally.
2. `npm run dev`, then open `http://127.0.0.1:4173`.
3. `npm test` runs financial transformation and API boundary regression checks.
4. On the existing Vercel project, set `FRED_API_KEY` for the intended environment.
   The variable is server-only. A new deployment is needed to receive changes.
5. `npm run snapshot` with the environment loaded writes an inspectable local
   `work/snapshot.json`; neither this file nor `.env.local` belongs in Git.

## Data and calculation

`api/dashboard.js` requests 34 distinct FRED series in five bounded workers,
plus GDPNow's series metadata to verify the forecast's actual update timestamp:
up to 25 years for macro, debt and recession context, and 30 months for static-state,
nowcast and daily market/stress series. Daily RRP inputs receive a 10,000-observation limit so the
long liquidity history is not silently truncated. The response includes
normalized data, quality flags, statistical profiles and the computed regime.
Responses without source errors are edge cached for one hour. Partial failures
are not cached. The browser refreshes on opening and every six hours while
visible; it also refreshes when returning to an old session.

- Real GDP uses `GDPC1` levels and the matching quarter a year earlier.
- Monthly series require matching year-earlier months. Weekly `TOTLL` uses 52
  weeks with a bounded as-of match. Missing YoY comparisons stay missing.
- Net liquidity: `(WALCL - WTREGEN) / 1000 - RRPONTSYD`, USD billions. No future
  observation is selected to align dates. This combines a TGA weekly average
  with point observations and is explicitly labelled an approximate proxy.
- Growth and inflation scores measure changes in YoY rates over three months,
  normalized by documented scales and weights. Policy, credit and liquidity are
  context outside the score. Scales and weights are uncalibrated heuristics.
- Monthly/quarterly freshness age starts at period end, not the first day used
  as FRED's period label. Other series use the observation date.
- At least 75% of each axis's configured weight must be fresh and have comparison
  history. A score within 0.15 of zero gives a transition state. No default data
  or probability claims.
- Directional arrow labels describe momentum, not economic levels, inflation
  below zero or a recession. The original level-claiming names were removed.
- Market context: `DGS10`, `DFII10`, `T10YIE`, `DTWEXBGS`, `DCOILWTICO`, `VIXCLS`.
  Changes are rates in basis points, price/index percent changes or VIX points,
  with actual dated observations. These are not sector/futures/total returns.

## Observed state, nowcast and investment lenses

The default **Economy now** tab adds a separate static state layer
(`economic-state-1`); **Momentum & data** retains the original momentum chart.
State X is published CFNAI-MA3 activity relative to historical growth trend, with
zero as its anchor. State Y is headline PCE YoY minus the Fed's 2% longer-run
inflation anchor. This is neither an output gap nor economic surprises versus
consensus. Core PCE remains a separately labelled cross-check.

Both state axes require completed monthly periods, freshness within 90 days of
period end, and reference months no more than one month apart. No missing values
or year-earlier bases are filled. Descriptive buffers ±0.10 activity units and
±0.20 inflation pp flag sensitivity near an anchor; they are not confidence
intervals, recession thresholds or return-optimised parameters. Values near trend
are labelled near trend, rather than confidently assigning a strong/weak regime.

GDPNow is a **separate model nowcast**, with its target quarter and q/q annualised
units. The FRED quarterly observation label is not a publication timestamp.
`lib/fred.mjs` additionally retrieves `last_updated` from `/fred/series`; a verified
update no older than 21 days and a target no more than 45 days past quarter end
are required to show it as fresh. Missing metadata, future timestamps and stale
targets withhold the headline number. GDPNow never enters either quadrant or the
asset-return experiment. Market breakevens, real yields, financial conditions and
liquidity remain additional, distinctly dated lenses.
`last_updated` is the FRED mirror's update timestamp, not an independently
verified Atlanta Fed forecast-release timestamp. Freshness checks are explicit
source-age heuristics, not a complete publication-calendar system.

Current source-backed levels enter future successful macro archive records with
their state method/version and provenance; old records are not backfilled. State
updates and GDPNow revisions change the dataset signature. The existing frozen
investment backtests test `momentum-1`, **not** the new state classifier.

Sources: [Chicago Fed CFNAI](https://www.chicagofed.org/research/data/cfnai/current-data),
[Fed inflation objective](https://www.federalreserve.gov/faqs/economy_14400.htm),
[GDPNow methodology](https://www.atlantafed.org/research-and-data/data/gdpnow/explainer).

An institutional-style workflow separates observed state, direction/nowcasts,
pricing/financing, and portfolio risk. A next substantive extension would be
matched-horizon consensus/surprise data plus portfolio sensitivity/risk budgets
and forward validation. Current market proxies are not a fabricated consensus
surprise index, and conditional asset lists are not risk-balanced allocations.

## Long-run statistics and debt cycle

The growth × inflation chart uses a 12-position fading trail by default: the
current published-data position plus eleven completed calendar periods. Choose
monthly, quarterly or annual spacing and 5/12/20 positions. Only sampling changes;
the underlying three-month momentum scales, weights and 75% coverage gates stay
the same. Older points shrink/fade, connecting segments also fade, and the current
point has an outer ring. Numbers run from 1 (oldest) to the selected count (Now).
Missing buckets keep their sequence numbers and remain gaps without connecting lines.
Hover/tap shows a tooltip; Inspect position supports keyboards and overlapping
points. Reduced-motion users receive no selection fade animation.

Historical positions are reconstructed in the browser from the already-fetched,
latest revised profiles. For each completed calendar bucket, use its last valid
monthly reference-period position. Only economic reference periods ending by the
sample cutoff enter, with the existing freshness rules. Source periods and their
momentum comparisons keep native monthly/quarterly frequencies. Original release
lags and historical vintages are not simulated; these are retrospective reference
positions, not previously archived readings or a tradable real-time backtest.
The UI labels this distinction and shows the actual sampled date. Reconstruction
does not write invented observations to History or the shared archive.

The Long-run context tab opens with a macro pressure score and four visual
pillar scales, with level and direction visible together. Pillar selection shows
oriented input z-scores, dates, exclusions and contributions to the total;
selecting an input opens its historical chart. A CSV exports all 16 score inputs,
effective weights, raw/capped z-scores and exclusion reasons. The detailed
heatmap remains available in a collapsed section.

The tab also provides a selectable level/momentum heatmap for 5, 10
and 20 preceding years, standard or robust normalization, empirical percentiles,
explicit sample sizes and an inspectable historical chart. Quarterly data stay
quarterly. Weekly series use their last observation in each completed month,
with a separate statistical reference date. Annual fiscal data remain annual.

- Standard z: `(current - preceding mean) / sample SD`, with `n - 1` variance.
- Robust z: `(current - preceding median) / (1.4826 * MAD)`. Zero dispersion is
  unavailable. Detailed numerical z-scores are not clipped; only colour intensity is.
- The current observation is excluded from the reference distribution. A series
  must span the full requested calendar window and have at least 95% of expected
  observations. Interior gaps are not filled and actual/expected counts remain
  visible. Short or sparse histories give no z-score.
- Percentile: `100 * (count below + 0.5 * count equal) / reference count`.
- Levels for activity and inflation are YoY rates, not trending nominal levels.
  Momentum compares those rates over 3 months (13 weeks for weekly inputs).
  Annual fiscal ratios use a one-year change. Small annual samples are flagged.
- Reference bands use the selected mean/SD or median/scaled MAD over the current
  window. They are descriptive, not rolling historical trading signals.
- Recession shading uses `USREC` and is retrospective. All profiles use the
  latest revised FRED history, not historical data vintages. This is not a
  backtest; COVID observations are preserved in both estimator views.

The independent debt panel includes household debt service / disposable income
(`TDSP`), net banks tightening C&I lending standards (`DRTSCILM`), gross federal
debt / GDP (`GFDEGDQ188S`), and federal interest outlays / receipts
(`100 * FYOINT / FYFR`, exact matching fiscal-year end dates). These metrics do
not alter quadrant weights. Their individual dates and freshness flags matter;
debt ratios are not default probabilities.

## Long-run macro pressure (application heuristic)

Model `long-run-pressure-1` is separate from the unchanged quadrant model.
Default reference: 10 preceding years, robust median/scaled MAD. Every reference
(5/10/20) and estimator (standard/robust) is calculated from the same profiles.
Four pillars each receive 25%, with equal weights among available inputs within
each pillar:

- Growth weakness: invert GDP, industrial production, manufacturing orders,
  payrolls and temporary employment growth.
- Inflation pressure: core PCE, CPI, wages and shelter growth, positive signs.
- Financial tightness: positive NFCI and bank lending standards; invert bank
  lending growth and net liquidity growth.
- Debt burden: household debt service, federal debt/GDP and interest/receipts,
  positive signs. The nominal policy rate remains contextual, outside this index.

Orient each level z-score, cap it at ±3, average within pillars, then average the
four pillars. `score = 50 + (50 / 3) * average`. The range is 0–100; 50 denotes
inputs at their respective historical centres. Capping only affects composite
contributions. The heatmap and export retain the raw z-scores.

Stale, missing and invalid reference inputs are excluded, without substituting
zero. Each pillar needs at least two-thirds of its original inputs, and total
coverage (average of four pillar coverage fractions) must reach 75%. All four
pillars must qualify; their 25% weights never migrate between pillars. A pillar
with a missing input redistributes its weight among its available inputs, visibly.

Momentum is calculated independently using the same signs/caps/coverage rules
on 3-month/13-week changes (one year for the annual fiscal ratio). Building/easing
thresholds are ±0.15 z; this is not the change in the headline score. Score labels
are below 40 / 40 to below 60 / 60 to below 75 / 75+, uncalibrated descriptive
bands. Opposing pillars can cancel, so the UI shows their spread and contributors.
A low score does not rule out deflation or risks omitted from these assumptions.
This is neither a recession probability nor an allocation/trading rule.

Snapshot responses contain all six variants. Archive/export records retain a
compact method-versioned score/pillar summary, without repeating input arrays.
Historical records lacking this field are not backfilled with today's statistics.
The API request includes the UI version to avoid a cached prior model response.

## History and scope

Valid snapshots are automatically saved when their dataset signature changes,
including revisions and freshness changes. Revisions to older statistical
reference data also change a compact context checksum. The browser persists the
latest 200 compact records; the combined history view/export supports up to 500.
Full multi-decade chart arrays are not copied into each saved record. Compact
context entries retain level and momentum arrays `[z, robustZ, percentile, n]`
for each horizon. Repeated identical fetches do not add records.
Version 1 records remain under their old storage key but are not mixed with the
new model. The old locally saved credential is removed on first load.
Version 2.0 records remain compatible because the `momentum-1` quadrant model
has not changed; version 2.1 adds a statistical layer, 2.2 adds the separate
pressure composite and 2.3 adds the retrospective reference-period trail.
Version 2.4 adds numbered circles, selected-period conditional asset sensitivities,
neutral momentum labels, historical economic checks and the separate research view.
Version 2.5 adds the separate static state view and independently dated GDPNow;
the original momentum model and frozen backtest results remain compatible.

The History view also loads `data/history.json`, a shared archive of changed
macro datasets, including revisions. The Macro monitor GitHub workflow runs
tests on PRs; after merging to main it runs daily at approximately 23:15 UTC
(GitHub scheduling may be delayed), on relevant main pushes and on manual
dispatch. Set the repository Actions secret `FRED_API_KEY`. On a successful
complete refresh, `scripts/archive.mjs` appends a changed dataset and the
workflow commits it to main. The archive retains the latest 500 changed records.
Failures stop the job instead of recording defaults. Market-provider prices and
credit-spread observations are excluded from the shared archive; each macro
observation retains its source attribution. Main-branch protection requiring PRs
may block the archive's push and will need a compatible repository policy.

The workflow is not active on a feature branch. The initial archive entry is a
real observation collected during implementation, not fabricated past history.
Live API fetches work independently of the archive and do not write history on
the server. No notifications, consensus feed or calibrated risk-parity portfolio
are configured. A separate frozen vintage-based backtest is available in the
research view; it does not establish a reliable predictive edge. ISM/Roche manual
entry and legacy import were removed rather than silently carrying example
values into a current regime.

## Backtest and experimental predictions

See [research findings, sources, timing and reproduction](scripts/research/README.md)
and the byte-preserved [predeclared protocol](scripts/research/protocol.md).
The app compares thirteen strategies and baselines over the same reserved Jan 2021–Dec 2025 window,
with actual ALFRED publication vintages, prior-day market features, matured labels
and turnover costs. Conditional next-month returns, sample sizes, lag diagnostics,
and revised economic sanity checks are separate views. Public JSON contains
aggregate statistics/yearly strategy returns, not raw provider price histories.

Original quadrant rotation earned 4.34% CAGR vs SPY's 14.32%. A separate predictive
rotation earned 14.90%, but its paired uncertainty interval includes zero and its
25 bp stress result trails SPY. Consequently the descriptive axes were not retuned
to force theoretical asset winners. The predictor remains explicitly experimental.
Its October 2026 snapshot is dated and frozen; live FRED refresh/archiving does not
retrain it. Synthetic research checks run in CI alongside Node tests.

## Public research and source terms

- [Bridgewater: The All Weather Story](https://www.bridgewater.com/research-and-insights/the-all-weather-story)
- [Ray Dalio: Principles](https://www.principles.com/)
- [FRED observations and vintage API](https://fred.stlouisfed.org/docs/api/fred/series_observations.html)
- [Discipline Funds macro dashboard](https://macro.disciplinefunds.com/)
- [Discipline Funds Leading Inflation Index](https://macro.disciplinefunds.com/leading-inflation-index/)
- [Discipline Funds Treasury payroll-tax tracker](https://macro.disciplinefunds.com/real-time-payrolls-tracker/)
- [WMI Dalio Market Principles: public programme description](https://wmi.edu.sg/dmp-online-international/)
- [OECD/JRC: Handbook on Constructing Composite Indicators](https://www.oecd.org/en/publications/handbook-on-constructing-composite-indicators-methodology-and-user-guide_9789264043466-en.html)

Discipline Funds informs the separation of indicators and historical views;
its proprietary Roche/LII series are not copied or recreated with guessed
formulas. WMI's public curriculum informs the separation of economic/market
context from investment decisions and scenario testing. Paid course material,
proprietary simulator data and internal investment formulas are not reproduced.

Observed momentum is not a surprise relative to discounted expectations.
Capital allocation and risk allocation are different. Scenario sensitivities
are illustrative, not allocation recommendations. Every displayed series links
to its FRED provider and terms; a free API key is not a blanket redistribution
license, including for CBOE VIX and ICE BofA data. No affiliation or endorsement.
