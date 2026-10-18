import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { getLocalDb, closeLocalDb, destroyLocalDb } from '@/lib/db/dexie'
import type { BrowserSupabaseClient } from '@/lib/supabase/client'
import type { NotificationRow } from '@/features/notifications/types'
import { hydrateNotifications, toLocalNotification } from '@/features/notifications/repository'

const identity = { companyId: 'notification-hydration-company', userId: 'notification-hydration-user' }
const now = new Date().toISOString()
const row: NotificationRow = {
  id: 'notification-1', company_id: identity.companyId, recipient_id: identity.userId,
  project_id: null, actor_id: null, kind: 'task_assigned', title: 'Nueva tarea', body: 'Revisar instalación',
  entity_type: null, entity_id: null, action_url: '/app/tasks', metadata: {}, read_at: null,
  created_at: now, updated_at: now, server_updated_at: now, mutation_id: 'mutation-1', version: 1, deleted_at: null,
}

function clientWithPreferenceError(): BrowserSupabaseClient {
  const builder = {
    select() { return this }, eq() { return this }, is() { return this }, order() { return this },
    async limit() { return { data: [row], error: null } },
    async maybeSingle() { return { data: null, error: new Error('preferences unavailable') } },
  }
  return { from: () => builder } as unknown as BrowserSupabaseClient
}

afterEach(async () => {
  closeLocalDb()
  await destroyLocalDb(identity)
})

describe('notification hydration when preferences fail', () => {
  it('keeps successfully fetched notices visible while reporting the preference failure', async () => {
    const db = getLocalDb(identity)
    await expect(hydrateNotifications(clientWithPreferenceError(), db, identity.companyId, identity.userId)).rejects.toThrow('preferences unavailable')
    expect((await db.notifications.get(row.id))?.title).toBe('Nueva tarea')
  })

  it('preserves a pending local read instead of replacing it with the remote unread state', async () => {
    const db = getLocalDb(identity)
    await db.notifications.put({ ...toLocalNotification(row, true), read_at: now })
    await expect(hydrateNotifications(clientWithPreferenceError(), db, identity.companyId, identity.userId)).rejects.toThrow('preferences unavailable')
    expect((await db.notifications.get(row.id))?.read_at).toBe(now)
    expect((await db.notifications.get(row.id))?.pending_sync).toBe(true)
  })
})
