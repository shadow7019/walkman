// Walkman service worker — keeps installs fast, never caches audio/API.
const VERSION = 'walkman-v1'
const STATIC_CACHE = `${VERSION}-static`

// cache-first: fingerprinted Next.js assets + local covers/logos
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // never touch streaming, API or cross-origin traffic
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/covers/') ||
    url.pathname.startsWith('/audio/') ||
    ['/logo.png', '/logo.svg', '/logo-full.png', '/icon-192.png', '/icon-512.png', '/maskable-192.png', '/maskable-512.png', '/apple-touch-icon.png', '/manifest.webmanifest'].includes(url.pathname)

  if (!isStatic) return // app pages: always fresh from network

  // stale-while-revalidate for static assets
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone())
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
    ),
  )
})
