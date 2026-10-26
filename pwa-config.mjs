export const PWA_VERSION = "2.11.0";
export const CACHE_PREFIX = "dalio-shell-";
export const CACHE_NAME = CACHE_PREFIX + PWA_VERSION;
export const SHELL_PATHS = [
  "/",
  "/app.mjs",
  "/pwa.mjs",
  "/pwa-config.mjs",
  "/offline-summary.mjs",
  "/lib/pwa-cache.mjs",
  "/lib/model.mjs",
  "/lib/economic-state.mjs",
  "/lib/state-history.mjs",
  "/lib/statistics.mjs",
  "/lib/composite.mjs",
  "/lib/trail.mjs",
  "/lib/archive.mjs",
  "/lib/state-tilt.mjs",
  "/history-view.mjs",
  "/pressure-view.mjs",
  "/quadrant-view.mjs",
  "/assets-view.mjs",
  "/research-view.mjs",
  "/extended-research-view.mjs",
  "/state-view.mjs",
  "/state-chart.mjs",
  "/forward-view.mjs",
  "/state-tilt-view.mjs",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/data/history.json",
  "/data/research-summary.json",
  "/data/historical-audit.json",
  "/data/state-forward.json",
  "/data/extended-state.json",
  "/data/extended-long-state.json",
];
// CSV is cached only after a successful download; no live API response is cached.
export const OPTIONAL_PATHS = ["/data/state-forward.csv"];
// The shared archive changes daily without a new app release.
export const DYNAMIC_PATHS = ["/data/history.json"];
