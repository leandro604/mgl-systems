import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { requireWorkspaceContext } from '@/features/auth/server'
import { CreateProjectForm } from '@/features/projects/create-project-form'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, string> = {
  planning: 'Planificación',
  active: 'Activo',
  on_hold: 'En pausa',
  completed: 'Completado',
}

export default async function ProjectsEsPage({ searchParams }: { searchParams: Promise<{ estado?: string; nuevo?: string }> }) {
  const [{ estado, nuevo }, ctx] = await Promise.all([searchParams, requireWorkspaceContext()])
  const filter = typeof estado === 'string' ? estado : 'all'
  const rows = filter === 'all' ? ctx.projects : ctx.projects.filter((project) => project.status === filter)
  const canCreate = ['admin', 'pm'].includes(ctx.profile.role)

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Proyectos</h1>
        {canCreate ? <Button asChild className="w-full sm:w-auto"><Link href="/app/proyectos?nuevo=1"><Plus />Nuevo proyecto</Link></Button> : null}
      </div>

      {nuevo === '1' && canCreate ? <Card><CardContent className="pt-4 sm:pt-6"><CreateProjectForm /></CardContent></Card> : null}

      <div className="mgl-hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
        {['all', 'planning', 'active', 'on_hold', 'completed'].map((value) => (
          <Link
            key={value}
            href={value === 'all' ? '/app/proyectos' : `/app/proyectos?estado=${value}`}
            className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium ${filter === value ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            {value === 'all' ? 'Todos' : statusLabel[value]}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((project) => (
          <Link key={project.id} href={`/app/proyectos/${project.id}/dashboard`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{project.code}</p>
                <h2 className="mt-1 break-words text-sm font-medium leading-5 text-slate-950">{project.name}</h2>
              </div>
              <Badge className="shrink-0">{statusLabel[project.status] ?? project.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
              <div><p className="text-slate-500">Inicio</p><p className="mt-1 font-medium text-slate-800">{project.starts_on ?? '—'}</p></div>
              <div><p className="text-slate-500">Fin</p><p className="mt-1 font-medium text-slate-800">{project.ends_on ?? '—'}</p></div>
            </div>
          </Link>
        ))}
        {!rows.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Sin datos</div> : null}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Proyecto</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Inicio</th><th className="px-4 py-3">Fin</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((project) => <tr key={project.id}><td className="px-4 py-3 font-medium text-blue-700"><Link href={`/app/proyectos/${project.id}/dashboard`}>{project.code}</Link></td><td className="px-4 py-3 font-medium">{project.name}</td><td className="px-4 py-3"><Badge>{statusLabel[project.status] ?? project.status}</Badge></td><td className="px-4 py-3 text-slate-500">{project.starts_on ?? '—'}</td><td className="px-4 py-3 text-slate-500">{project.ends_on ?? '—'}</td></tr>)}
          </tbody>
        </table>
        {!rows.length ? <div className="p-8 text-center text-sm text-slate-500">Sin datos</div> : null}
      </div>
    </div>
  )
}
