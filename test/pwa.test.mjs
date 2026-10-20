import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PWA_VERSION,
  CACHE_NAME,
  CACHE_PREFIX,
  SHELL_PATHS,
} from "../pwa-config.mjs";
import { VERSION } from "../lib/model.mjs";
import {
  shellPath,
  validShellResponse,
  installShell,
  activateShell,
  cachedShellResponse,
} from "../lib/pwa-cache.mjs";
import {
  OFFLINE_KEY,
  saveOfflineSummary,
  readOfflineSummary,
} from "../offline-summary.mjs";

const origin = "https://example.test";
function storage() {
  const maps = new Map();
  return {
    maps,
    async open(name) {
      if (!maps.has(name)) maps.set(name, new Map());
      const map = maps.get(name);
      return {
        async put(key, response) {
          map.set(key, response.clone());
        },
        async match(key) {
          return map.get(key)?.clone();
        },
      };
    },
    async keys() {
      return [...maps.keys()];
    },
    async delete(name) {
      return maps.delete(name);
    },
  };
}
function response(path) {
  const type =
    path === "/"
      ? "text/html"
      : path.endsWith(".mjs")
        ? "text/javascript"
        : path.endsWith(".json")
          ? "application/json"
          : path.endsWith(".webmanifest")
            ? "application/manifest+json"
            : path.endsWith(".png")
              ? "image/png"
              : path.endsWith(".svg")
                ? "image/svg+xml"
                : "text/csv";
  return new Response(
    path === "/" ? `<html data-app-shell="${PWA_VERSION}">` : "resource",
    { headers: { "Content-Type": type } },
  );
}
const request = (path, method = "GET", mode = "navigate") => ({
  url: origin + path,
  method,
  mode,
});
test("manifest identity, release and real PNG icons satisfy install metadata", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest"));
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(PWA_VERSION, VERSION);
  const html = fs.readFileSync("index.html", "utf8");
  assert.ok(html.includes(`data-app-shell="${PWA_VERSION}"`));
  assert.match(html, /rel="manifest"/);
  assert.ok(!JSON.stringify(manifest).includes("_vercel_share"));
  for (const icon of manifest.icons) {
    const bytes = fs.readFileSync("." + icon.src),
      [width, height] = icon.sizes.split("x").map(Number);
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }
  assert.ok(manifest.icons.some((i) => i.sizes === "192x192"));
  assert.ok(
    manifest.icons.some(
      (i) => i.sizes === "512x512" && i.purpose === "maskable",
    ),
  );
});
test("precache includes all transitive browser module dependencies", () => {
  for (const path of SHELL_PATHS)
    assert.ok(fs.existsSync(path === "/" ? "index.html" : "." + path), path);
  const visited = new Set();
  function walk(path) {
    if (visited.has(path)) return;
    visited.add(path);
    const code = fs.readFileSync("." + path, "utf8");
    for (const match of code.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const dep = new URL(match[1], origin + path).pathname;
      assert.ok(SHELL_PATHS.includes(dep), `Missing offline dependency ${dep}`);
      walk(dep);
    }
  }
  walk("/app.mjs");
  walk("/sw.mjs");
});
test("API, auth, share-token, POST and external requests bypass the offline cache", () => {
  for (const path of [
    "/api/dashboard?v=2.10.0",
    "/api/fred?series=PCEPI",
    "/_vercel/sso",
    "/?_vercel_share=temporary",
  ])
    assert.equal(shellPath(request(path), origin), null);
  assert.equal(shellPath(request("/", "POST"), origin), null);
  assert.equal(
    shellPath({ ...request("/"), url: "https://elsewhere.test/" }, origin),
    null,
  );
});
test("a complete shell installs and serves navigation offline without a network request", async () => {
  const cache = storage();
  let calls = 0;
  await installShell({
    storage: cache,
    origin,
    request: async (url) => {
      calls++;
      return response(new URL(url).pathname);
    },
  });
  assert.equal(calls, SHELL_PATHS.length);
  const page = await cachedShellResponse(request("/?source=pwa"), {
    storage: cache,
    origin,
    request: async () => {
      throw new Error("offline");
    },
  });
  assert.match(await page.text(), /data-app-shell/);
  const script = await cachedShellResponse(request("/app.mjs"), {
    storage: cache,
    origin,
    request: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(await script.text(), "resource");
});
test("failed authenticated or mismatched shell installs remove partial new cache and preserve the previous version", async () => {
  const cache = storage();
  await cache.open(CACHE_PREFIX + "previous");
  await cache.open("other-app");
  await assert.rejects(
    installShell({
      storage: cache,
      origin,
      request: async (url) =>
        new URL(url).pathname === "/app.mjs"
          ? new Response("Sign in", {
              headers: { "Content-Type": "text/html" },
            })
          : response(new URL(url).pathname),
    }),
  );
  assert.equal(cache.maps.has(CACHE_NAME), false);
  assert.equal(cache.maps.has(CACHE_PREFIX + "previous"), true);
  assert.equal(cache.maps.has("other-app"), true);
  assert.equal(
    await validShellResponse(
      new Response('<html data-app-shell="old">', {
        headers: { "Content-Type": "text/html" },
      }),
      "/",
      origin,
    ),
    false,
  );
  assert.equal(
    await validShellResponse(
      new Response("denied", {
        status: 403,
        headers: { "Content-Type": "text/javascript" },
      }),
      "/app.mjs",
      origin,
    ),
    false,
  );
});
test("activation deletes only previous caches owned by this app", async () => {
  const cache = storage();
  for (const name of [CACHE_NAME, CACHE_PREFIX + "previous", "other-app"])
    await cache.open(name);
  await activateShell(cache);
  assert.deepEqual(
    (await cache.keys()).sort(),
    [CACHE_NAME, "other-app"].sort(),
  );
});
test("the daily shared archive refreshes online and keeps a dated offline fallback", async () => {
  const cache = storage();
  await installShell({
    storage: cache,
    origin,
    request: async (url) => response(new URL(url).pathname),
  });
  const options = {
    storage: cache,
    origin,
    request: async () =>
      new Response('{"updated":"new"}', {
        headers: { "Content-Type": "application/json" },
      }),
  };
  const fresh = await cachedShellResponse(
    request("/data/history.json"),
    options,
  );
  assert.equal(await fresh.text(), '{"updated":"new"}');
  const saved = await cachedShellResponse(request("/data/history.json"), {
    ...options,
    request: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(await saved.text(), '{"updated":"new"}');
});
test("live API never falls back to a cached response and CSV caching failure does not break the download", async () => {
  const cache = storage(),
    api = request("/api/dashboard");
  const opened = await cache.open(CACHE_NAME);
  await opened.put(api.url, new Response("stale"));
  await assert.rejects(
    cachedShellResponse(api, {
      storage: cache,
      origin,
      request: async () => {
        throw new Error("offline");
      },
    }),
  );
  const unavailable = {
    async open() {
      throw new Error("storage denied");
    },
  };
  const download = await cachedShellResponse(
    request("/data/state-forward.csv"),
    {
      storage: unavailable,
      origin,
      request: async () => response("/data/state-forward.csv"),
    },
  );
  assert.equal(download.status, 200);
});
function local() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    values,
  };
}
function snapshot() {
  return {
    version: VERSION,
    fetchedAt: "2026-10-20T12:00:00Z",
    errors: [],
    secret: "never store this",
    economicState: {
      available: true,
      activity: { status: "ok", value: 0.01, date: "2026-08-01" },
      inflation: { status: "ok", value: 3.42, date: "2026-08-01" },
    },
  };
}
test("offline storage preserves only a compact dated summary and cannot overwrite it with invalid inputs", () => {
  const store = local(),
    s = snapshot();
  assert.equal(saveOfflineSummary(s, store), true);
  const saved = readOfflineSummary(store, new Date("2026-10-20T13:00:00Z"));
  assert.equal(saved.activity.value, 0.01);
  assert.equal(saved.fetchedAt, s.fetchedAt);
  assert.ok(!store.getItem(OFFLINE_KEY).includes("never store this"));
  const old = store.getItem(OFFLINE_KEY);
  s.errors = ["PCEPI"];
  assert.equal(saveOfflineSummary(s, store), false);
  assert.equal(store.getItem(OFFLINE_KEY), old);
  s.errors = [];
  s.economicState.activity.status = "stale";
  assert.equal(saveOfflineSummary(s, store), false);
});
test("corrupt, future and unavailable storage is handled without inventing data", () => {
  const store = local();
  store.setItem(OFFLINE_KEY, "not JSON");
  assert.equal(readOfflineSummary(store), null);
  saveOfflineSummary(snapshot(), store);
  assert.equal(readOfflineSummary(store, new Date("2020-01-01")), null);
  const broken = {
    setItem() {
      throw new Error("quota");
    },
    getItem() {
      throw new Error("denied");
    },
  };
  assert.equal(saveOfflineSummary(snapshot(), broken), false);
  assert.equal(readOfflineSummary(broken), null);
});
