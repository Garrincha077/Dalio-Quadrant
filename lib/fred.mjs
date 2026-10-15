import { SERIES, DEFINITIONS, buildSnapshot } from "./model.mjs";
export async function fetchSeries(
  id,
  key,
  { fetchImpl = fetch, start, limit = 2000, sort = "desc" } = {},
) {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  const params = {
    series_id: id,
    api_key: key,
    file_type: "json",
    sort_order: sort,
    limit: String(limit),
  };
  if (start) params.observation_start = start;
  url.search = new URLSearchParams(params);
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { error: true, status: response.status };
    const json = await response.json();
    return Array.isArray(json.observations)
      ? { observations: json.observations }
      : { error: true, status: 502 };
  } catch {
    return { error: true, status: 502 };
  }
}
export async function loadDashboard(
  key,
  { now = new Date(), fetchImpl = fetch, archiveOnly = false } = {},
) {
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - 25 * 12);
  const shortStart = new Date(now);
  shortStart.setUTCMonth(shortStart.getUTCMonth() - 30);
  const longSeries = new Set([
    ...DEFINITIONS.filter((d) =>
      ["growth", "inflation", "credit", "debt"].includes(d.group),
    ).map((d) => d.series),
    "WALCL",
    "WTREGEN",
    "RRPONTSYD",
    "FYOINT",
    "FYFR",
    "USREC",
  ]);
  const requested = archiveOnly
    ? [
        ...new Set([
          ...DEFINITIONS.filter((d) =>
            ["growth", "inflation", "credit", "debt"].includes(d.group),
          ).map((d) => d.series),
          "WALCL",
          "WTREGEN",
          "RRPONTSYD",
          "FYOINT",
          "FYFR",
          "USREC",
        ]),
      ]
    : SERIES;
  const raw = {};
  let index = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (index < requested.length) {
        const id = requested[index++];
        raw[id] = await fetchSeries(id, key, {
          fetchImpl,
          start: (longSeries.has(id) ? start : shortStart)
            .toISOString()
            .slice(0, 10),
          limit: longSeries.has(id) ? 10000 : 2000,
        });
      }
    }),
  );
  const snapshot = buildSnapshot(raw, now);
  snapshot.errors = requested.filter((id) => raw[id]?.error);
  return snapshot;
}
