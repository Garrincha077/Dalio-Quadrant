# Dalio Quadrant — Principles & Evidence

Independent US macro monitor inspired by the public All Weather framework. Uses
FRED only; no Finviz Elite, public CORS proxy, AI provider or browser API key.
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

`api/dashboard.js` fetches 30 months for 25 distinct FRED series, in five bounded
workers, and returns normalized data, quality flags and the computed regime.
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
- “Disinflationary slowdown” does not establish deflation or a recession.
- Market context: `DGS10`, `DFII10`, `T10YIE`, `DTWEXBGS`, `DCOILWTICO`, `VIXCLS`.
  Changes are rates in basis points, price/index percent changes or VIX points,
  with actual dated observations. These are not sector/futures/total returns.

## History and scope

Valid snapshots are automatically saved when their dataset signature changes,
including revisions and freshness changes. Browser history is capped at 500
records and can be exported. Repeated identical fetches do not add records.
Version 1 records remain under their old storage key but are not mixed with the
new model. The old locally saved credential is removed on first load.

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
the server. No notifications, consensus feed, calibrated risk-parity portfolio
or backtest are configured. Timestamped release/vintage information and
validation are required for those investment-model extensions. ISM/Roche manual
entry and legacy import were removed rather than silently carrying example
values into a current regime.

## Public research and source terms

- [Bridgewater: The All Weather Story](https://www.bridgewater.com/research-and-insights/the-all-weather-story)
- [Ray Dalio: Principles](https://www.principles.com/)
- [FRED observations and vintage API](https://fred.stlouisfed.org/docs/api/fred/series_observations.html)

Observed momentum is not a surprise relative to discounted expectations.
Capital allocation and risk allocation are different. Scenario sensitivities
are illustrative, not allocation recommendations. Every displayed series links
to its FRED provider and terms; a free API key is not a blanket redistribution
license, including for CBOE VIX and ICE BofA data. No affiliation or endorsement.
