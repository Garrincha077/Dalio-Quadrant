import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MODEL_VERSION } from "../lib/model.mjs";
import { verifiedReadings, validVerifiedReadings } from "../lib/verified-readings.mjs";
const now = new Date("2026-10-21T17:00:00Z");
function snapshot() {
  return {version: "2.11.0", modelVersion: MODEL_VERSION, fetchedAt: "2026-10-21T12:04:27.983Z",
    errors: [], growth: {score: .2}, inflation: {score: -.1},
    economicState: {available: true, activity: {name: "Activity", status: "ok", value: .1, date: "2026-08-01"},
      inflation: {name: "PCE", status: "ok", value: 3.2, date: "2026-08-01"}},
    indicators: [{id: "pce", name: "PCE", series: "PCEPI", status: "ok", value: 3.2, date: "2026-08-01", unit: "%"}],
    secret: "must-not-publish", raw: {api_key: "must-not-publish"}};
}
test("published fallback preserves the actual successful fetch timestamp and excludes unknown fields", () => {
  const saved = verifiedReadings(snapshot(), now);
  assert.equal(saved.fetchedAt, snapshot().fetchedAt);
  assert.equal(saved.version, "2.11.0");
  assert.equal(saved.activity.value, .1);
  assert.equal(saved.growthMomentum, .2);
  assert.equal(validVerifiedReadings(saved, now), true);
  assert.ok(!JSON.stringify(saved).includes("must-not-publish"));
});
test("failed, future or incomplete refreshes cannot replace verified fallback data", () => {
  const s = snapshot();
  s.errors = ["PCEPI"]; assert.equal(verifiedReadings(s, now), null);
  s.errors = []; s.economicState.available = false; assert.equal(verifiedReadings(s, now), null);
  s.economicState.available = true; s.fetchedAt = "2026-10-22T12:00:00Z"; assert.equal(verifiedReadings(s, now), null);
  s.fetchedAt = snapshot().fetchedAt; s.economicState.activity.date = "2026-11-01";
  assert.equal(verifiedReadings(s, now), null);
});
test("fallback validation rejects malformed indicator dates, absent momenta and future readings", () => {
  const record = verifiedReadings(snapshot(), now);
  delete record.growthMomentum; assert.equal(validVerifiedReadings(record, now), false);
  record.growthMomentum = .2; record.indicators[0].date = "2027-01-01";
  assert.equal(validVerifiedReadings(record, now), false);
});
test("shipped last-verified file is a dated read-only snapshot, not a fabricated current refresh", async () => {
  const record = JSON.parse(await readFile(new URL("../data/last-verified.json", import.meta.url)));
  assert.equal(validVerifiedReadings(record), true);
  assert.ok(record.indicators.length > 0);
  assert.ok(Date.parse(record.fetchedAt) <= Date.now() + 300000);
  if (record.sourceSha256) assert.match(record.sourceSha256, /^[a-f0-9]{64}$/);
});
