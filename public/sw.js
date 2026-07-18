// ============================================================
// SERVICE WORKER — makes QuestCal work offline once installed.
//
// Strategy:
//  - Page loads (navigations): try the network first (so you get
//    updates), fall back to the cached copy when offline.
//  - Everything else (JS, CSS, fonts): serve from cache if we have
//    it, otherwise fetch and remember it for next time.
// Bump the cache name when you want to force a fresh start.
// ============================================================
const CACHE = 'questcal-v2'

// Never cache live API traffic — cloud saves and AI replies must always
// hit the network, or you'd sync against stale data.
const NEVER_CACHE = ['api.github.com', 'api.anthropic.com']

self.addEventListener('install', () => {
  self.skipWaiting() // activate the new worker immediately
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (NEVER_CACHE.includes(new URL(req.url).hostname)) return

  // Navigations: network first, cache fallback (offline support)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req)),
    )
    return
  }

  // Assets: cache first, then network (and remember the result)
  event.respondWith(
    caches.match(req).then(hit =>
      hit ||
      fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy))
        }
        return res
      }),
    ),
  )
})
