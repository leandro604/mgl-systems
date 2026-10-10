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
    <div className="mx-auto max-w-6xl space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Portafolio</p><h1 className="mt-2 text-3xl font-black text-white">Proyectos</h1><p className="mt-2 text-sm text-slate-400">Solo aparecen proyectos donde tu usuario tiene membresía activa.</p></div>
      {canCreate ? <Card><CardHeader><CardTitle>Nuevo proyecto</CardTitle><CardDescription>El creador se asigna automáticamente como miembro para evitar proyectos inaccesibles.</CardDescription></CardHeader><CardContent><CreateProjectForm /></CardContent></Card> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => <Link key={project.id} href={`/app/projects/${project.id}`} className="group"><Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-cyan-400/30"><CardContent className="p-5"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><FolderKanban className="size-5" /></span><ArrowUpRight className="size-4 text-slate-600 group-hover:text-cyan-300" /></div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{project.code}</p><h2 className="mt-2 text-lg font-semibold text-white">{project.name}</h2><div className="mt-5"><Badge>{project.status.replace('_',' ')}</Badge></div></CardContent></Card></Link>)}
      </section>
      {projects.length === 0 && !canCreate ? <Card><CardContent className="p-8 text-center text-sm text-slate-500">No tienes proyectos asignados. Un administrador o PM debe agregarte a un proyecto.</CardContent></Card> : null}
    </div>
  )
}
