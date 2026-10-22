import { fetchSeries } from "../lib/fred.mjs";
import { SERIES } from "../lib/model.mjs";
// Compatibility endpoint: server-only credentials and an explicit series list.
export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.FRED_API_KEY)
    return res
      .status(503)
      .json({ error: "FRED is not configured on the server." });
  const q = req.query || {},
    ids = [...new Set(String(q.series_ids || q.series_id || "").split(","))];
  if (!ids.length || ids.length > 12 || ids.some((id) => !SERIES.includes(id)))
    return res.status(400).json({ error: "Unsupported series" });
  const limit = Math.min(
    Math.max(Number.parseInt(q.limit, 10) || 100, 1),
    2000,
  );
  const rows = await Promise.all(
    ids.map((id) =>
      fetchSeries(id, process.env.FRED_API_KEY, {
        limit,
        sort: q.sort_order === "asc" ? "asc" : "desc",
      }),
    ),
  );
  const failed = rows.some((row) => row.error);
  const maintenance = rows.some((row) => row.code === "FRED_MAINTENANCE");
  res.setHeader("Cache-Control", failed ? "no-store" : "public, s-maxage=3600");
  if (maintenance) res.setHeader("Retry-After", "300");
  return res
    .status(maintenance ? 503 : failed ? 502 : 200)
    .json(
      q.series_ids
        ? Object.fromEntries(ids.map((id, i) => [id, rows[i]]))
        : rows[0],
    );
}
