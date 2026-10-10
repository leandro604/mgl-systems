'use client'

import { createClient } from '@/lib/supabase/client'
import { getLocalDb } from '@/lib/db/dexie'
import { resolveVerifiedIdentity } from '@/lib/sync/identity'
import { runSyncCycle, wakeRetryableOutbox, type SyncCycleSummary } from '@/lib/sync/engine'
import { withSyncLock } from '@/lib/sync/lock'
import { SupabaseSyncRemote } from '@/lib/sync/remote'
import { useSyncStore } from '@/stores/sync-store'

export type OperationalRuntime = Awaited<ReturnType<typeof resolveOperationalRuntime>>

export async function resolveOperationalRuntime() {
  const client = createClient()
  const identity = await resolveVerifiedIdentity(client)
  if (!identity) throw new Error('No se pudo resolver la identidad autenticada.')
  return { client, identity, db: getLocalDb(identity) }
}


const IMMEDIATE_SYNC_WAIT_MS = 12_000
const IMMEDIATE_SYNC_POLL_MS = 200

export async function syncOperationalRuntimeNow(
  runtime?: OperationalRuntime,
): Promise<SyncCycleSummary> {
  const resolved = runtime ?? await resolveOperationalRuntime()
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    useSyncStore.getState().setStatus('offline')
    throw new Error('Sin conexión. El cambio quedó guardado localmente.')
  }

  const key = `${resolved.identity.companyId}:${resolved.identity.userId}`
  const deadline = Date.now() + IMMEDIATE_SYNC_WAIT_MS

  for (;;) {
    const result = await withSyncLock(key, async () => {
      useSyncStore.getState().setStatus('syncing')
      try {
        await wakeRetryableOutbox(resolved.db, resolved.identity.userId)
        const summary = await runSyncCycle(
          resolved.db,
          new SupabaseSyncRemote(resolved.client),
          resolved.identity,
        )
        useSyncStore.getState().setSuccess(summary)
        return summary
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Synchronization failed'
        useSyncStore.getState().setError(message)
        throw error
      }
    })

    if (result !== null) return result
    if (Date.now() >= deadline) {
      throw new Error('El sincronizador está ocupado demasiado tiempo. Usa Reintentar para volver a enviar la cola.')
    }
    await new Promise((resolve) => window.setTimeout(resolve, IMMEDIATE_SYNC_POLL_MS))
  }
}
