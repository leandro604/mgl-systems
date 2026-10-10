import Link from 'next/link'
import { AlertTriangle, ArrowRight, CalendarClock, Flag, CalendarRange } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPlanningOverview } from '@/features/planning/server'
import type { Database } from '@/lib/supabase/database.types'

export const dynamic = 'force-dynamic'

type Summary = Database['public']['Views']['project_schedule_summary']['Row']
type Project = Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'code' | 'name'>

export default async function PlanningOverviewPage() {
  const data = await getPlanningOverview()
  const summaries = new Map<string, Summary>((data.summaries as Summary[]).flatMap((row) => row.project_id ? [[row.project_id, row] as const] : []))
  const projects = data.projects as Project[]
  const overdue = projects.reduce((sum, project) => sum + Number(summaries.get(project.id)?.overdue_tasks ?? 0), 0)
  const withBaseline = projects.filter((project) => summaries.get(project.id)?.baseline_id).length
  const milestones = projects.reduce((sum, project) => sum + Number(summaries.get(project.id)?.milestone_count ?? 0), 0)

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Fase 8</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white">Planificación y cronograma</h1><p className="mt-2 text-sm text-slate-400">EDT/WBS, Gantt, ruta crítica, línea base y avance planificado vs real.</p></div><Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">CPM + Curva S</Badge></div>
    <section className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Con línea base</p><p className="mt-2 text-3xl font-black text-white">{withBaseline}</p></div><CalendarRange className="size-5 text-cyan-300" /></div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Actividades atrasadas</p><p className="mt-2 text-3xl font-black text-white">{overdue}</p></div><AlertTriangle className="size-5 text-amber-300" /></div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Hitos registrados</p><p className="mt-2 text-3xl font-black text-white">{milestones}</p></div><Flag className="size-5 text-emerald-300" /></div></CardContent></Card>
    </section>
    <Card><CardHeader><CardTitle>Portafolio de plazos</CardTitle><CardDescription>Indicadores calculados sobre las tareas activas de cada proyecto.</CardDescription></CardHeader><CardContent className="space-y-3">
      {projects.length === 0 ? <p className="text-sm text-slate-500">No tienes proyectos visibles.</p> : projects.map((project) => { const s = summaries.get(project.id); return <Link key={project.id} href={`/app/projects/${project.id}/planning`} prefetch className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-4 transition hover:border-cyan-400/30 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-100">{project.code} · {project.name}</p><p className="mt-1 text-xs text-slate-500">{Number(s?.scheduled_tasks ?? 0)}/{Number(s?.active_tasks ?? 0)} tareas programadas · avance {Number(s?.actual_progress_pct ?? 0).toFixed(1)}%</p></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:w-[500px]"><div><p className="text-[11px] text-slate-500">Línea base</p><p className="mt-1 text-sm font-semibold text-white">{s?.baseline_version ? `V${s.baseline_version}` : 'Pendiente'}</p></div><div><p className="text-[11px] text-slate-500">Atrasadas</p><p className="mt-1 text-sm font-semibold text-amber-200">{Number(s?.overdue_tasks ?? 0)}</p></div><div><p className="text-[11px] text-slate-500">Próximo hito</p><p className="mt-1 text-sm font-semibold text-cyan-200">{s?.next_milestone_on ?? '—'}</p></div></div><ArrowRight className="hidden size-5 text-slate-600 lg:block" /></Link> })}
    </CardContent></Card>
    <Card><CardContent className="flex items-start gap-3 p-5"><CalendarClock className="mt-0.5 size-5 text-cyan-300" /><div><p className="font-semibold text-slate-200">Una sola fuente de tareas</p><p className="mt-1 text-sm text-slate-500">La planificación usa las mismas tareas local-first de MGL Systems; no crea un cronograma duplicado.</p></div></CardContent></Card>
  </div>
}
