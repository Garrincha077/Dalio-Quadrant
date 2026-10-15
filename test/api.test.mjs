import test from "node:test";
import assert from "node:assert/strict";
import dashboard from "../api/dashboard.js";
import fred from "../api/fred.js";
import { SERIES } from "../lib/model.mjs";
function response() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.code = n;
      return this;
    },
    json(v) {
      this.body = v;
      return this;
    },
  };
}
test("a browser-supplied key cannot substitute for a server credential", async () => {
  const saved = process.env.FRED_API_KEY;
  delete process.env.FRED_API_KEY;
  try {
    const res = response();
    await fred(
      {
        method: "GET",
        query: { series_id: "GDPC1", api_key: "browser-value" },
      },
      res,
    );
    assert.equal(res.code, 503);
    assert.ok(!JSON.stringify(res.body).includes("browser-value"));
  } finally {
    if (saved !== undefined) process.env.FRED_API_KEY = saved;
  }
});
test("dashboard returns a visible configuration error rather than sample data", async () => {
  const saved = process.env.FRED_API_KEY;
  delete process.env.FRED_API_KEY;
  try {
    const res = response();
    await dashboard({ method: "GET" }, res);
    assert.equal(res.code, 503);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.body.regime, undefined);
  } finally {
    if (saved !== undefined) process.env.FRED_API_KEY = saved;
  }
});
test("source failures cannot cache a successful-looking default regime or leak the key", async () => {
  const saved = process.env.FRED_API_KEY,
    fetchSaved = globalThis.fetch;
  process.env.FRED_API_KEY = "test-only-key";
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  try {
    const res = response();
    await dashboard({ method: "GET" }, res);
    assert.equal(res.code, 200);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(res.body.errors.length, SERIES.length);
    assert.equal(res.body.regime.id, "unavailable");
    assert.ok(!JSON.stringify(res.body).includes("test-only-key"));
  } finally {
    globalThis.fetch = fetchSaved;
    if (saved !== undefined) process.env.FRED_API_KEY = saved;
    else delete process.env.FRED_API_KEY;
  }
});
test("arbitrary series and unsupported methods are rejected", async () => {
  const saved = process.env.FRED_API_KEY;
  process.env.FRED_API_KEY = "test-only-key";
  try {
    const res = response();
    await fred({ method: "GET", query: { series_id: "UNSUPPORTED" } }, res);
    assert.equal(res.code, 400);
    const post = response();
    await dashboard({ method: "POST" }, post);
    assert.equal(post.code, 405);
  } finally {
    if (saved !== undefined) process.env.FRED_API_KEY = saved;
    else delete process.env.FRED_API_KEY;
  }
});
