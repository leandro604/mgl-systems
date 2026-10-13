'use client'

import { CheckCheck, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NotificationList } from './notification-list'
import { NotificationPreferences } from './notification-preferences'
import { useNotifications } from './use-notifications'

export function NotificationsPageClient({ companyId, userId, field = false }: { companyId: string; userId: string; field?: boolean }) {
  const model = useNotifications(companyId,userId)
  return <div className={field ? 'space-y-8' : 'mx-auto max-w-6xl space-y-8'}>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Notificaciones</h1>{!model.online ? <Badge variant="warning"><WifiOff className="mr-1 size-3"/>Offline</Badge> : null}</div>{model.unreadCount ? <p className="mt-1 text-xs text-slate-400">{model.unreadCount} sin leer</p> : null}</div>
      <Button type="button" variant="secondary" size="sm" onClick={() => void model.markAllRead()} disabled={!model.unreadCount}><CheckCheck/>Todo leído</Button>
    </header>
    <div className={field ? 'space-y-8' : 'grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.75fr)]'}>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {model.error ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">{model.error}</div> : null}
        <NotificationList rows={model.notifications} onSetRead={model.setRead} />
      </section>
      {!field ? <NotificationPreferences companyId={companyId} model={model}/> : null}
    </div>
  </div>
}
