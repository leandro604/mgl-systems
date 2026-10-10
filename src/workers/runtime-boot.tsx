'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDb } from '@/lib/db/dexie'
import { startSyncCoordinator } from '@/lib/sync/coordinator'
import { wakeRetryableOutbox } from '@/lib/sync/engine'
import { resolveVerifiedIdentity } from '@/lib/sync/identity'
import { SupabaseSyncRemote } from '@/lib/sync/remote'
import { registerServiceWorker } from './register'
import { processIntegrationJobs } from '@/features/invoices/offline'

export function RuntimeBoot() {
  useEffect(() => {
    const client = createClient()
    let stopCoordinator: (() => void) | null = null
    let coordinatorKey: string | null = null
    let disposed = false

    void registerServiceWorker()

    const boot = async () => {
      const identity = await resolveVerifiedIdentity(client)
      if (disposed || !identity) return

      const key = `${identity.companyId}:${identity.userId}`
      if (coordinatorKey === key && stopCoordinator) return

      stopCoordinator?.()
      stopCoordinator = null
      coordinatorKey = null

      // Keep the IndexedDB connection alive while mounted components may still
      // hold liveQuery subscriptions to it. getLocalDb isolates each user/company
      // with its own database name, so changing identity does not require closing
      // the previous instance synchronously.
      const db = getLocalDb(identity)
      await wakeRetryableOutbox(db, identity.userId)
      if (disposed) return

      const coordinator = startSyncCoordinator({
        db,
        identity,
        remote: new SupabaseSyncRemote(client),
      })
      const flushIntegrations = () => { void processIntegrationJobs(db, client, identity.userId) }
      flushIntegrations()
      window.addEventListener('online', flushIntegrations)
      const integrationTimer = window.setInterval(flushIntegrations, 60_000)
      coordinatorKey = key
      stopCoordinator = () => {
        coordinator.stop()
        window.removeEventListener('online', flushIntegrations)
        window.clearInterval(integrationTimer)
      }
    }

    void boot()
    const { data: authListener } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        stopCoordinator?.()
        stopCoordinator = null
        coordinatorKey = null
        return
      }
      queueMicrotask(() => void boot())
    })

    return () => {
      disposed = true
      authListener.subscription.unsubscribe()
      stopCoordinator?.()
      // Do not close IndexedDB here: child liveQuery cleanup can run after this
      // effect during route/HMR teardown. Closing first causes DatabaseClosedError.
    }
  }, [])

  return null
}
