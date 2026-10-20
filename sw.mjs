import {
  installShell,
  activateShell,
  cachedShellResponse,
  shellPath,
} from "./lib/pwa-cache.mjs";
const dependencies = {
  storage: caches,
  request: fetch.bind(self),
  origin: self.location.origin,
};
self.addEventListener("install", (event) =>
  event.waitUntil(installShell(dependencies)),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(activateShell(caches).then(() => self.clients.claim())),
);
self.addEventListener("fetch", (event) => {
  // API/auth/third-party requests always go directly to the network.
  if (shellPath(event.request, self.location.origin))
    event.respondWith(cachedShellResponse(event.request, dependencies));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});
