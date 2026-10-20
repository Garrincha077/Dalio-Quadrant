import {
  PWA_VERSION,
  CACHE_NAME,
  CACHE_PREFIX,
  SHELL_PATHS,
  OPTIONAL_PATHS,
  DYNAMIC_PATHS,
} from "../pwa-config.mjs";

export function shellPath(request, origin) {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== origin) return null;
  if ([...url.searchParams.keys()].some((key) => key.startsWith("_vercel")))
    return null;
  if (url.pathname === "/" && request.mode === "navigate") return "/";
  return [...SHELL_PATHS, ...OPTIONAL_PATHS].includes(url.pathname)
    ? url.pathname
    : null;
}
export async function validShellResponse(response, path, origin) {
  if (!response.ok || response.redirected) return false;
  if (response.url && new URL(response.url).origin !== origin) return false;
  const type = (response.headers.get("Content-Type") || "")
    .split(";")[0]
    .trim();
  const expected =
    path === "/"
      ? ["text/html"]
      : path.endsWith(".mjs")
        ? ["text/javascript", "application/javascript"]
        : path.endsWith(".json")
          ? ["application/json"]
          : path.endsWith(".webmanifest")
            ? ["application/manifest+json", "application/json"]
            : path.endsWith(".png")
              ? ["image/png"]
              : path.endsWith(".svg")
                ? ["image/svg+xml"]
                : ["text/csv"];
  if (!expected.includes(type)) return false;
  if (path === "/")
    return (await response.clone().text()).includes(
      `data-app-shell="${PWA_VERSION}"`,
    );
  return true;
}
export async function installShell({ storage, request, origin }) {
  const cache = await storage.open(CACHE_NAME);
  // Wait for every task before removing a failed installation's partial cache.
  const outcomes = await Promise.allSettled(
    SHELL_PATHS.map(async (path) => {
      const url = new URL(path, origin).href;
      const response = await request(url, {
        cache: "reload",
        credentials: "same-origin",
      });
      if (!(await validShellResponse(response, path, origin)))
        throw new Error(`Invalid app resource: ${path}`);
      await cache.put(url, response);
    }),
  );
  if (outcomes.some((r) => r.status === "rejected")) {
    await storage.delete(CACHE_NAME);
    throw new Error(
      "Offline installation incomplete; the previous version is retained.",
    );
  }
}
export async function activateShell(storage) {
  const names = await storage.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => storage.delete(name)),
  );
}
export async function cachedShellResponse(
  request,
  { storage, request: network, origin },
) {
  const path = shellPath(request, origin);
  if (!path) return network(request);
  const key = new URL(path, origin).href;
  let cache, stored;
  try {
    cache = await storage.open(CACHE_NAME);
    stored = await cache.match(key);
  } catch {
    return network(request);
  }
  if (DYNAMIC_PATHS.includes(path)) {
    try {
      const response = await network(request);
      if (await validShellResponse(response, path, origin)) {
        try {
          await cache.put(key, response.clone());
        } catch {
          /* Keep online reads usable if storage is full. */
        }
        return response;
      }
      return stored || response;
    } catch (error) {
      if (stored) return stored;
      throw error;
    }
  }
  if (stored) return stored;
  const response = await network(request);
  if (await validShellResponse(response, path, origin)) {
    try {
      await cache.put(key, response.clone());
    } catch {
      /* A full cache must not break an online download. */
    }
  }
  return response;
}
