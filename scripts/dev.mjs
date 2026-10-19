// Dependency-free local adapter for the same Vercel API handlers.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dashboard from "../api/dashboard.js";
import fred from "../api/fred.js";
const root = fileURLToPath(new URL("../", import.meta.url)),
  port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};
createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const handler = { "/api/dashboard": dashboard, "/api/fred": fred }[
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
      "lib/model.mjs",
      "lib/statistics.mjs",
      "lib/composite.mjs",
      "lib/trail.mjs",
      "lib/archive.mjs",
      "history-view.mjs",
      "pressure-view.mjs",
      "quadrant-view.mjs",
      "assets-view.mjs",
      "research-view.mjs",
      "data/history.json",
      "data/research-summary.json",
      "data/historical-audit.json",
    ].includes(file)
  ) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    res.setHeader("Content-Type", types[path.extname(file)]);
    res.end(await readFile(path.join(root, file)));
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  process.stdout.write(`Dashboard available at http://127.0.0.1:${port}\n`),
);
