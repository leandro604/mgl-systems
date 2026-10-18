'use client'

import { liveQuery } from 'dexie'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLocalDb } from '@/lib/db/dexie'
import type { LocalNotification, LocalUserPreference } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/client'
import {
  defaultLocalPreference,
  fetchUnreadNotificationCount,
  flushPendingNotificationReads,
  flushPendingPreferences,
  hydrateNotifications,
  markAllNotificationsRead,
  mergeRealtimeNotification,
  saveNotificationPreferences,
  setNotificationRead,
} from './repository'
import type { NotificationPreferencesInput } from './types'
import { subscribeToNotificationRealtime } from './realtime-manager'

export type NotificationsState = {
  notifications: LocalNotification[]
  preferences: LocalUserPreference
  unreadCount: number
  online: boolean
  ready: boolean
  refreshing: boolean
  error: string | null
}

export function useNotifications(companyId: string, userId: string) {
  const [notifications, setNotifications] = useState<LocalNotification[]>([])
  const [preferences, setPreferences] = useState<LocalUserPreference>(() => defaultLocalPreference(companyId, userId))
  const [online, setOnline] = useState(true)
  const [ready, setReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverUnreadCount, setServerUnreadCount] = useState<number | null>(null)

  const client = useMemo(() => createClient(), [])
  const localUnreadCount = useMemo(
    () => notifications.filter((row) => !row.deleted_at && !row.read_at).length,
    [notifications],
  )
  const unreadCount = online && serverUnreadCount !== null ? serverUnreadCount : localUnreadCount

  const refreshUnreadCount = useCallback(async () => {
    if (!navigator.onLine) return
    try {
      setServerUnreadCount(await fetchUnreadNotificationCount(client, companyId, userId))
    } catch {
      // The local count remains the offline-safe fallback.
    }
  }, [client, companyId, userId])

  const refresh = useCallback(async () => {
    const db = getLocalDb({ companyId, userId })
    setRefreshing(true)
    try {
      await flushPendingNotificationReads(client, db, userId)
      await flushPendingPreferences(client, db, companyId, userId)
      await hydrateNotifications(client, db, companyId, userId)
      await refreshUnreadCount()
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron actualizar las notificaciones')
    } finally {
      setRefreshing(false)
    }
  }, [client, companyId, refreshUnreadCount, userId])

  useEffect(() => {
    let disposed = false
    let notificationsSubscription: { unsubscribe: () => void } | undefined
    let preferencesSubscription: { unsubscribe: () => void } | undefined
    let releaseRealtime: (() => void) | undefined

    const updateOnline = () => {
      const next = navigator.onLine
      setOnline(next)
      if (next) void refresh()
    }

    queueMicrotask(() => {
      if (disposed) return
      const db = getLocalDb({ companyId, userId })

      notificationsSubscription = liveQuery(async () => {
        const rows = await db.notifications.where('recipient_id').equals(userId).toArray()
        return rows
          .filter((row) => !row.deleted_at)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      }).subscribe({
        next: (rows) => {
          if (disposed) return
          setNotifications(rows)
          setReady(true)
        },
        error: () => {
          if (!disposed) {
            setReady(true)
            setError('No se pudo leer la lista local de notificaciones.')
          }
        },
      })

      preferencesSubscription = liveQuery(async () => {
        return db.userPreferences.where('[company_id+user_id]').equals([companyId, userId]).first()
      }).subscribe({
        next: (row) => {
          if (!disposed) setPreferences(row ?? defaultLocalPreference(companyId, userId))
        },
      })

      releaseRealtime = subscribeToNotificationRealtime({
        client,
        companyId,
        userId,
        onNotification: (row) => {
          if (disposed) return
          void mergeRealtimeNotification(db, row)
          void refreshUnreadCount()
        },
        onStatus: (status, cause) => {
          if (disposed) return
          if (status === 'SUBSCRIBED') {
            setError(null)
            return
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            const detail = cause instanceof Error ? `: ${cause.message}` : ''
            setError(`Realtime no disponible${detail}`)
          }
        },
      })

      if (navigator.onLine) void refresh()
      else setReady(true)
    })

    setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)

    return () => {
      disposed = true
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      notificationsSubscription?.unsubscribe()
      preferencesSubscription?.unsubscribe()
      releaseRealtime?.()
    }
  }, [client, companyId, refresh, refreshUnreadCount, userId])

  const setRead = useCallback(async (notificationId: string, read: boolean) => {
    const db = getLocalDb({ companyId, userId })
    await setNotificationRead(client, db, notificationId, read)
    await refreshUnreadCount()
  }, [client, companyId, refreshUnreadCount, userId])

  const markAllRead = useCallback(async () => {
    const db = getLocalDb({ companyId, userId })
    await markAllNotificationsRead(client, db, userId)
    await refreshUnreadCount()
  }, [client, companyId, refreshUnreadCount, userId])

  const savePreferences = useCallback(async (input: NotificationPreferencesInput) => {
    const db = getLocalDb({ companyId, userId })
    return saveNotificationPreferences(client, db, companyId, userId, input)
  }, [client, companyId, userId])

  return {
    notifications,
    preferences,
    unreadCount,
    online,
    ready,
    refreshing,
    error,
    refresh,
    setRead,
    markAllRead,
    savePreferences,
  }
}
