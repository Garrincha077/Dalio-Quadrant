let registration = null,
  deferred = null,
  started = false;
export async function checkForPwaUpdate() {
  try {
    await registration?.update();
  } catch {
    /* Keep the working installed shell. */
  }
}
export function setupPwa() {
  if (started) return;
  started = true;
  const button = document.getElementById("installApp"),
    help = document.getElementById("installDialog");
  const installed = () => {
    button.textContent = "App installed";
    button.disabled = true;
  };
  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone
  )
    installed();
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    button.textContent = "Install app";
    button.disabled = false;
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed();
  });
  button.addEventListener("click", async () => {
    if (!deferred) {
      if (typeof help.showModal === "function") help.showModal();
      else help.setAttribute("open", "");
      return;
    }
    const prompt = deferred;
    deferred = null;
    button.disabled = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      if (typeof help.showModal === "function") help.showModal();
      else help.setAttribute("open", "");
    } finally {
      if (button.textContent !== "App installed") button.disabled = false;
    }
  });
  document.getElementById("closeInstall").addEventListener("click", () => {
    if (typeof help.close === "function") help.close();
    else help.removeAttribute("open");
  });
  const offline = document.getElementById("offlineConnection");
  const connection = () => {
    offline.hidden = navigator.onLine;
  };
  window.addEventListener("online", () => {
    connection();
    checkForPwaUpdate();
  });
  window.addEventListener("offline", connection);
  connection();
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  let wasControlled = Boolean(navigator.serviceWorker.controller),
    reloading = false,
    requestedUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if ((wasControlled || requestedUpdate) && !reloading) {
      reloading = true;
      window.location.reload();
    }
    wasControlled = true;
  });
  const ready = () => {
    document.getElementById("pwaUpdate").hidden = false;
  };
  document.getElementById("updateApp").addEventListener("click", () => {
    if (registration?.waiting) {
      requestedUpdate = true;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  });
  async function register() {
    try {
      registration = await navigator.serviceWorker.register("/sw.mjs", {
        type: "module",
        updateViaCache: "none",
      });
      if (registration.waiting) ready();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          )
            ready();
          if (worker.state === "redundant")
            document.getElementById("pwaAvailability").textContent =
              "Offline setup could not finish. Reconnect and reload to retry.";
        });
      });
    } catch {
      document.getElementById("pwaAvailability").textContent =
        "Offline setup is unavailable in this browser or on this address. The online dashboard still works.";
    }
  }
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
