async function clearDevelopmentServiceWorkers(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('mgl-shell-')).map((key) => caches.delete(key)))
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  // Next.js development chunks use stable-looking URLs. Caching them can hydrate
  // a new server render with JavaScript from a previous build/phase.
  if (process.env.NODE_ENV !== 'production') {
    try {
      await clearDevelopmentServiceWorkers()
    } catch {
      // Dev cleanup is best-effort; normal online sync remains available.
    }
    return null
  }

  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    return null
  }
}

export async function requestBackgroundSync() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (process.env.NODE_ENV !== 'production') return

  const registration = await navigator.serviceWorker.ready
  if (!registration) return
  const syncRegistration = registration as ServiceWorkerRegistration & {
    sync?: { register(tag: string): Promise<void> }
  }
  try {
    await syncRegistration.sync?.register('mgl-outbox')
  } catch {
    // Background Sync is progressive enhancement only; online/visibility listeners remain the fallback.
  }
}
