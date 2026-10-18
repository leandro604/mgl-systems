'use client'

import Link from 'next/link'
import { CheckCheck, RefreshCw, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { NotificationList } from './notification-list'
import type { ReturnTypeUseNotifications } from './view-types'

export function NotificationDrawer({ panelId, anchorRef, onClose, model }: {
  panelId: string
  anchorRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  model: ReturnTypeUseNotifications
}) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [layout, setLayout] = useState<{ desktop: boolean; top: number; right: number } | null>(null)

  useLayoutEffect(() => {
    const position = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      setLayout({
        desktop: window.matchMedia('(min-width: 768px)').matches,
        top: Math.min((rect?.bottom ?? 56) + 10, Math.max(8, window.innerHeight - 200)),
        right: Math.max(12, Math.min(window.innerWidth - (rect?.right ?? window.innerWidth - 12), window.innerWidth - 396)),
      })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [anchorRef])

  const desktop = layout?.desktop
  useEffect(() => {
    if (desktop === undefined) return
    const originalOverflow = document.body.style.overflow
    if (!desktop) document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => closeRef.current?.focus())
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) && !anchorRef.current?.contains(event.target)) onClose()
    }
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (!desktop && event.key === 'Tab') {
        const items = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')
        const first = items?.[0]
        const last = items?.[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keyDown)
    return () => {
      cancelAnimationFrame(frame)
      if (!desktop) document.body.style.overflow = originalOverflow
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', keyDown)
    }
  }, [anchorRef, desktop, onClose])

  if (!layout) return null
  const rows = model.notifications.slice(0, 5)
  const waiting = !model.ready || (model.refreshing && !rows.length)

  return createPortal(<>
    {!desktop ? <div className="fixed inset-0 z-[79] bg-slate-950/25" aria-hidden="true" /> : null}
    <section ref={panelRef} id={panelId} role="dialog" aria-modal={desktop ? undefined : true} aria-labelledby={panelId + '-title'}
      style={desktop ? { top: layout.top, right: layout.right, maxHeight: 'min(560px, calc(100dvh - ' + (layout.top + 12) + 'px))' } : undefined}
      className={'fixed z-[80] flex flex-col border border-slate-200 bg-white shadow-xl shadow-slate-950/15 ' + (desktop ? 'w-96 rounded-2xl' : 'inset-y-0 right-0 h-dvh w-full max-w-md')}>
      <header className="flex shrink-0 items-center gap-3 rounded-t-2xl border-b border-slate-200 px-4 py-4">
        <div className="min-w-0 flex-1">
          <h2 id={panelId + '-title'} className="text-base font-semibold text-slate-950">Notificaciones</h2>
          <p className="mt-0.5 text-xs text-slate-500">{model.unreadCount ? model.unreadCount + ' sin leer' : 'Todo al día'} · {model.online ? 'En línea' : 'Modo offline'}</p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar notificaciones" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
      </header>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <span className="text-xs text-slate-500">Últimos avisos</span>
        <button type="button" onClick={() => void model.markAllRead()} disabled={!model.unreadCount} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 disabled:text-slate-400"><CheckCheck className="size-3.5" />Marcar todas como leídas</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={waiting}>
        {model.error ? <div role="status" className="m-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          No se pudieron actualizar los avisos. {rows.length ? 'Se muestran los guardados.' : ''}
          <button type="button" onClick={() => void model.refresh()} disabled={model.refreshing || !model.online} className="mt-2 flex items-center gap-1 font-semibold underline disabled:opacity-50"><RefreshCw className="size-3" />Reintentar</button>
        </div> : null}
        {waiting ? <p role="status" className="px-4 py-10 text-center text-sm text-slate-500">Cargando notificaciones…</p> : <NotificationList rows={rows} onSetRead={model.setRead} onOpen={onClose} compact emptyMessage={model.unreadCount ? 'Hay avisos pendientes. Actualiza la lista o abre Ver todas.' : 'No tienes notificaciones por ahora.'} />}
        {!waiting && !model.error && !rows.length && model.unreadCount > 0 ? <button type="button" onClick={() => void model.refresh()} disabled={!model.online} className="mx-auto mb-4 block text-sm font-medium text-blue-700 disabled:opacity-50">Actualizar lista</button> : null}
      </div>
      <footer className="shrink-0 rounded-b-2xl border-t border-slate-200 bg-slate-50 p-3">
        <Link href="/notificaciones" onClick={onClose} className="block rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100">Ver todas</Link>
      </footer>
    </section>
  </>, document.body)
}
