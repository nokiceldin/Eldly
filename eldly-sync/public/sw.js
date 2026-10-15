const CACHE = "eldly-shell-v7-cloud-sync";
const SHELL = [
  "/",
  "/index.html",
  "/packly/icon.svg",
  "/icon.svg",
  "/eldly-logo.png",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // Cache Vite's hashed bundles on the first visit, before this worker controls the page.
      for (const entry of ["/index.html"]) {
        const document = await cache.match(entry);
        const html = await document.text();
        const assets = [...html.matchAll(/["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]);
        await cache.addAll([...new Set(assets)]);
      }
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (
          (await caches.match(request)) ||
          (request.mode === "navigate"
            ? await caches.match("/index.html")
            : Response.error())
        );
      }
    })(),
  );
});
