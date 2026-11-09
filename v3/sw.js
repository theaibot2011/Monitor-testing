/* MonitorTest service worker (generated at build) */
const CACHE = 'monitortest-d8c3eae3f719';
const SHELL = ["./","./index.html","./assets/index-C079ATM-.js","./assets/index-DxoMCo_q.css"];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('monitortest-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Network first so updates arrive; fall back to the cached app shell offline.
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html', { ignoreSearch: true }).then((r) => r || caches.match('./')))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      // Only cache real files; never store the fallback HTML page under a script or style address.
      const type = res.headers.get('content-type') || '';
      if (res.ok && !type.includes('text/html')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
