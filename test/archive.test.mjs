import test from "node:test";
import assert from "node:assert/strict";
import { appendArchive } from "../lib/archive.mjs";
import { VERSION } from "../lib/model.mjs";
const sample = {
  version: VERSION,
  errors: [],
  signature: "macro-a",
  fetchedAt: "2026-10-15T20:00:00Z",
  growth: { score: 0.5 },
  inflation: { score: -0.3 },
  regime: { id: "goldilocks", name: "Goldilocks" },
  indicators: [
    { id: "gdp", series: "GDPC1", group: "growth" },
    { id: "vix", series: "VIXCLS", group: "market" },
  ],
};
test("unattended archive stores changed macro data, not repeated polls or provider prices", () => {
  const first = appendArchive([], sample),
    same = appendArchive(first, {
      ...sample,
      fetchedAt: "2026-10-16T20:00:00Z",
    });
  assert.equal(same, first);
  assert.equal(first[0].indicators.length, 1);
  assert.equal(
    first[0].indicators[0].source,
    "https://fred.stlouisfed.org/series/GDPC1",
  );
  const revised = appendArchive(first, { ...sample, signature: "macro-b" });
  assert.equal(revised.length, 2);
});
test("an upstream failure or insufficient coverage cannot be archived as valid", () => {
  assert.throws(() => appendArchive([], { ...sample, errors: ["GDPC1"] }));
  assert.throws(() =>
    appendArchive([], { ...sample, growth: { score: null } }),
  );
});
