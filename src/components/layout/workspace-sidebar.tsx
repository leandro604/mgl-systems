'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bell,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  PlugZap,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { Logo } from './logo'
import { cn } from '@/lib/utils'
import { roleLabels, type AppRole } from '@/features/auth/roles'

const SIDEBAR_STORAGE_KEY = 'mgl:sidebar-collapsed'

type ManagerNavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; roles?: readonly AppRole[] }

const nav: ManagerNavItem[] = [
  { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
]

const utilityNav: ManagerNavItem[] = [
  { href: '/app/notificaciones', label: 'Notificaciones', icon: Bell },
  { href: '/app/reportes', label: 'Reportes', icon: BarChart3, roles: ['admin', 'pm'] },
  { href: '/app/equipos', label: 'Equipo', icon: UsersRound },
  { href: '/app/configuracion', label: 'Configuración', icon: Settings },
  { href: '/app/configuracion/suscripcion', label: 'Suscripción', icon: CreditCard, roles: ['admin'] },
  { href: '/app/configuracion/facturacion', label: 'Facturación electrónica', icon: ReceiptText, roles: ['admin'] },
  { href: '/app/configuracion/integraciones', label: 'Integraciones', icon: PlugZap },
]

function applyCollapsedState(collapsed: boolean) {
  document.documentElement.dataset.sidebarCollapsed = collapsed ? 'true' : 'false'
}

function allowedForRole(item: ManagerNavItem, role: AppRole) {
  return !item.roles || item.roles.includes(role)
}

export function WorkspaceSidebar({ companyName, role }: { companyName: string; role: AppRole }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
      const next = stored === 'true'
      setCollapsed(next)
      applyCollapsedState(next)
    } catch {
      applyCollapsedState(false)
    }

    return () => {
      delete document.documentElement.dataset.sidebarCollapsed
    }
  }, [])

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      applyCollapsedState(next)
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      } catch {
        // UI preference persistence is best-effort.
      }
      return next
    })
  }

  const mainItems = nav.filter((item) => allowedForRole(item, role))
  const utilities = utilityNav.filter((item) => allowedForRole(item, role))

  return (
    <aside
      className={cn(
        'mgl-manager-sidebar fixed inset-y-0 left-0 z-30 hidden overflow-y-auto overscroll-contain border-r border-slate-800 bg-slate-950 py-4 lg:flex lg:flex-col [scrollbar-gutter:stable]',
        'transition-[width] duration-150',
        collapsed ? 'w-16 px-2' : 'w-60 px-3',
      )}
    >
      <div className={cn('flex h-10 items-center', collapsed ? 'justify-center' : 'px-1')}>
        <Logo compact={collapsed} className={cn(collapsed && '[&>span:first-of-type]:size-9')} />
      </div>

      <div className={cn('mt-5 border border-slate-800 bg-slate-900/50', collapsed ? 'rounded-lg p-2 text-center' : 'rounded-xl p-3')}>
        {collapsed ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500" title={companyName}>{companyName.slice(0, 2).toUpperCase()}</p>
        ) : (
          <>
            <p className="truncate text-sm font-medium text-slate-100">{companyName}</p>
            <p className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">{roleLabels[role]}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-blue-300">Gestión / administración</p>
          </>
        )}
      </div>

      <nav className="mt-5 shrink-0 space-y-1" aria-label="Navegación gerencial">
        {mainItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href} prefetch title={collapsed ? label : undefined} aria-current={active ? 'page' : undefined} className={cn('flex h-9 items-center rounded-lg text-sm font-medium transition-colors duration-150', collapsed ? 'justify-center px-0' : 'gap-3 px-3', active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100')}>
              <Icon className="size-4 shrink-0" strokeWidth={1.5} />
              {!collapsed ? <span className="truncate">{label}</span> : null}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-slate-800 pt-3">
        {utilities.map(({ href, label, icon: Icon }) => {
          const active = href === '/app/configuracion' ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href} prefetch title={collapsed ? label : undefined} className={cn('flex h-9 items-center rounded-lg text-sm font-medium transition-colors duration-150', collapsed ? 'justify-center px-0' : 'gap-3 px-3', active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100')}>
              <Icon className="size-4 shrink-0" strokeWidth={1.5} />
              {!collapsed ? <span>{label}</span> : null}
            </Link>
          )
        })}

        <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'} className={cn('mt-2 flex h-9 w-full items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-900 hover:text-slate-200', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40', collapsed ? 'justify-center' : 'gap-3 px-3')}>
          {collapsed ? <ChevronRight className="size-4" strokeWidth={1.5} /> : <ChevronLeft className="size-4" strokeWidth={1.5} />}
          {!collapsed ? <span className="text-xs font-medium">Contraer</span> : null}
        </button>
      </div>
    </aside>
  )
}
