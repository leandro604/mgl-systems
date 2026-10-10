'use client'

import type { BrowserSupabaseClient } from '@/lib/supabase/client'
import type { NotificationRow } from './types'

type NotificationHandler = (row: NotificationRow) => void
type StatusHandler = (status: string, error?: unknown) => void

type RealtimeChannel = ReturnType<BrowserSupabaseClient['channel']>

type RegistryEntry = {
  client: BrowserSupabaseClient
  channel: RealtimeChannel
  handlers: Set<NotificationHandler>
  statusHandlers: Set<StatusHandler>
  cleanupTimer: ReturnType<typeof setTimeout> | null
  lastStatus: string | null
  lastError: unknown
}

type RealtimeGlobal = typeof globalThis & {
  __mglNotificationRealtimeRegistry?: Map<string, RegistryEntry>
}

const realtimeGlobal = globalThis as RealtimeGlobal
const registry = realtimeGlobal.__mglNotificationRealtimeRegistry
  ?? (realtimeGlobal.__mglNotificationRealtimeRegistry = new Map<string, RegistryEntry>())

function isNotificationRow(value: unknown): value is NotificationRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string'
    && typeof row.company_id === 'string'
    && typeof row.recipient_id === 'string'
    && typeof row.title === 'string'
    && typeof row.created_at === 'string'
}

function registryKey(companyId: string, userId: string) {
  return `${companyId}:${userId}`
}

/**
 * Shares exactly one Supabase Realtime channel per company/user across every
 * mounted notification surface (header bell, drawer, /notificaciones, etc.).
 *
 * The postgres_changes callback is attached exactly once, before subscribe().
 * Consumers are multiplexed through an in-memory handler set. A short delayed
 * cleanup absorbs React 19 development remounts without racing removeChannel().
 */
export function subscribeToNotificationRealtime(input: {
  client: BrowserSupabaseClient
  companyId: string
  userId: string
  onNotification: NotificationHandler
  onStatus?: StatusHandler
}) {
  const { client, companyId, userId, onNotification, onStatus } = input
  const key = registryKey(companyId, userId)
  let entry = registry.get(key)

  if (!entry) {
    const handlers = new Set<NotificationHandler>()
    const statusHandlers = new Set<StatusHandler>()
    const topic = `mgl-notifications:${companyId}:${userId}:shared:${crypto.randomUUID()}`
    const channel = client.channel(topic)

    entry = {
      client,
      channel,
      handlers,
      statusHandlers,
      cleanupTimer: null,
      lastStatus: null,
      lastError: undefined,
    }
    registry.set(key, entry)

    // IMPORTANT: all .on(...) callbacks are registered before subscribe().
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new
        if (!isNotificationRow(row)) return
        for (const handler of handlers) handler(row)
      },
    )

    channel.subscribe((status, error) => {
      const current = registry.get(key)
      if (!current || current.channel !== channel) return
      current.lastStatus = status
      current.lastError = error
      for (const handler of current.statusHandlers) handler(status, error)
    })
  }

  if (entry.cleanupTimer) {
    clearTimeout(entry.cleanupTimer)
    entry.cleanupTimer = null
  }

  entry.handlers.add(onNotification)
  if (onStatus) {
    entry.statusHandlers.add(onStatus)
    if (entry.lastStatus) {
      const status = entry.lastStatus
      const error = entry.lastError
      queueMicrotask(() => onStatus(status, error))
    }
  }

  let released = false
  return () => {
    if (released) return
    released = true

    const current = registry.get(key)
    if (!current) return
    current.handlers.delete(onNotification)
    if (onStatus) current.statusHandlers.delete(onStatus)

    if (current.handlers.size > 0 || current.cleanupTimer) return

    current.cleanupTimer = setTimeout(() => {
      const latest = registry.get(key)
      if (!latest || latest !== current || latest.handlers.size > 0) return

      registry.delete(key)
      void latest.client.removeChannel(latest.channel)
    }, 1_500)
  }
}
