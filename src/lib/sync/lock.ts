export class SyncBusyError extends Error {
  constructor() {
    super('Another MGL sync processor owns the lease')
    this.name = 'SyncBusyError'
  }
}

type NavigatorWithLocks = Navigator & {
  locks?: {
    request<T>(
      name: string,
      options: { mode: 'exclusive'; ifAvailable: true },
      callback: (lock: unknown | null) => Promise<T>,
    ): Promise<T>
  }
}

const LEASE_MS = 15_000
const HEARTBEAT_MS = 5_000

export async function withSyncLock<T>(key: string, work: () => Promise<T>): Promise<T | null> {
  const nav = globalThis.navigator as NavigatorWithLocks | undefined
  if (nav?.locks?.request) {
    return nav.locks.request(`mgl-sync:${key}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) return null
      return work()
    })
  }

  if (typeof localStorage === 'undefined') return work()

  const storageKey = `mgl-sync-lease:${key}`
  const token = crypto.randomUUID()
  const now = Date.now()
  const current = readLease(storageKey)
  if (current && current.expiresAt > now) return null

  writeLease(storageKey, { token, expiresAt: now + LEASE_MS })
  const acquired = readLease(storageKey)
  if (acquired?.token !== token) return null

  const heartbeat = setInterval(() => {
    const lease = readLease(storageKey)
    if (lease?.token === token) writeLease(storageKey, { token, expiresAt: Date.now() + LEASE_MS })
  }, HEARTBEAT_MS)

  try {
    return await work()
  } finally {
    clearInterval(heartbeat)
    const lease = readLease(storageKey)
    if (lease?.token === token) localStorage.removeItem(storageKey)
  }
}

type Lease = { token: string; expiresAt: number }

function readLease(key: string): Lease | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<Lease>
    return typeof value.token === 'string' && typeof value.expiresAt === 'number'
      ? { token: value.token, expiresAt: value.expiresAt }
      : null
  } catch {
    return null
  }
}

function writeLease(key: string, lease: Lease) {
  localStorage.setItem(key, JSON.stringify(lease))
}
