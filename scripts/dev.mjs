// Dependency-free local adapter for the same Vercel API handlers.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dashboard from "../api/dashboard.js";
import bottoming from "../api/bottoming.js";
import fred from "../api/fred.js";
const root = fileURLToPath(new URL("../", import.meta.url)),
  port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const handler = { "/api/dashboard": dashboard, "/api/bottoming": bottoming, "/api/fred": fred }[
    url.pathname
  ];
  if (handler) {
    req.query = Object.fromEntries(url.searchParams);
    res.status = (n) => ((res.statusCode = n), res);
    res.json = (body) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
      return res;
    };
    try {
      await handler(req, res);
    } catch {
      res.status(500).json({ error: "Local handler error" });
    }
    return;
  }
  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  // Serve only the public browser entry points, never .env, scripts or API sources.
  if (
    ![
      "index.html",
      "app.mjs",
      "pwa.mjs",
      "pwa-config.mjs",
      "sw.mjs",
      "offline-summary.mjs",
      "lib/pwa-cache.mjs",
      "manifest.webmanifest",
      "icons/icon.svg",
      "icons/icon-192.png",
      "icons/icon-512.png",
      "icons/maskable-512.png",
      "icons/apple-touch-icon.png",
      "lib/model.mjs",
      "lib/economic-state.mjs",
      "lib/state-history.mjs",
      "lib/statistics.mjs",
      "lib/composite.mjs",
      "lib/trail.mjs",
      "lib/archive.mjs",
      "history-view.mjs",
      "pressure-view.mjs",
      "quadrant-view.mjs",
      "assets-view.mjs",
      "research-view.mjs",
      "evidence-view.mjs",
      "asset-scores-view.mjs",
      "research-lab-view.mjs",
      "bottoming-view.mjs",
      "lib/bottoming.mjs",
      "data/bottoming.json",
      "lib/research-lab.mjs",
      "lib/asset-scores.mjs",
      "lib/verified-readings.mjs",
      "lib/research-evidence.mjs",
      "state-view.mjs",
      "state-chart.mjs",
      "forward-view.mjs",
      "state-tilt-view.mjs",
      "lib/state-tilt.mjs",
      "data/history.json",
      "data/research-summary.json",
      "data/historical-audit.json",
      "data/state-forward.json",
      "data/state-forward.csv",
      "data/research-v2.json",
      "data/research-history.json",
      "data/evidence-audit.json",
      "data/forecast-ledger.json",
      "data/asset-scores.json",
      "data/research-lab.json",
      "data/last-verified.json",
    ].includes(file)
  ) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    res.setHeader("Content-Type", types[path.extname(file)]);
    if (["sw.mjs", "pwa-config.mjs", "manifest.webmanifest"].includes(file))
      res.setHeader("Cache-Control", "no-cache");
    res.end(await readFile(path.join(root, file)));
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  process.stdout.write(`Dashboard available at http://127.0.0.1:${port}\n`),
);
