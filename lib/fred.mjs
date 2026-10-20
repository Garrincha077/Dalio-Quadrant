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
            ["growth", "inflation", "credit", "debt", "state"].includes(
              d.group,
            ),
          ).map((d) => d.series),
          "WALCL",
          "WTREGEN",
          "RRPONTSYD",
          "FYOINT",
          "FYFR",
          "USREC",
          "GDPNOW",
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
          start: ["CFNAIMA3", "PCEPI"].includes(id)
            ? "1959-01-01"
            : (longSeries.has(id) ? start : shortStart)
                .toISOString()
                .slice(0, 10),
          limit: longSeries.has(id) ? 10000 : 2000,
        });
        if (id === "GDPNOW" && raw[id].observations?.length)
          raw[id].metadata = await fetchSeriesMetadata(id, key, { fetchImpl });
      }
    }),
  );
  const snapshot = buildSnapshot(raw, now);
  snapshot.errors = requested.filter((id) => raw[id]?.error);
  if (raw.GDPNOW?.metadata?.error) snapshot.errors.push("GDPNOW_METADATA");
  return snapshot;
}
export async function fetchSeriesMetadata(id, key, { fetchImpl = fetch } = {}) {
  const url = new URL("https://api.stlouisfed.org/fred/series");
  url.search = new URLSearchParams({
    series_id: id,
    api_key: key,
    file_type: "json",
  });
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { error: true };
    const row = (await response.json()).seriess?.[0];
    return typeof row?.last_updated === "string"
      ? { lastUpdated: row.last_updated }
      : { error: true };
  } catch {
    return { error: true };
  }
}
