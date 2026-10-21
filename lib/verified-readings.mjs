import { isCompatibleSnapshot } from "./model.mjs";
const validDate = (s) => typeof s === "string" && Number.isFinite(Date.parse(s));
const axis = (d) => d?.status === "ok" && Number.isFinite(d.value) && validDate(d.date)
  ? {name: d.name, value: d.value, date: d.date, unit: d.unit, status: d.status}
  : null;

// Explicit read-only fallback. It must never be passed off as a fresh snapshot,
// added to today's observations or fed into a current asset recommendation.
export function verifiedReadings(snapshot, now = new Date()) {
  if (!isCompatibleSnapshot(snapshot) || !validDate(snapshot?.fetchedAt) ||
      Date.parse(snapshot.fetchedAt) > +now + 300000 || snapshot.errors?.length ||
      !snapshot.economicState?.available || !Number.isFinite(snapshot.growth?.score) ||
      !Number.isFinite(snapshot.inflation?.score)) return null;
  const activity = axis(snapshot.economicState.activity), inflation = axis(snapshot.economicState.inflation);
  if (!activity || !inflation || !snapshot.indicators?.length ||
      [activity, inflation].some((d) => Date.parse(d.date) > Date.parse(snapshot.fetchedAt))) return null;
  const record = {
    schema: "verified-readings-1", version: snapshot.version, modelVersion: snapshot.modelVersion,
    fetchedAt: snapshot.fetchedAt, activity, inflation,
    growthMomentum: snapshot.growth.score, inflationMomentum: snapshot.inflation.score,
    indicators: snapshot.indicators.filter((d) => d.status === "ok" && Number.isFinite(d.value) && validDate(d.date)).map((d) => ({
      id: d.id, name: d.name, group: d.group, series: d.series, date: d.date,
      value: d.value, unit: d.unit, delta: Number.isFinite(d.delta) ? d.delta : null,
    })),
  };
  return validVerifiedReadings(record, now) ? record : null;
}

export function validVerifiedReadings(record, now = new Date()) {
  return record?.schema === "verified-readings-1" && isCompatibleSnapshot(record) &&
    validDate(record.fetchedAt) && Date.parse(record.fetchedAt) <= +now + 300000 &&
    [record.growthMomentum, record.inflationMomentum].every(Number.isFinite) &&
    [record.activity, record.inflation].every((d) => d && Number.isFinite(d.value) && validDate(d.date) && Date.parse(d.date) <= Date.parse(record.fetchedAt)) &&
    Array.isArray(record.indicators) && record.indicators.length > 0 &&
    record.indicators.every((d) => Number.isFinite(d.value) && validDate(d.date) && Date.parse(d.date) <= Date.parse(record.fetchedAt));
}
