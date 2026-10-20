export const OFFLINE_KEY = "dalio-offline-summary-1";
const validDate = (s) =>
  typeof s === "string" && Number.isFinite(Date.parse(s));
const axis = (d) =>
  d?.status === "ok" && Number.isFinite(d.value) && validDate(d.date)
    ? { value: d.value, date: d.date }
    : null;
export function saveOfflineSummary(snapshot, storage) {
  if (
    !validDate(snapshot?.fetchedAt) ||
    snapshot.errors?.length ||
    !snapshot.economicState?.available
  )
    return false;
  const summary = {
    schema: 1,
    version: snapshot.version,
    fetchedAt: snapshot.fetchedAt,
    activity: axis(snapshot.economicState.activity),
    inflation: axis(snapshot.economicState.inflation),
  };
  if (!summary.activity || !summary.inflation) return false;
  try {
    (storage ?? globalThis.localStorage).setItem(
      OFFLINE_KEY,
      JSON.stringify(summary),
    );
    return true;
  } catch {
    return false;
  }
}
export function readOfflineSummary(storage, now = new Date()) {
  try {
    const summary = JSON.parse(
      (storage ?? globalThis.localStorage).getItem(OFFLINE_KEY),
    );
    if (
      summary?.schema !== 1 ||
      !validDate(summary.fetchedAt) ||
      Date.parse(summary.fetchedAt) > +now + 300000
    )
      return null;
    if (
      ![summary.activity, summary.inflation].every(
        (d) => d && Number.isFinite(d.value) && validDate(d.date),
      )
    )
      return null;
    return summary;
  } catch {
    return null;
  }
}
export function clearOfflineSummary() {
  document.getElementById("offlineSummary").hidden = true;
}
export function showOfflineSummary() {
  const host = document.getElementById("offlineSummary"),
    summary = readOfflineSummary();
  host.hidden = false;
  document.getElementById("offlineSummaryDate").textContent = summary
    ? `Saved ${new Date(summary.fetchedAt).toLocaleString()} · app ${summary.version}.`
    : "No successful economic snapshot has been saved on this device yet.";
  document.getElementById("offlineSummaryValues").textContent = summary
    ? `Activity ${summary.activity.value.toFixed(2)} (${summary.activity.date.slice(0, 7)}) · PCE inflation ${summary.inflation.value.toFixed(2)}% (${summary.inflation.date.slice(0, 7)}).`
    : "Open the app online and complete a successful refresh to save a dated summary.";
}
