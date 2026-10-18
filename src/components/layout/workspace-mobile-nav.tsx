'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bell,
  CalendarRange,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Drawer } from '@/components/ui/drawer'
import type { AppRole } from '@/features/auth/roles'
import styles from './workspace-mobile-nav.module.css'

type Item = { href: string; label: string; icon: LucideIcon; roles?: readonly AppRole[] }

const items: Item[] = [
  { href: '/app/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/app/proyectos', label: 'Proyectos', icon: FolderKanban },
  { href: '/app/tasks', label: 'Tareas', icon: ClipboardCheck },
  { href: '/app/peticiones', label: 'Peticiones', icon: ClipboardCheck },
  { href: '/app/documents', label: 'Documentos', icon: FileText },
  { href: '/app/sst', label: 'SST', icon: ShieldCheck },
  { href: '/app/inventory', label: 'Almacén', icon: Warehouse },
  { href: '/app/planning', label: 'Planificación', icon: CalendarRange },
  { href: '/app/control', label: 'Control', icon: BarChart3, roles: ['admin', 'pm'] },
  { href: '/app/compras', label: 'Compras', icon: ShoppingCart, roles: ['admin', 'pm'] },
  { href: '/app/finanzas', label: 'Finanzas', icon: ReceiptText, roles: ['admin', 'pm'] },
  { href: '/app/notificaciones', label: 'Notificaciones', icon: Bell },
  { href: '/app/equipos', label: 'Equipo', icon: UsersRound },
  { href: '/app/configuracion', label: 'Configuración', icon: Settings },
]

export function WorkspaceMobileNav({ role }: { role: AppRole }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const visible = items.filter((item) => !item.roles || item.roles.includes(role))

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    const desktop = window.matchMedia('(min-width: 1024px)')
    const onBreakpointChange = () => { if (desktop.matches) setOpen(false) }
    onBreakpointChange()
    desktop.addEventListener('change', onBreakpointChange)
    window.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', close)
      desktop.removeEventListener('change', onBreakpointChange)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 lg:hidden"
        aria-label="Abrir menú"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Menu className="size-5" strokeWidth={1.5} />
      </button>

      <Drawer open={open} onOpenChange={setOpen} title="MGL Systems" className={cn(styles.panel, 'w-[min(22rem,92vw)] max-w-none lg:hidden [&>div:first-child]:px-4 [&>div:last-child]:p-3')}>
        <nav aria-label="Menú de gestión">
          <p className="px-3 pb-3 pt-1 text-xs font-medium text-slate-500">Menú de gestión</p>
          <div className="grid gap-1">
            {visible.map(({ href, label, icon: Icon }) => {
              const active = href === '/app/dashboard' ? pathname === href || pathname === '/app' : href === '/app/proyectos' ? pathname.startsWith('/app/proyectos') || pathname.startsWith('/app/projects') : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </Drawer>
    </>
  )
}
