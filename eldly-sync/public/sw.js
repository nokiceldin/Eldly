const CACHE = "myspace-shell-v37-live-task-color-preview";
const SHELL = [
  "/audio/coin-pickup.wav",
  "/",
  "/index.html",
  "/packly/icon.svg",
  "/icon.svg",
  "/eldly-logo.png",
  "/eldly-logo-beige.png",
  "/eldinos-icon-180.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/apple-touch-icon-180x180.png",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
  "/eldinos-icon-192.png",
  "/eldinos-icon-512.png",
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
    new URL(request.url).pathname.startsWith("/api/") ||
    new URL(request.url).pathname.startsWith("/_vercel/insights/") ||
    new URL(request.url).pathname.startsWith("/myspace-soundtrack") ||
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

self.addEventListener('push',event=>{
 let payload;try{payload=event.data.json();}catch{return;}
 event.waitUntil(self.registration.showNotification(payload.title||'MySpace',{body:payload.body||'',icon:'/icon-192.png',badge:'/icon-192.png',tag:payload.tag,renotify:false,data:{url:'/?inbox=1'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const tab=tabs.find(client=>new URL(client.url).origin===self.location.origin);
  if(tab){await tab.focus();tab.postMessage({type:'myspace-open-inbox'});}else await self.clients.openWindow('/?inbox=1');
 })());
});

self.addEventListener('message',event=>{
 if(event.data?.type!=='myspace-shell-version'||!event.ports?.[0])return;
 event.waitUntil((async()=>{try{const cache=await caches.open(CACHE),document=await cache.match('/index.html');const html=await document?.text();const asset=html?.match(/<script\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];event.ports[0].postMessage({asset});}catch{event.ports[0].postMessage({asset:null});}})());
});
