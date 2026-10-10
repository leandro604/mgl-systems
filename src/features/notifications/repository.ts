import type { BrowserSupabaseClient } from '@/lib/supabase/client'
import type { MglLocalDb } from '@/lib/db/dexie'
import type { LocalNotification, LocalUserPreference } from '@/lib/db/schema'
import type { NotificationPreferencesInput, NotificationRow, UserPreferenceRow } from './types'

const NOTIFICATION_LIMIT = 150

export function toLocalNotification(row: NotificationRow, pendingSync = false): LocalNotification {
  return {
    ...row,
    pending_sync: pendingSync,
    sync_error: null,
    local_updated_at: row.updated_at,
  }
}

export function toLocalPreference(row: UserPreferenceRow, pendingSync = false): LocalUserPreference {
  return {
    ...row,
    pending_sync: pendingSync,
    sync_error: null,
    local_updated_at: row.updated_at,
  }
}

export function defaultLocalPreference(companyId: string, userId: string): LocalUserPreference {
  const now = new Date().toISOString()
  return {
    id: `local:${companyId}:${userId}`,
    created_at: now,
    updated_at: now,
    server_updated_at: now,
    mutation_id: crypto.randomUUID(),
    version: 1,
    deleted_at: null,
    company_id: companyId,
    user_id: userId,
    in_app_enabled: true,
    email_enabled: true,
    push_enabled: false,
    quiet_hours_enabled: false,
    quiet_start: '22:00:00',
    quiet_end: '07:00:00',
    timezone: 'America/Lima',
    sidebar_collapsed: false,
    compact_mode: false,
    pending_sync: false,
    sync_error: null,
    local_updated_at: now,
  }
}


export async function fetchUnreadNotificationCount(
  client: BrowserSupabaseClient,
  companyId: string,
  userId: string,
): Promise<number> {
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('recipient_id', userId)
    .is('deleted_at', null)
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function hydrateNotifications(
  client: BrowserSupabaseClient,
  db: MglLocalDb,
  companyId: string,
  userId: string,
): Promise<void> {
  const [notifications, preferences] = await Promise.all([
    client
      .from('notifications')
      .select('*')
      .eq('company_id', companyId)
      .eq('recipient_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(NOTIFICATION_LIMIT),
    client
      .from('user_preferences')
      .select('*')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (notifications.error) throw notifications.error
  if (preferences.error) throw preferences.error

  await db.transaction('rw', db.notifications, db.userPreferences, async () => {
    const remoteRows = notifications.data ?? []
    const remoteIds = new Set(remoteRows.map((row) => row.id))

    for (const row of remoteRows) {
      const local = await db.notifications.get(row.id)
      if (local?.pending_sync) continue
      await db.notifications.put(toLocalNotification(row))
    }

    // Keep pending local reads. Remove only clean cached rows that fell outside
    // the latest server window and are old enough to be considered stale.
    const cached = await db.notifications.where('recipient_id').equals(userId).toArray()
    const stale = cached
      .filter((row) => !row.pending_sync && !remoteIds.has(row.id))
      .filter((row) => Date.now() - new Date(row.created_at).getTime() > 30 * 24 * 60 * 60_000)
      .map((row) => row.id)
    if (stale.length) await db.notifications.bulkDelete(stale)

    if (preferences.data) {
      const synthetic = `local:${companyId}:${userId}`
      await db.userPreferences.delete(synthetic)
      const local = await db.userPreferences.get(preferences.data.id)
      if (!local?.pending_sync) await db.userPreferences.put(toLocalPreference(preferences.data))
    }
  })
}

export async function mergeRealtimeNotification(db: MglLocalDb, row: NotificationRow): Promise<void> {
  const local = await db.notifications.get(row.id)
  if (local?.pending_sync) {
    // read_at is monotonic for the common case. Do not let a delayed Realtime
    // event revert an optimistic local read that is still waiting to sync.
    if (local.read_at && !row.read_at) return
  }
  await db.notifications.put(toLocalNotification(row))
}

export async function setNotificationRead(
  client: BrowserSupabaseClient,
  db: MglLocalDb,
  notificationId: string,
  read: boolean,
): Promise<void> {
  const local = await db.notifications.get(notificationId)
  if (!local) return
  const now = new Date().toISOString()
  const optimistic: LocalNotification = {
    ...local,
    read_at: read ? (local.read_at ?? now) : null,
    updated_at: now,
    mutation_id: crypto.randomUUID(),
    pending_sync: true,
    sync_error: null,
    local_updated_at: now,
  }
  await db.notifications.put(optimistic)

  try {
    const { data, error } = await client.rpc('set_notification_read', {
      p_notification_id: notificationId,
      p_read: read,
    })
    if (error) throw error
    if (data && typeof data === 'object' && !Array.isArray(data) && 'id' in data) {
      await db.notifications.put(toLocalNotification(data as unknown as NotificationRow))
    } else {
      await db.notifications.update(notificationId, { pending_sync: false, sync_error: null })
    }
  } catch (error) {
    await db.notifications.update(notificationId, {
      pending_sync: true,
      sync_error: error instanceof Error ? error.message : 'No se pudo sincronizar la lectura',
    })
  }
}

export async function markAllNotificationsRead(
  client: BrowserSupabaseClient,
  db: MglLocalDb,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const unread = (await db.notifications.where('recipient_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at && !row.read_at)

  await db.transaction('rw', db.notifications, async () => {
    for (const row of unread) {
      await db.notifications.put({
        ...row,
        read_at: now,
        updated_at: now,
        mutation_id: crypto.randomUUID(),
        pending_sync: true,
        sync_error: null,
        local_updated_at: now,
      })
    }
  })

  try {
    const { error } = await client.rpc('mark_all_notifications_read')
    if (error) throw error
    for (const row of unread) await db.notifications.update(row.id, { pending_sync: false, sync_error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar la lectura'
    for (const row of unread) await db.notifications.update(row.id, { pending_sync: true, sync_error: message })
  }
}

export async function flushPendingNotificationReads(
  client: BrowserSupabaseClient,
  db: MglLocalDb,
  userId: string,
): Promise<void> {
  const pending = (await db.notifications.where('recipient_id').equals(userId).toArray())
    .filter((row) => row.pending_sync && !row.deleted_at)
    .sort((a, b) => a.local_updated_at.localeCompare(b.local_updated_at))

  for (const row of pending) {
    const { data, error } = await client.rpc('set_notification_read', {
      p_notification_id: row.id,
      p_read: row.read_at !== null,
    })
    if (error) {
      await db.notifications.update(row.id, { sync_error: error.message })
      break
    }
    if (data && typeof data === 'object' && !Array.isArray(data) && 'id' in data) {
      await db.notifications.put(toLocalNotification(data as unknown as NotificationRow))
    } else {
      await db.notifications.update(row.id, { pending_sync: false, sync_error: null })
    }
  }
}

export async function saveNotificationPreferences(
  client: BrowserSupabaseClient,
  db: MglLocalDb,
  companyId: string,
  userId: string,
  input: NotificationPreferencesInput,
): Promise<boolean> {
  const current = await db.userPreferences.where('[company_id+user_id]').equals([companyId, userId]).first()
  const local = current ?? defaultLocalPreference(companyId, userId)
  const now = new Date().toISOString()
  const optimistic: LocalUserPreference = {
    ...local,
    email_enabled: input.emailEnabled,
    push_enabled: input.pushEnabled,
    quiet_hours_enabled: input.quietHoursEnabled,
    quiet_start: input.quietHoursEnabled ? input.quietStart : null,
    quiet_end: input.quietHoursEnabled ? input.quietEnd : null,
    timezone: input.timezone,
    updated_at: now,
    mutation_id: crypto.randomUUID(),
    pending_sync: true,
    sync_error: null,
    local_updated_at: now,
  }
  await db.userPreferences.put(optimistic)

  try {
    const { data, error } = await client.rpc('update_notification_preferences', {
      p_email_enabled: input.emailEnabled,
      p_push_enabled: input.pushEnabled,
      p_quiet_hours_enabled: input.quietHoursEnabled,
      p_quiet_start: input.quietHoursEnabled ? input.quietStart : null,
      p_quiet_end: input.quietHoursEnabled ? input.quietEnd : null,
      p_timezone: input.timezone,
    })
    if (error) throw error
    if (data && typeof data === 'object' && !Array.isArray(data) && 'id' in data) {
      if (optimistic.id.startsWith('local:')) await db.userPreferences.delete(optimistic.id)
      await db.userPreferences.put(toLocalPreference(data as unknown as UserPreferenceRow))
    }
    return true
  } catch (error) {
    await db.userPreferences.update(optimistic.id, {
      pending_sync: true,
      sync_error: error instanceof Error ? error.message : 'No se pudieron sincronizar las preferencias',
    })
    return false
  }
}

export async function flushPendingPreferences(
  client: BrowserSupabaseClient,
  db: MglLocalDb,
  companyId: string,
  userId: string,
): Promise<void> {
  const row = await db.userPreferences.where('[company_id+user_id]').equals([companyId, userId]).first()
  if (!row?.pending_sync) return
  await saveNotificationPreferences(client, db, companyId, userId, {
    emailEnabled: row.email_enabled,
    pushEnabled: row.push_enabled,
    quietHoursEnabled: row.quiet_hours_enabled,
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
    timezone: row.timezone,
  })
}
