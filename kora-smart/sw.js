/* كورة سمارت — offline shell. Bookings always come from the network;
   only the app's own files are cached so it opens fast and offline. */
const V = "kora-v1";
const CORE = ["./", "index.html", "app.js", "core.js", "store.js", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith("kora-") && k !== V).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return; // Supabase, fonts, CDN: straight to the network
  // Network first, so a new version arrives as soon as it is published.
  e.respondWith(fetch(r).then((res) => {
    if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r.mode === "navigate" ? "index.html" : r, cp)); }
    return res;
  }).catch(() => caches.match(r.mode === "navigate" ? "index.html" : r)));
});
