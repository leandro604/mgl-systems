import { LogOut } from 'lucide-react'
import { ProjectSwitcher } from './project-switcher'
import { SyncStatus } from './sync-status'
import { Logo } from './logo'
import { WorkspaceMobileNav } from './workspace-mobile-nav'
import { NotificationCenterButton } from '@/features/notifications/notification-center-button'
import { Button } from '@/components/ui/button'
import { GlobalSearchCommand } from '@/features/search/global-search-command'
import type { AppRole } from '@/features/auth/roles'

type Project = { id: string; code: string; name: string }

export function WorkspaceHeader({ projects, fullName, email, companyId, userId, role }: { projects: Project[]; fullName: string; email: string; companyId: string; userId: string; role: AppRole }) {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase())
    .join('') || 'MG'

  return (
    <header className="mgl-workspace-header sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:pl-60">
      <div className="flex min-h-14 min-w-0 items-center gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-5 lg:px-8">
        <Logo compact className="shrink-0 lg:hidden [&>span:first-of-type]:border-slate-200 [&>span:first-of-type]:bg-slate-50 [&>span:first-of-type]:text-blue-600" />
        <ProjectSwitcher projects={projects} className="hidden min-w-0 flex-1 sm:block md:max-w-[14rem] xl:max-w-[18rem]" />
        <GlobalSearchCommand companyId={companyId} userId={userId} projects={projects} />
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <SyncStatus />
          <NotificationCenterButton companyId={companyId} userId={userId} />
          <div className="hidden text-right xl:block">
            <p className="max-w-40 truncate text-xs font-semibold text-slate-900">{fullName}</p>
            <p className="max-w-40 truncate text-[11px] text-slate-500">{email}</p>
          </div>
          <div className="hidden size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 sm:grid">{initials}</div>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="icon" title="Cerrar sesión" className="text-slate-500 hover:bg-slate-100 hover:text-slate-900"><LogOut /></Button>
          </form>
          <WorkspaceMobileNav role={role} />
        </div>
      </div>
      <div className="border-t border-slate-100 px-3 py-2 sm:hidden">
        <ProjectSwitcher projects={projects} mobile />
      </div>
    </header>
  )
}
