'use client'

import { CheckCheck, RefreshCw, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NotificationList } from './notification-list'
import { NotificationPreferences } from './notification-preferences'
import { useNotifications } from './use-notifications'

export function NotificationsPageClient({
  companyId,
  userId,
  field = false,
}: {
  companyId: string
  userId: string
  field?: boolean
}) {
  const model = useNotifications(companyId, userId)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const rows = useMemo(
    () => filter === 'unread' ? model.notifications.filter((row) => !row.read_at) : model.notifications,
    [filter, model.notifications],
  )

  return (
    <div className={field ? 'space-y-4' : 'mx-auto max-w-6xl space-y-6'}>
      <header className={field ? 'mb-5' : 'flex flex-wrap items-end justify-between gap-4'}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Notificaciones</h1>
            {!model.online ? <Badge variant="warning"><WifiOff className="mr-1 size-3" />Offline</Badge> : null}
          </div>
          {model.unreadCount ? <p className="mt-1 text-sm text-slate-500">{model.unreadCount} sin leer</p> : null}
        </div>
        <div className="mt-4 flex gap-2 sm:mt-0">
          <Button type="button" variant="secondary" size="sm" onClick={() => void model.refresh()} disabled={model.refreshing}>
            <RefreshCw className={model.refreshing ? 'animate-spin' : ''} /> Actualizar
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void model.markAllRead()} disabled={!model.unreadCount}>
            <CheckCheck /> Todo leído
          </Button>
        </div>
      </header>

      <div className={field ? 'space-y-4' : 'grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.75fr)]'}>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              <button type="button" onClick={() => setFilter('all')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Todas</button>
              <button type="button" onClick={() => setFilter('unread')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === 'unread' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Sin leer</button>
            </div>
            {!model.ready ? <span className="text-[11px] text-slate-400">Cargando…</span> : null}
          </div>
          {model.error ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">{model.error}</div> : null}
          <NotificationList rows={rows} onSetRead={model.setRead} emptyMessage={filter === 'unread' ? 'No quedan notificaciones sin leer.' : 'Aún no tienes notificaciones.'} />
        </section>

        {!field ? <NotificationPreferences companyId={companyId} model={model} /> : null}
      </div>

    </div>
  )
}
