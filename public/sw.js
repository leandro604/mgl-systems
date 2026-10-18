/* MGL Systems service worker — static shell + Web Push. Never caches authenticated HTML, Auth/API or private JSON. */
const CACHE = 'mgl-shell-v10'
const SHELL = ['/manifest.webmanifest', '/offline.html', '/icons/mgl-192.png', '/icons/mgl-512.png', '/icons/mgl-maskable-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('mgl-shell-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/api')) return
  if (request.headers.get('accept')?.includes('application/json')) return

  // Authenticated HTML is always network-only. Offline navigation gets a generic static page.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy))
      return response
    })))
  }
})

self.addEventListener('sync', (event) => {
  if (event.tag !== 'mgl-outbox') return
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) client.postMessage({ type: 'MGL_SYNC_REQUEST' })
    }),
  )
})

function safeActionUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/notificaciones'
  try {
    const url = new URL(value, self.location.origin)
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/notificaciones'
  } catch {
    return '/notificaciones'
  }
}

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data?.text?.() || '' }
  }

  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'MGL Systems'
  const body = typeof payload.body === 'string' ? payload.body : 'Tienes una nueva notificación.'
  const actionUrl = safeActionUrl(payload.action_url)
  const notificationId = typeof payload.notification_id === 'string' ? payload.notification_id : undefined

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: notificationId ? `mgl-notification:${notificationId}` : undefined,
    renotify: false,
    data: { url: actionUrl, notificationId },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = safeActionUrl(event.notification?.data?.url)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ('navigate' in client) await client.navigate(target)
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
