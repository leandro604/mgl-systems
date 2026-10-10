'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, CalendarCheck2, ClipboardList, LogOut, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import { Logo } from './logo'
import { cn } from '@/lib/utils'

type Item = { href: string; label: string; icon: LucideIcon; notification?: boolean }

const items: Item[] = [
  { href: '/field/hoy', label: 'Mis tareas', icon: CalendarCheck2 },
  { href: '/field/mis-peticiones', label: 'Mis peticiones', icon: ClipboardList },
  { href: '/field/notificaciones', label: 'Notificaciones', icon: Bell, notification: true },
  { href: '/field/sst', label: 'SST', icon: ShieldCheck },
  { href: '/field/perfil', label: 'Mi perfil', icon: UserRound },
]

export function FieldSidebar({ companyName, fullName, unreadCount = 0 }: { companyName: string; fullName: string; unreadCount?: number }) {
  const pathname = usePathname()
  const safeCount = Math.max(0, Math.floor(unreadCount))

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-4 md:flex">
      <div className="px-1"><Logo /></div>
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="truncate text-sm font-semibold text-slate-900">{fullName}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{companyName}</p>
        <span className="mt-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-blue-700">Operación de campo</span>
      </div>

      <nav className="mt-5 space-y-1" aria-label="Navegación de campo">
        {items.map(({ href, label, icon: Icon, notification }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              <span className="relative">
                <Icon className="size-4" strokeWidth={1.5} />
                {notification && safeCount > 0 ? <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[8px] leading-4 text-white">{safeCount > 99 ? '99+' : safeCount}</span> : null}
              </span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <form action="/auth/signout" method="post" className="mt-auto border-t border-slate-200 pt-3">
        <button type="submit" className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950">
          <LogOut className="size-4" strokeWidth={1.5} />
          Cerrar sesión
        </button>
      </form>
    </aside>
  )
}

