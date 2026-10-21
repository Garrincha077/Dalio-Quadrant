# Dalio Quadrant — Principles & Evidence

## Separate value and price scores · v2.12

The **Value & price** tab adds asset-specific valuation/yield proxies alongside
completed-month log-price z-scores, with separate directions, original source
dates, native observation counts, a history chart and fixed 20-year sensitivity.
Both normalisations exclude the current observation from their reference sample.
Their coefficients are learned from past matured outcomes, never manually
combined into an overall buy/sell score.

Seven fixed models test the value and price contributions on identical dates.
A separate four-model exploratory price study uses only verified macro and price
inputs. Existing frozen v1/v2 results remain unchanged. On 21 October 2026 FRED
returned HTTP-200 maintenance pages during new source acquisition: the release
shows missing value sources explicitly and withholds the full experiment.
Verified price scores for all five ETFs, the gold real-price proxy and the
exploratory price study remain available. No missing value is filled with zero.

See the [v3 reproduction guide and source limits](scripts/research/v3/README.md).

## State, momentum and maximum-history evidence · v2.11

The **Backtest & prediction** view now opens with a same-date comparison of static
state, momentum and their combination, alongside a source coverage table and
independent calculation checks. It separates revised historical associations,
retrospective point-in-time model checks and genuinely recorded forward forecasts.
The original frozen research remains available in a labelled expandable section.

Historical context reaches US annual data from 1870 and a separate monthly broad
equity proxy from 1926. State-conditioned monthly research starts in 1967; original
CFNAI releases start in 2001. The matched 12M predictive test starts in 2017 after
training and maturity gates. These histories are not interchangeable.

The combination's predictive advantage remains unconfirmed. See the
[v2 method, source limits, reproduction and forward ledger](scripts/research/v2/README.md).
JST-derived annual context is separately attributed under CC BY-NC-SA 4.0;
no academic proxy is silently spliced into ETF histories.

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

## Installable Chrome app

The same dashboard is a PWA with a stable manifest ID/start URL `/`, standalone
window, dark theme, 192/512 PNG icons and a maskable icon. Open the final public
HTTPS address in Chrome and use **Install app**, the address-bar install icon,
or Chrome's menu → Cast, save and share → Install page as app. When an embedded
browser cannot expose installation, the button shows manual instructions.
Installation depends on Chrome/device support and engagement; it is not forced.
See [Chrome's instructions](https://support.google.com/chrome/answer/9658361).

Use a stable public production origin for permanent installation. Vercel preview
URLs create distinct installations tied to their particular origin and can need
authentication; no bypass token or changing preview URL is embedded in the manifest.

`sw.mjs` precaches the public shell/research assets atomically. Failed, redirected,
wrong-MIME or wrong-version HTML responses do not replace a working shell. It
never caches `/api/*`, auth/share-token or third-party requests. Dashboard requests
use `cache: no-store`; no live API response is reused as an offline reading.
The daily shared archive refreshes online with a dated offline fallback. The
derived CSV is cached after its first successful download. Activation removes
only this app's older cache namespaces. New workers wait for **Update & reload**;
API version mismatches also request a worker update.

After a successful complete refresh, the device stores only a compact dated
activity/PCE summary. On offline or failed live refresh, a separate read-only
panel shows it while the current model/recommendation is withheld. Reconnection
refreshes automatically. Local History and downloaded frozen research remain
available; this does not provide an offline live macro forecast. Clearing browser
data removes saved observations and offline files.

When changing public app assets, bump `VERSION`, `PWA_VERSION` and the HTML
`data-app-shell` marker together. Keep module dependencies in `SHELL_PATHS`;
Node tests verify release alignment and dependency coverage. Regenerate the
code-native icons with `python scripts/generate-icons.py` (Pillow needed only
for authoring). Browser Cache Storage is optional; denied/full storage must not
break online usage. Server-side FRED credentials remain unchanged.

## Data and calculation

`api/dashboard.js` requests 40 distinct FRED series in eight bounded workers,
plus GDPNow's series metadata to verify the FRED source update timestamp. The
state anchors and momentum inputs run first. A 45-second overall budget and
8-second request timeouts leave room under the 60-second function limit; timed-out
or unrequested series remain explicitly unavailable and prevent success caching.
The API fetches up to 25 years for macro, debt and recession context, and 30 months for supporting static-state,
nowcast and daily market/stress series. Daily RRP inputs receive a 10,000-observation limit so the
long liquidity history is not silently truncated. The response includes
normalized data, quality flags, statistical profiles and the computed regime.
Responses without source errors are edge cached for one hour. Partial failures
are not cached. The browser refreshes on opening and every six hours while
visible; it also refreshes when returning to an old session.
The two state axes, `CFNAIMA3` and `PCEPI`, additionally request their full available
monthly history from 1959 (actual CFNAI-MA3 starts in May 1967). This adds no series
requests; the longer data supports the state trail and historical distribution.

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
(`economic-state-2`); **Momentum & data** retains the original momentum chart.
State X is published CFNAI-MA3 activity relative to historical growth trend, with
zero as its anchor. State Y is headline PCE YoY minus the Fed's 2% longer-run
inflation anchor. This is neither an output gap nor economic surprises versus
consensus. Core PCE remains a separately labelled cross-check.

Sixteen dated indicators are grouped into anchors; output, income and demand;
labour; and inflation/wages. Six additional FRED series add real income excluding
transfers (`W875RX1`), real consumption (`PCEC96`), real manufacturing/trade sales
(`CMRMTSPL`), household employment (`CE16OV`), core CPI (`CPILFESL`), and Dallas
Fed trimmed-mean PCE (`PCETRIM12M159SFRBDAL`). The first five use exact year-earlier
levels; trimmed PCE is already published as a 12-month rate and stays in levels.

Monthly activity breadth counts positive YoY readings among production, payrolls,
household employment, real income, consumption and sales. At least four of six
must be fresh with completed periods, and no reading may trail the freshest
usable month by more than two months. Zero is unchanged; missing/stale values
are excluded and coverage/reference months are displayed. Positive growth does
not establish above-trend activity. This count follows NBER indicator categories,
not its recession-dating process; it is neither a probability nor independent
confirmation count. These overlapping diagnostics do not change either axis,
the original momentum model or the frozen investment backtest.

Both state axes require completed monthly periods, freshness within 90 days of
period end, and reference months no more than one month apart. No missing values
or year-earlier bases are filled. Descriptive buffers ±0.10 activity units and
±0.20 inflation pp flag sensitivity near an anchor; they are not confidence
intervals, recession thresholds or return-optimised parameters. Values near trend
are labelled near trend, rather than confidently assigning a strong/weak regime.

Economy now also has a 12-position numbered fading trail, direction arrow/readout,
monthly/quarterly/annual sampling, arbitrary historical ending month and return to
latest data. Historical dots require activity and PCE YoY for the exact same
completed reference month; quarterly/annual prior samples require the bucket's final
month. The ending sample can be within an unfinished quarter/year. The live final
dot preserves the current axes' existing one-month alignment allowance and labels
both actual dates. Its reference month, rather than the fetch month, anchors the
trail. Missing pairs stay as numbered unconnected gaps. Inspect position exposes
all overlapping points to keyboards and touch users.

Standard viewports are fixed at activity ±2 and PCE-minus-2 ±6 pp; Close uses
±0.5/±2 pp. Full history uses symmetric bounds covering all available extrema.
Only the viewport changes: neither mean, percentile nor zoom changes activity zero,
PCE 2% or quadrant membership. Off-range diamonds are explicitly flagged; connecting
lines clip their true coordinates rather than connecting displaced boundary marks.
The final consecutive segment has a direction arrow when it is long enough to
remain visible outside its dots; the dated move readout also covers small moves.

Latest activity context uses full/20/10-year prior monthly references, excluding
the current month. At least 24 observations and 95% expected coverage are required.
The histogram groups values outside ±2 into edge bins, with exact extrema in text.
Robust dispersion is 1.4826 × MAD about the reference median; distance from economic
zero is activity / robust dispersion. Descriptive strength is
`50 + (50/3) * distance`, clipped to [0,100]. Thus exactly zero maps to 50 even when
the historical mean/median differs. This is not a mean-centred z-score, percentile,
probability or investment signal. Zero dispersion/insufficient histories withhold it.

The state trail and context use today's revised history. They are descriptive
reference-period replays, not publication-vintage trading tests. The fixed 2% anchor
before its formal 2012 adoption is an analytical reference, not a claim about an
official contemporary target. Full historical arrays are served as `stateHistory`
and kept out of compact macro archive records. Existing investment research is
unchanged and has not validated this descriptive strength measure.

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

### Static state and subsequent returns

Economy now additionally includes a separate frozen **state-forward-1** study,
dated 20 October 2026. Every one of 712 same-month revised states (May 1967–August
2026) has explicit 3/12/36-month outcomes or missing-history/unfinished labels.
Available ETF prices constrain realised returns to December 1999 onward for SPY
and March 2006 onward for a common five-asset basket. Complete prices end September
2026; the 36-month common reference cohort ends September 2023, not 2026.

Choose common dates or each asset's maximum history, reference-month or two-month
delayed entry, and mean/median/difference from the asset's own cohort baseline.
Selecting a state-trail dot shows its subsequent outcomes; changing dot sampling
does not change the study's full monthly sample. Cumulative adjusted-price returns
are in USD, not annualised, with no trading costs. Exact anchors are retained
separately from the four quadrant ranks. Derived outcomes are downloadable as CSV.

Conditional distributions, point-biserial and continuous correlations, categorical
eta² and paired moving-block intervals address association and overlapping labels.
They are exploratory, not multiple-test adjusted or point-in-time strategy evidence.
Both entry modes use revised economic data; a fixed two-month delay does not remove
revision bias. None of these results retunes the axes or frozen investment models.
See [findings and reproduction](scripts/research/STATE_FORWARD.md) and the separate
[static-state specification](scripts/research/state-forward-protocol.md).

### Live state + trend asset preference

Economy now's **Preferred asset classes** card ranks the five covered assets
using the latest fresh same-month state and a fixed three-month change in
activity/PCE. Choose a 3/12/36-month investment horizon. The current card remains
live when the user replays historical chart positions or changes dot sampling.
Missing/stale/mixed-month axes or gaps in the four-month trend window withhold
the preference rather than retaining a previous recommendation.

The `state-tilt-1` rule uses common mature two-month-delayed return labels from
`state-forward-1`, with two levels of pooling toward broader state and global
history (24 pseudo-observations per stage). Inside existing boundary buffers,
neighbouring states blend smoothly: activity +0.01 is 55% above / 45% below.
Those are statistical blending weights, not probabilities or portfolio weights.
The chart's economic anchors and classification are unchanged.

The card shows three candidates and all five ranks with pooled historical mean,
median, P10, weighted loss frequency and lift from the asset's own baseline.
It discloses cohort/episode counts, mixture weights, boundary disagreement and
the frozen price cutoff. It is a **new research recommendation, not an
out-of-sample validated strategy**. Historical weighted means/loss frequencies
are not future-return forecasts/probabilities. Ranking does not equalise risk.
See [the fixed method](scripts/research/state-tilt-method.md). The independent
Python source-price check is `scripts/research/verify-state-tilt.py`.

Sources: [Chicago Fed CFNAI](https://www.chicagofed.org/research/data/cfnai/current-data),
[Fed inflation objective](https://www.federalreserve.gov/faqs/economy_14400.htm),
[NBER activity measures](https://www.nber.org/research/business-cycle-dating),
[Dallas Fed trimmed PCE via FRED](https://fred.stlouisfed.org/series/PCETRIM12M159SFRBDAL),
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
