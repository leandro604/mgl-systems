import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { ProjectSwitcher } from './project-switcher'
import { SyncStatus } from './sync-status'
import { Logo } from './logo'
import { NotificationCenterButton } from '@/features/notifications/notification-center-button'
import { Button } from '@/components/ui/button'
import { GlobalSearchCommand } from '@/features/search/global-search-command'
import type { AppRole } from '@/features/auth/roles'

type Project = { id: string; code: string; name: string }
type MobileLink = { href: string; label: string; roles?: readonly AppRole[] }

const mobileLinks: MobileLink[] = [
  { href: '/app', label: 'Inicio' },
  { href: '/app/projects', label: 'Proyectos' },
  { href: '/app/tasks', label: 'Tareas' },
  { href: '/app/documents', label: 'Docs' },
  { href: '/app/sst', label: 'SST' },
  { href: '/app/inventory', label: 'Almacén' },
  { href: '/app/planning', label: 'Planificación' },
  { href: '/app/control', label: 'Control', roles: ['admin', 'pm'] },
  { href: '/app/compras', label: 'Compras', roles: ['admin', 'pm'] },
  { href: '/app/finanzas', label: 'Finanzas', roles: ['admin', 'pm'] },
  { href: '/app/team', label: 'Equipo' },
  { href: '/app/configuracion', label: 'Configuración' },
]

export function WorkspaceHeader({ projects, fullName, email, companyId, userId, role }: { projects: Project[]; fullName: string; email: string; companyId: string; userId: string; role: AppRole }) {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase())
    .join('') || 'MG'
  const links = mobileLinks.filter((item) => !item.roles || item.roles.includes(role))

  return (
    <header className="mgl-workspace-header sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:pl-60">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Logo compact className="lg:hidden [&>span:first-of-type]:border-slate-200 [&>span:first-of-type]:bg-slate-50 [&>span:first-of-type]:text-blue-600" />
        <ProjectSwitcher projects={projects} />
        <GlobalSearchCommand companyId={companyId} userId={userId} projects={projects} />
        <div className="ml-auto flex items-center gap-2">
          <SyncStatus />
          <NotificationCenterButton companyId={companyId} userId={userId} />
          <div className="hidden text-right md:block">
            <p className="max-w-40 truncate text-xs font-semibold text-slate-900">{fullName}</p>
            <p className="max-w-40 truncate text-[11px] text-slate-500">{email}</p>
          </div>
          <div className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">{initials}</div>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="icon" title="Cerrar sesión" className="text-slate-500 hover:bg-slate-100 hover:text-slate-900"><LogOut /></Button>
          </form>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
        {links.map(({ href, label }) => <Link key={href} href={href} prefetch className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">{label}</Link>)}
      </div>
    </header>
  )
}
