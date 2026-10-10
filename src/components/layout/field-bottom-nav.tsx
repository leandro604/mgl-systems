'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, CalendarCheck2, ClipboardList, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type BottomNavItem = { href: string; label: string; icon: LucideIcon; notification?: boolean }

const items: BottomNavItem[] = [
  { href: '/field/hoy', label: 'Hoy', icon: CalendarCheck2 },
  { href: '/field/mis-peticiones', label: 'Peticiones', icon: ClipboardList },
  { href: '/field/notificaciones', label: 'Avisos', icon: Bell, notification: true },
  { href: '/field/sst', label: 'SST', icon: ShieldCheck },
  { href: '/field/perfil', label: 'Perfil', icon: UserRound },
]

export function FieldBottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname()
  const safeCount = Math.max(0, Math.floor(unreadCount))

  return (
    <nav
      aria-label="Navegación operativa"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, notification }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors duration-150',
                active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900',
              )}
            >
              <span className="relative">
                <Icon className="size-5" strokeWidth={1.5} />
                {notification && safeCount > 0 ? (
                  <span className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[8px] leading-4 text-white">
                    {safeCount > 99 ? '99+' : safeCount}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
