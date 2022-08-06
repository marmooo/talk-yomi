var CACHE_NAME = "2022-07-04 10:20";
var urlsToCache = [
  "/tegaki-yomi/",
  "/tegaki-yomi/index.js",
  "/tegaki-yomi/worker.js",
  "/tegaki-yomi/model/model.json",
  "/tegaki-yomi/model/group1-shard1of1.bin",
  "/tegaki-yomi/mp3/correct3.mp3",
  "/tegaki-yomi/mp3/end.mp3",
  "/tegaki-yomi/eraser.svg",
  "/tegaki-yomi/favicon/favicon.svg",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/signature_pad@4.0.7/dist/signature_pad.umd.min.js",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(urlsToCache);
      }),
  );
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request)
      .then(function (response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }),
  );
});

self.addEventListener("activate", function (event) {
  var cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
});
