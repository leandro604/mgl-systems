import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { ProjectNav } from '@/components/project/project-nav'
import { requireProjectContext } from '@/features/projects/server'

const labels: Record<string, string> = {
  planning: 'Planificación',
  active: 'Activo',
  on_hold: 'En pausa',
  completed: 'Completado',
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { project, profile } = await requireProjectContext(projectId)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="mgl-project-hero p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="project-code text-xs font-semibold uppercase tracking-[0.18em]">
              {project.code}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {project.name}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {project.description || 'Proyecto operativo de MGL Systems.'}
            </p>
          </div>
          <Badge variant="info">{labels[project.status] ?? project.status}</Badge>
        </div>
      </section>

      <ProjectNav projectId={projectId} role={profile.role} />
      {children}
    </div>
  )
}
