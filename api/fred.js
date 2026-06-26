// Vercel Serverless Function — server-side proxy for the FRED API.
//
// Why: browsers cannot call api.stlouisfed.org directly (no CORS headers),
// and public CORS proxies are rate-limited and frequently down. Proxying
// here makes data fetching reliable and lets the FRED key live in an env
// var (FRED_API_KEY) so visitors don't have to paste one.
//
// Usage from the client:
//   /api/fred?series_id=GDP&limit=8&sort_order=desc
//   /api/fred?series_ids=WALCL,WTREGEN,RRPONTSYD&limit=60   (batch → { WALCL:{...}, ... })
//   (api_key is optional — falls back to the FRED_API_KEY env var)

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const isValidId = (id) => /^[A-Za-z0-9_]+$/.test(id);

function buildUrl(seriesId, key, limit, sort) {
  return (
    `${FRED_BASE}?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(key)}` +
    `&file_type=json&sort_order=${sort}&limit=${limit}`
  );
}

async function fetchSeries(seriesId, key, limit, sort) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(buildUrl(seriesId, key, limit, sort), { signal: ctrl.signal });
    const body = await r.text();
    if (!r.ok) return { error: true, status: r.status, detail: body.slice(0, 200) };
    return JSON.parse(body);
  } catch (e) {
    return { error: true, status: 502, detail: String(e) };
  } finally {
    clearTimeout(tid);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const q = req.query || {};
  const key = process.env.FRED_API_KEY || q.api_key;
  if (!key) {
    res.status(400).json({
      error: 'No FRED API key available. Set FRED_API_KEY in the Vercel project env, or pass api_key.',
    });
    return;
  }

  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 600);
  const sort = q.sort_order === 'asc' ? 'asc' : 'desc';

  try {
    // Batch mode: ?series_ids=A,B,C  ->  { A: {observations:[...]}, B: {...} }
    if (q.series_ids) {
      const ids = String(q.series_ids).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
      if (!ids.length || !ids.every(isValidId)) {
        res.status(400).json({ error: 'Invalid series_ids' });
        return;
      }
      const out = {};
      await Promise.all(ids.map(async (id) => { out[id] = await fetchSeries(id, key, limit, sort); }));
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json(out);
      return;
    }

    // Single mode
    const seriesId = String(q.series_id || '');
    if (!isValidId(seriesId)) {
      res.status(400).json({ error: 'Invalid or missing series_id' });
      return;
    }
    const data = await fetchSeries(seriesId, key, limit, sort);
    if (data.error) {
      res.status(data.status || 502).json({ error: 'FRED request failed', detail: data.detail });
      return;
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Upstream fetch error', detail: String(e) });
  }
}
