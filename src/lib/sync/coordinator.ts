import type { MglLocalDb } from '@/lib/db/dexie'
import type { VerifiedIdentity } from '@/types/domain'
import { useSyncStore } from '@/stores/sync-store'
import { runSyncCycle } from './engine'
import { withSyncLock } from './lock'
import type { SyncRemote } from './remote'

const PERIODIC_SYNC_MS = 60_000

export function startSyncCoordinator(input: {
  db: MglLocalDb
  remote: SyncRemote
  identity: VerifiedIdentity
}) {
  let stopped = false
  let running: Promise<void> | null = null
  let retryTimer: number | null = null

  const key = `${input.identity.companyId}:${input.identity.userId}`

  const scheduleOutboxWake = async () => {
    if (stopped) return
    const next = await input.db.outbox
      .orderBy('sequence')
      .filter((item) =>
        item.actorId === input.identity.userId &&
        (item.status === 'pending' || item.status === 'retry'),
      )
      .first()

    if (!next) {
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      retryTimer = null
      return
    }

    const delay = Math.max(100, Math.min(PERIODIC_SYNC_MS, next.nextAttemptAt - Date.now()))
    if (retryTimer !== null) window.clearTimeout(retryTimer)
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      void trigger()
    }, delay)
  }

  const trigger = () => {
    if (stopped || running) return running
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      useSyncStore.getState().setStatus('offline')
      return null
    }

    running = (async () => {
      const result = await withSyncLock(key, async () => {
        useSyncStore.getState().setStatus('syncing')
        const summary = await runSyncCycle(input.db, input.remote, input.identity)
        useSyncStore.getState().setSuccess(summary)
      })
      if (result === null && useSyncStore.getState().status === 'syncing') {
        useSyncStore.getState().setStatus('idle')
      }
      await scheduleOutboxWake()
    })()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Synchronization failed'
        useSyncStore.getState().setError(message)
        void scheduleOutboxWake()
      })
      .finally(() => { running = null })

    return running
  }

  const onOnline = () => void trigger()
  const onOffline = () => useSyncStore.getState().setStatus('offline')
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void trigger()
  }
  const onWorkerMessage = (event: MessageEvent) => {
    if (event.data?.type === 'MGL_SYNC_REQUEST') void trigger()
  }
  const onLocalMutation = () => void trigger()

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisibility)
  navigator.serviceWorker?.addEventListener('message', onWorkerMessage)
  window.addEventListener('mgl:sync-request', onLocalMutation)
  const timer = window.setInterval(() => void trigger(), PERIODIC_SYNC_MS)
  void trigger()

  return {
    trigger,
    stop() {
      stopped = true
      window.clearInterval(timer)
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisibility)
      navigator.serviceWorker?.removeEventListener('message', onWorkerMessage)
      window.removeEventListener('mgl:sync-request', onLocalMutation)
    },
  }
}
