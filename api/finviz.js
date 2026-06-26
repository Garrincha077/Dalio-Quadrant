// Vercel Serverless Function — server-side proxy for Finviz Elite.
//
// Browsers can't call Finviz directly, and the Elite export needs the private
// `auth` token. We proxy here and keep the token in FINVIZ_API_KEY so it never
// reaches the client. Inputs are whitelisted (no open proxy / SSRF).
//
//   /api/finviz?type=groups&g=sector     -> sector performance  (parsed JSON)
//   /api/finviz?type=groups&g=industry   -> industry performance
//   /api/finviz?type=futures             -> futures & forex snapshot

const UA = 'Mozilla/5.0 (compatible; DalioQuadrant/1.0; +https://dalio-quadrant.vercel.app)';

// Minimal CSV parser that respects quoted fields containing commas/quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0];
  return rows.slice(1).map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });
}

async function fetchText(url, headers) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    const body = await r.text();
    return { ok: r.ok, status: r.status, body };
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

  const key = process.env.FINVIZ_API_KEY;
  if (!key) {
    res.status(400).json({
      error: 'No Finviz key. Set FINVIZ_API_KEY (Finviz Elite auth token) in the Vercel project env.',
    });
    return;
  }

  const q = req.query || {};
  const type = String(q.type || 'groups');

  try {
    if (type === 'groups') {
      const g = ['sector', 'industry', 'country', 'capitalization'].includes(q.g) ? q.g : 'sector';
      // v=140 = Group "Performance" view (Name, Perf Week/Month/Quart/Half/Year/YTD, ...)
      const url = `https://elite.finviz.com/grp_export.ashx?g=${g}&v=140&auth=${encodeURIComponent(key)}`;
      const r = await fetchText(url, { 'User-Agent': UA });
      if (!r.ok) {
        res.status(r.status).json({ error: 'Finviz request failed', status: r.status, detail: r.body.slice(0, 200) });
        return;
      }
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
      res.status(200).json({ group: g, rows: csvToObjects(r.body) });
      return;
    }

    if (type === 'futures') {
      // Finviz futures performance feed (JSON). Token appended in case Elite gating applies.
      const url = `https://finviz.com/api/futures_all.ashx?timeframe=NO&auth=${encodeURIComponent(key)}`;
      const r = await fetchText(url, { 'User-Agent': UA, 'Referer': 'https://finviz.com/futures.ashx' });
      if (!r.ok) {
        res.status(r.status).json({ error: 'Finviz futures failed', status: r.status, detail: r.body.slice(0, 200) });
        return;
      }
      let data;
      try { data = JSON.parse(r.body); } catch { data = r.body; }
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
      res.status(200).json({ futures: data });
      return;
    }

    res.status(400).json({ error: 'Invalid type. Use type=groups or type=futures.' });
  } catch (e) {
    res.status(502).json({ error: 'Upstream fetch error', detail: String(e) });
  }
}
