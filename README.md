# Dalio Quadrant — Macro Regime Dashboard

A single-page dashboard that places the economy on Ray Dalio's Growth × Inflation
quadrant (Goldilocks / Overheating / Stagflation / Deflation) from live
[FRED](https://fred.stlouisfed.org/) data.

## How data fetching works

The browser cannot call the FRED API directly (no CORS headers), so a small
Vercel serverless function proxies it:

- **`api/fred.js`** — server-side proxy to FRED. No CORS issues, edge-cached for
  1 hour, and it reads the key from the `FRED_API_KEY` env var so visitors don't
  have to supply one.
- **`index.html`** — the dashboard. Pressing **⟳ Fetch** calls `/api/fred` first
  (the reliable path); if the app is opened off-Vercel (e.g. `file://`), it falls
  back to public CORS proxies using a key typed into the FRED API box.

YoY indicators (CPI, Core PCE, payrolls, etc.) are computed by matching the
observation ~12 months before the latest *valid* one by date — missing/`.`
observations are skipped — so a not-yet-released month no longer corrupts the value.

## Setup (recommended)

1. Get a free FRED API key: <https://fred.stlouisfed.org/docs/api/api_key.html>
2. In the Vercel project: **Settings → Environment Variables**, add
   `FRED_API_KEY = <your key>` and redeploy.
3. Open the site and press **⟳ Fetch** — no key needed in the UI.

Without the env var, the dashboard still works: paste a FRED key into the
**FRED API** field and press **Fetch** (it will route through public proxies).

## Manual-entry indicators

A few series have no clean FRED feed and are entered by hand (defaults provided):
ISM Manufacturing PMI, Roche Leading Inflation, Fed Net Liquidity Δ, Roche
Recession Rule, and the Misery Index.
