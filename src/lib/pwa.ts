/** Registers the service worker (production only; never during `vite dev`). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      // Not fatal: the app simply works online-only.
      console.warn("service worker registration failed", e);
    });
  });
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches)
  );
}

/** iPhone/iPad Safari has no install prompt: the user must use Share > Add to Home Screen. */
export function isIosSafari(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
