import Link from 'next/link'
import { AlertTriangle, ArrowRight, BarChart3, CircleDollarSign, Gauge, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getControlOverview } from '@/features/control/server'
import { formatMoney } from '@/features/finance/format'
import { pct } from '@/features/control/format'
import type { Database } from '@/lib/supabase/database.types'

export const dynamic = 'force-dynamic'

type ControlSummary = Database['public']['Views']['project_control_summary']['Row']
type PortfolioProject = Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'code' | 'name'>

export default async function ControlOverviewPage() {
  const data = await getControlOverview()
  if (!data.allowed) return <Card><CardHeader><CardTitle>Control de proyecto</CardTitle><CardDescription>El control económico está disponible para administradores y PM.</CardDescription></CardHeader></Card>

  const summaries = new Map<string, ControlSummary>(
    (data.summaries as ControlSummary[]).flatMap((row: ControlSummary) => row.project_id ? [[row.project_id, row] as const] : []),
  )
  const projects = data.projects as PortfolioProject[]
  const budgeted = projects.filter((project: PortfolioProject) => Number(summaries.get(project.id)?.budget_total_net ?? 0) > 0).length
  const withUnassigned = projects.filter((project: PortfolioProject) => Number(summaries.get(project.id)?.unassigned_committed_net ?? 0) > 0).length

  return <div className="mx-auto max-w-7xl space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Control de proyectos</h1></div><Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">Importes de control sin IGV</Badge></div>

    <section className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Proyectos visibles</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{projects.length}</p></div><BarChart3 className="size-5 text-cyan-300" /></div></CardContent></Card>
      <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Con línea base</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{budgeted}</p></div><WalletCards className="size-5 text-emerald-300" /></div></CardContent></Card>
      <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Con costos sin asignar</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{withUnassigned}</p></div><AlertTriangle className="size-5 text-amber-300" /></div></CardContent></Card>
    </section>

    <Card><CardHeader><CardTitle>Portafolio</CardTitle></CardHeader><CardContent className="space-y-3">
      {projects.length === 0 ? <p className="text-sm text-slate-500">No tienes proyectos visibles.</p> : projects.map((project: PortfolioProject) => {
        const summary = summaries.get(project.id)
        const currency = summary?.currency ?? data.company.currency
        const budget = Number(summary?.budget_total_net ?? 0)
        const committed = Number(summary?.committed_cost_net ?? 0)
        const physical = Number(summary?.physical_progress_pct ?? 0)
        return <Link key={project.id} href={`/app/projects/${project.id}/control`} prefetch className="block rounded-2xl border border-slate-800 bg-slate-950/30 p-4 transition hover:border-cyan-400/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-100">{project.code} · {project.name}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(Math.max(physical, 0), 100)}%` }} /></div><p className="mt-2 text-xs text-slate-500">Avance físico {pct(physical)}</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[460px]"><div><p className="text-[11px] text-slate-500">Presupuesto</p><p className="mt-1 text-sm font-semibold text-white">{formatMoney(budget, currency)}</p></div><div><p className="text-[11px] text-slate-500">Comprometido</p><p className="mt-1 text-sm font-semibold text-white">{formatMoney(committed, currency)}</p></div><div><p className="text-[11px] text-slate-500">Saldo</p><p className="mt-1 text-sm font-semibold text-cyan-200">{formatMoney(Number(summary?.budget_balance_net ?? 0), currency)}</p></div></div>
            <ArrowRight className="hidden size-5 text-slate-600 lg:block" />
          </div>
          {Number(summary?.unassigned_committed_net ?? 0) > 0 ? <p className="mt-3 flex items-center gap-2 text-xs text-amber-300"><AlertTriangle className="size-3.5" />{formatMoney(Number(summary?.unassigned_committed_net ?? 0), currency)} comprometidos aún no están vinculados a una partida presupuestal.</p> : null}
        </Link>
      })}
    </CardContent></Card>

    <div className="grid gap-4 md:grid-cols-2"><Card><CardContent className="flex items-start gap-3 p-6"><Gauge className="mt-0.5 size-5 text-cyan-300" /><div><p className="font-semibold text-slate-200">Avance físico</p></div></CardContent></Card><Card><CardContent className="flex items-start gap-3 p-6"><CircleDollarSign className="mt-0.5 size-5 text-emerald-300" /><div><p className="font-semibold text-slate-200">Valorizaciones</p></div></CardContent></Card></div>
  </div>
}
