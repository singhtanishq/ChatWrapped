/**
 * Registers the service worker for offline support. Import once from the
 * app page; a no-op where service workers are unavailable.
 */

export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!/^https?:$/.test(window.location.protocol)) return; // skip on file://
  const base = import.meta.env.BASE_URL || "/";
  const swUrl = new URL(
    "sw.js",
    `${window.location.origin}${base.endsWith("/") ? base : `${base}/`}`,
  ).toString();
  // Astro hydrates after the load event has already fired, so register
  // immediately when the document is complete; otherwise wait for load.
  if (document.readyState === "complete") {
    void navigator.serviceWorker.register(swUrl).catch(() => undefined);
  } else {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register(swUrl).catch(() => undefined);
    });
  }
}
