# Dalio Quadrant — Macro Regime Dashboard

A single-page dashboard that places the economy on Ray Dalio's Growth × Inflation
quadrant (Goldilocks / Overheating / Stagflation / Deflation) from live
[FRED](https://fred.stlouisfed.org/) data, with market confirmation from
[Finviz](https://finviz.com/).

## How data fetching works

Browsers can't call FRED or Finviz directly (no CORS / private tokens), so two
small Vercel serverless functions proxy them:

- **`api/fred.js`** — server-side proxy to FRED. No CORS, edge-cached 1 h, reads
  the key from `FRED_API_KEY`. Supports single (`?series_id=`) and batch
  (`?series_ids=A,B,C`) requests.
- **`api/finviz.js`** — server-side proxy to Finviz Elite (CSV → JSON). Reads the
  Elite auth token from `FINVIZ_API_KEY`. Powers:
  - `?type=groups&g=sector` — sector performance (Market Confirmation panel)
  - `?type=futures` — futures & forex snapshot
- **`index.html`** — the dashboard. It auto-loads on open and re-fetches with
  **⟳ Fetch**. If opened off-Vercel (`file://`), it falls back to public CORS
  proxies for FRED using a key typed into the FRED API box.

### What's automatic now
- **Auto-fetch on load** (cached in `localStorage`; refetches if data > 6 h old).
- **Misery Index** and **Fed Net Liquidity Δ** are now **derived from FRED**
  (`UNRATE + CPI YoY`, and `WALCL − WTREGEN − RRPONTSYD` YoY%) instead of typed in.
- Each indicator shows a clickable **source link**, the **data date** ("as of"),
  and a **▲/▼ direction**. YoY is computed by date-matching the ~12-month-prior
  valid observation (missing `.` values skipped).
- Only **ISM PMI, Roche LII, Roche Recession** remain manual (no clean feed).

## Setup (recommended)

1. FRED key (free): <https://fred.stlouisfed.org/docs/api/api_key.html>
2. Finviz **Elite auth token**: Finviz Elite → account/API settings.
3. Vercel project → **Settings → Environment Variables** (Production + Preview):
   - `FRED_API_KEY = <your FRED key>`
   - `FINVIZ_API_KEY = <your Finviz Elite auth token>`
4. **Redeploy**. Open the site — data loads automatically, no key needed in the UI.

Without the env vars the dashboard still works: paste a FRED key into the
**FRED API** field for FRED data; the Finviz panels show a "set FINVIZ_API_KEY"
note until the token is configured.

## Manual-entry indicators

No clean public feed, so entered by hand (defaults provided): **ISM Manufacturing
PMI**, **Roche Leading Inflation**, and the **Roche Recession Rule**.
