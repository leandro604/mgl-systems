'use client'

import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NotificationBellProps {
  unreadCount?: number
  onClick?: () => void
  className?: string
}

/**
 * Presentational notification entry point.
 * Tarea 9: entry point del centro Realtime/local-first de notificaciones.
 */
export function NotificationBell({ unreadCount = 0, onClick, className }: NotificationBellProps) {
  const safeCount = Math.max(0, Math.floor(unreadCount))
  const label = safeCount > 0 ? `Notificaciones, ${safeCount} sin leer` : 'Notificaciones'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'relative grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600',
        'transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30',
        className,
      )}
    >
      <Bell className="size-4" strokeWidth={1.5} />
      {safeCount > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-semibold leading-4 text-white">
          {safeCount > 99 ? '99+' : safeCount}
        </span>
      ) : null}
    </button>
  )
}
