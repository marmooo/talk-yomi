const CACHE_NAME = "2025-06-09 08:00";
const urlsToCache = [
  "/talk-yomi/",
  "/talk-yomi/index.js",
  "/talk-yomi/mp3/correct3.mp3",
  "/talk-yomi/mp3/incorrect1.mp3",
  "/talk-yomi/mp3/end.mp3",
  "/talk-yomi/favicon/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
    }),
  );
});
