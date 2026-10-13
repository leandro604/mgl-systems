import type { ReactNode } from 'react'
import { WorkspaceHeader } from '@/components/layout/workspace-header'
import { WorkspaceSidebar } from '@/components/layout/workspace-sidebar'
import { requireManagementWorkspaceContext } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { company, profile, projects, email } = await requireManagementWorkspaceContext()
  return (
    <div className="mgl-workspace min-h-screen bg-[#FAFAFA] text-slate-900">
      <WorkspaceSidebar companyName={company.legal_name} role={profile.role} />
      <WorkspaceHeader
        projects={projects.map(({ id, code, name }) => ({ id, code, name }))}
        fullName={profile.full_name}
        email={email}
        companyId={company.id}
        userId={profile.user_id}
        role={profile.role}
      />
      <main className="mgl-workspace-main min-w-0 px-3 py-4 sm:px-5 sm:py-6 lg:ml-60 lg:px-8 lg:py-8">{children}</main>
    </div>
  )
}
