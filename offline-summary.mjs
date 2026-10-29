import { validVerifiedReadings } from "./lib/verified-readings.mjs";
export const OFFLINE_KEY = "dalio-offline-summary-1";
let generation = 0;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[c]);
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
  generation++;
  document.getElementById("offlineSummary").hidden = true;
}
export async function showOfflineSummary() {
  const requestGeneration = ++generation;
  const host = document.getElementById("offlineSummary"),
    local = readOfflineSummary();
  let summary = local, published = false;
  host.hidden = false;
  document.getElementById("offlineSummaryDate").textContent = "Checking the last verified readings…";
  document.getElementById("offlineSummaryDetails").innerHTML = "";
  try {
    const response = await fetch("/data/last-verified.json", {cache: "no-cache", signal: AbortSignal.timeout(5000)});
    const record = response.ok ? await response.json() : null;
    if (validVerifiedReadings(record) && (!local || record.fetchedAt > local.fetchedAt)) {
      summary = record;
      published = true;
    }
  } catch { /* A network failure must not remove locally saved readings. */ }
  if (requestGeneration !== generation) return;
  document.getElementById("offlineSummaryDate").textContent = summary
    ? `${published ? "Last published successful fetch" : "Saved on this device"}: ${new Date(summary.fetchedAt).toLocaleString()} · app ${summary.version}. These are not newly fetched observations.`
    : "No verified saved readings are available on this device or from the published archive.";
  document.getElementById("offlineSummaryValues").textContent = summary
    ? `Activity ${summary.activity.value.toFixed(2)} (${summary.activity.date.slice(0, 7)}) · PCE inflation ${summary.inflation.value.toFixed(2)}% (${summary.inflation.date.slice(0, 7)}).`
    : "Live readings remain unavailable. Refresh data retries the provider.";
  if (published) {
    const signed = (n) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
    document.getElementById("offlineSummaryDetails").innerHTML = `<p class="sub">Saved growth momentum ${signed(summary.growthMomentum)} · saved inflation momentum ${signed(summary.inflationMomentum)}. Current recommendations remain withheld.</p><details><summary>Inspect ${summary.indicators.length} verified saved indicators</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Saved indicator readings; scroll horizontally"><table><caption>Read-only observations verified at ${esc(summary.fetchedAt)}</caption><thead><tr><th scope="col">Indicator</th><th scope="col">Saved value</th><th scope="col">Reference period</th></tr></thead><tbody>${summary.indicators.map((d) => `<tr><th scope="row">${esc(d.name)}</th><td>${d.value.toFixed(2)} ${esc(d.unit)}</td><td>${esc(d.date)}</td></tr>`).join("")}</tbody></table></div></details>`;
  }
}
