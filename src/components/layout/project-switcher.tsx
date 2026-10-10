'use client'

import { usePathname, useRouter } from 'next/navigation'
import { FolderKanban } from 'lucide-react'

type Project = { id: string; code: string; name: string }

export function ProjectSwitcher({ projects }: { projects: Project[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const current = projects.find((project) => pathname.includes(project.id))?.id ?? ''

  if (projects.length === 0) {
    return (
      <button
        type="button"
        onClick={() => router.push('/app/projects')}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
      >
        <FolderKanban className="size-4 text-blue-600" strokeWidth={1.5} />
        Crear primer proyecto
      </button>
    )
  }

  return (
    <label className="relative hidden sm:block">
      <FolderKanban className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" strokeWidth={1.5} />
      <select
        value={current}
        onChange={(event) => event.target.value ? router.push(`/app/projects/${event.target.value}`) : router.push('/app')}
        className="h-10 min-w-56 appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-600/15"
      >
        <option value="">Todos los proyectos</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
      </select>
    </label>
  )
}
