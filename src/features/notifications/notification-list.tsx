'use client'

import { Bell, WifiOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { LocalNotification } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { formatNotificationTime, notificationActionUrl } from './notification-utils'

export function NotificationList({
  rows,
  onSetRead,
  emptyMessage = 'Sin notificaciones',
  compact = false,
  onOpen,
}: {
  rows: LocalNotification[]
  onSetRead: (id: string, read: boolean) => Promise<void>
  emptyMessage?: string
  compact?: boolean
  onOpen?: () => void
}) {
  const router = useRouter()

  if (!rows.length) {
    return <div className="px-6 py-10 text-center"><Bell className="mx-auto size-6 text-slate-300" /><p className="mt-3 text-sm text-slate-500">{emptyMessage}</p></div>
  }

  async function open(row: LocalNotification) {
    if (!row.read_at) await onSetRead(row.id, true)
    const href = notificationActionUrl(row)
    if (href) {
      router.push(href)
      onOpen?.()
    }
  }

  return <div className="divide-y divide-slate-100">
    {rows.map((row) => {
      const unread = !row.read_at
      return <button key={row.id} type="button" onClick={() => void open(row)} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:px-5', compact && 'px-3 sm:px-4')}>
        <span className={cn('size-2 shrink-0 rounded-full', unread ? 'bg-blue-600' : 'bg-slate-200')} />
        <span className="min-w-0 flex-1">
          <span title={row.title} className={cn('block truncate text-sm text-slate-900', unread ? 'font-semibold' : 'font-normal')}>{row.title}</span>
          {row.body ? <span title={row.body} className="mt-0.5 block truncate text-xs leading-5 text-slate-500">{row.body}</span> : null}
          {compact ? <span className="mt-1 block text-[11px] text-slate-400">{formatNotificationTime(row.created_at)}</span> : null}
        </span>
        {row.pending_sync ? <WifiOff className="size-3 shrink-0 text-amber-600" /> : null}
        {!compact ? <span className="shrink-0 text-xs text-slate-400">{formatNotificationTime(row.created_at)}</span> : null}
      </button>
    })}
  </div>
}
