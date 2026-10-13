'use client'

import Link from 'next/link'
import { CheckCheck, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NotificationList } from './notification-list'
import type { ReturnTypeUseNotifications } from './view-types'

export function NotificationDrawer({
  open,
  onClose,
  model,
}: {
  open: boolean
  onClose: () => void
  model: ReturnTypeUseNotifications
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => closeRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/25" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-drawer-title"
        className="ml-auto flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/15"
      >
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="notification-drawer-title" className="text-lg font-medium tracking-tight text-slate-950">Notificaciones</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {model.unreadCount ? `${model.unreadCount} sin leer` : 'Todo al día'} · {model.online ? 'En línea' : 'Modo offline'}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} title="Cerrar" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <span className="text-[11px] text-slate-400"></span>
          <button
            type="button"
            onClick={() => void model.markAllRead()}
            disabled={!model.unreadCount}
            className="inline-flex items-center gap-2 text-xs font-medium text-blue-700 disabled:text-slate-300"
          >
            <CheckCheck className="size-3.5" strokeWidth={1.5} /> Marcar todo leído
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <NotificationList rows={model.notifications.slice(0, 30)} onSetRead={model.setRead} compact />
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <Link href="/notificaciones" onClick={onClose} className="block rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Ver todas y configurar avisos
          </Link>
        </footer>
      </aside>
    </div>
  )
}
