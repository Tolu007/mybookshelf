const BOOK_CACHE = "shelf-books-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache-first for book file bytes: once you've opened a book while online,
// it keeps working offline. Book files never change after upload, so
// caching indefinitely is safe — there's no edit/replace flow to go stale.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isBookFile = /^\/api\/books\/[^/]+\/file$/.test(url.pathname);
  if (!isBookFile || event.request.method !== "GET") return;

  event.respondWith(
    caches.open(BOOK_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
  );
});
