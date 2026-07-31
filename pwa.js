(() => {
  "use strict";

  if (!("serviceWorker" in navigator)) return;

  let isRefreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isRefreshing) return;
    isRefreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
      await registration.update();
    } catch (error) {
      console.warn("PWA update check failed", error);
    }
  });
})();
