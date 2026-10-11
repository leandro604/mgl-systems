'use client'

import { Bell, Check, Circle, ExternalLink, WifiOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { LocalNotification } from '@/lib/db/schema'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatNotificationTime, notificationActionUrl, notificationKindLabel, notificationKindTone } from './notification-utils'

export function NotificationList({
  rows,
  onSetRead,
  emptyMessage = 'Sin notificaciones',
  compact = false,
}: {
  rows: LocalNotification[]
  onSetRead: (id: string, read: boolean) => Promise<void>
  emptyMessage?: string
  compact?: boolean
}) {
  const router = useRouter()

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <Bell className="mx-auto size-8 text-slate-300" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-slate-700">{emptyMessage}</p>
      </div>
    )
  }

  async function open(row: LocalNotification) {
    if (!row.read_at) await onSetRead(row.id, true)
    const href = notificationActionUrl(row)
    if (href) router.push(href)
  }

  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => {
        const unread = !row.read_at
        const href = notificationActionUrl(row)
        return (
          <article
            key={row.id}
            className={cn(
              'group relative flex gap-3 px-4 py-4 transition-colors sm:px-5',
              unread ? 'bg-blue-50/50 hover:bg-blue-50' : 'bg-white hover:bg-slate-50',
              compact && 'px-3 py-3 sm:px-4',
            )}
          >
            <span className={cn('mt-1 size-2 shrink-0 rounded-full', unread ? 'bg-blue-600' : 'bg-slate-200')} aria-hidden="true" />
            <button type="button" onClick={() => void open(row)} className="min-w-0 flex-1 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={notificationKindTone(row.kind)}>{notificationKindLabel(row.kind)}</Badge>
                <span className="text-[11px] text-slate-400">{formatNotificationTime(row.created_at)}</span>
                {row.pending_sync ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                    <WifiOff className="size-3" strokeWidth={1.5} />Local
                  </span>
                ) : null}
              </div>
              <p className={cn('mt-2 text-sm text-slate-900', unread ? 'font-semibold' : 'font-medium')}>{row.title}</p>
              {row.body ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{row.body}</p> : null}
              {href ? (
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
                  Abrir detalle <ExternalLink className="size-3" strokeWidth={1.5} />
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => void onSetRead(row.id, unread)}
              aria-label={unread ? 'Marcar como leída' : 'Marcar como no leída'}
              title={unread ? 'Marcar como leída' : 'Marcar como no leída'}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 opacity-100 transition hover:bg-white hover:text-slate-800 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              {unread ? <Check className="size-4" strokeWidth={1.5} /> : <Circle className="size-4" strokeWidth={1.5} />}
            </button>
          </article>
        )
      })}
    </div>
  )
}
