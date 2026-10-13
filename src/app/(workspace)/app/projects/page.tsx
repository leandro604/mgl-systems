import Link from 'next/link'
import { ArrowUpRight, FolderKanban } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateProjectForm } from '@/features/projects/create-project-form'
import { requireWorkspaceContext } from '@/features/auth/server'

export default async function ProjectsPage() {
  const { projects, profile } = await requireWorkspaceContext()
  const canCreate = profile.role === 'admin' || profile.role === 'pm'
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Portafolio</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Proyectos</h1></div>
      {canCreate ? <Card><CardHeader><CardTitle>Nuevo proyecto</CardTitle></CardHeader><CardContent><CreateProjectForm /></CardContent></Card> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => <Link key={project.id} href={`/app/projects/${project.id}`} className="group"><Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-cyan-400/30"><CardContent className="p-6"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><FolderKanban className="size-5" /></span><ArrowUpRight className="size-4 text-slate-600 group-hover:text-cyan-300" /></div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{project.code}</p><h2 className="mt-2 text-sm font-medium text-slate-700">{project.name}</h2><div className="mt-5"><Badge>{project.status.replace('_',' ')}</Badge></div></CardContent></Card></Link>)}
      </section>
      {projects.length === 0 && !canCreate ? <Card><CardContent className="p-8 text-center text-sm text-slate-500">Sin proyectos asignados</CardContent></Card> : null}
    </div>
  )
}
