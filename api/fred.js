// Vercel Serverless Function — server-side proxy for the FRED API.
//
// Why: browsers cannot call api.stlouisfed.org directly (no CORS headers),
// and public CORS proxies are rate-limited and frequently down. Proxying
// here makes data fetching reliable and lets the FRED key live in an env
// var (FRED_API_KEY) so visitors don't have to paste one.
//
// Usage from the client:
//   /api/fred?series_id=GDP&limit=8&sort_order=desc
//   (api_key is optional — falls back to the FRED_API_KEY env var)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const q = req.query || {};
  const seriesId = String(q.series_id || '');
  if (!/^[A-Za-z0-9_]+$/.test(seriesId)) {
    res.status(400).json({ error: 'Invalid or missing series_id' });
    return;
  }

  // Prefer the server-side env key; allow a client-supplied key as fallback.
  const key = process.env.FRED_API_KEY || q.api_key;
  if (!key) {
    res.status(400).json({
      error: 'No FRED API key available. Set FRED_API_KEY in the Vercel project env, or pass api_key.',
    });
    return;
  }

  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);
  const sort = q.sort_order === 'asc' ? 'asc' : 'desc';

  const url =
    'https://api.stlouisfed.org/fred/series/observations' +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(key)}` +
    `&file_type=json&sort_order=${sort}&limit=${limit}`;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12000);
    const upstream = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);

    const body = await upstream.text();
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: 'FRED request failed',
        status: upstream.status,
        detail: body.slice(0, 300),
      });
      return;
    }

    // Cache at the edge: FRED series update at most daily/weekly.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(body);
  } catch (e) {
    res.status(502).json({ error: 'Upstream fetch error', detail: String(e) });
  }
}
