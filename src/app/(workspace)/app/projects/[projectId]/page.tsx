import Link from 'next/link'
import {
  BarChart3,
  ClipboardCheck,
  FileText,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/features/finance/format'
import { ProjectSettingsForm } from '@/features/projects/project-settings-form'
import { getStageDashboardData } from '@/features/projects/stage-dashboard-data'
import { StageDashboard } from '@/features/projects/stage-dashboard'
import { requireProjectContext } from '@/features/projects/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessFinancialModules } from '@/features/auth/roles'

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const context = await requireProjectContext(projectId)
  const { project, profile } = context
  const supabase = await createClient()

  const canViewFinancial = canAccessFinancialModules(profile.role)
  const canEdit = canViewFinancial

  const [projectMetrics, stageDashboard] = await Promise.all([
    Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
      supabase.from('sst_records').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
      supabase.from('project_members').select('id', { count: 'exact', head: true }).eq('project_id', projectId).is('deleted_at', null),
      canViewFinancial ? supabase.from('project_financial_summary').select('*').eq('project_id', projectId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      canViewFinancial ? supabase.from('project_control_summary').select('*').eq('project_id', projectId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]),
    canViewFinancial ? getStageDashboardData(projectId) : Promise.resolve(null),
  ])

  const [tasks, docs, sst, members, financial, control] = projectMetrics
  for (const result of [tasks, docs, sst, members, financial, control]) {
    if (result.error) throw result.error
  }

  const cards = [
    { label: 'Tareas', value: tasks.count ?? 0, href: `/app/projects/${projectId}/tasks`, icon: ClipboardCheck },
    { label: 'Documentos', value: docs.count ?? 0, href: `/app/projects/${projectId}/documents`, icon: FileText },
    { label: 'Registros SST', value: sst.count ?? 0, href: `/app/projects/${projectId}/sst`, icon: ShieldCheck },
    { label: 'Miembros', value: members.count ?? 0, href: `/app/projects/${projectId}/team`, icon: Users },
  ]

  return (
    <div className="space-y-8">
      {stageDashboard ? <>
        <section className="space-y-4 sm:hidden">
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-600">Desviación global</span><strong className="text-lg font-semibold tabular-nums text-slate-950">{stageDashboard.deviationPct == null ? '—' : `${stageDashboard.deviationPct > 0 ? '+' : ''}${stageDashboard.deviationPct.toFixed(2)}%`}</strong></div><p className="mt-2 text-sm tabular-nums text-slate-500">{formatMoney(stageDashboard.quotedTotal,context.company.currency)} → {formatMoney(stageDashboard.actualTotal,context.company.currency)}</p></CardContent></Card>
          <div className="grid grid-cols-2 gap-3"><Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/partidas`}>Partidas</Link></Button><Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/tasks`}>Tareas</Link></Button><Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/purchases`}>Compras</Link></Button><Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/control`}>Etapas</Link></Button></div>
        </section>
        <div className="hidden sm:block"><StageDashboard data={stageDashboard} currency={context.company.currency} /></div>
      </> : null}

      <section aria-labelledby="project-operational-summary" className="hidden space-y-4 sm:block">
        <div>
          <h2 id="project-operational-summary" className="text-lg font-medium tracking-tight text-slate-950">
            Resumen operativo
          </h2>
          
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, href, icon: Icon }) => (
            <Link key={label} href={href}>
              <Card className="h-full transition-colors hover:border-blue-200">
                <CardContent className="flex items-center gap-4 p-6">
                  <span className="grid size-11 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Icon className="size-5" strokeWidth={1.5} />
                  </span>
                  <div>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950">{value}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {canEdit && financial.data ? (
        <section className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Costo comprometido</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(Number(financial.data.committed_cost ?? 0))}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Costo recibido</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(Number(financial.data.received_cost ?? 0))}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Facturado aceptado</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(Number(financial.data.accepted_revenue ?? 0))}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Margen operativo</p><p className="mt-2 text-3xl font-semibold tabular-nums text-blue-700">{formatMoney(Number(financial.data.operational_margin ?? 0))}</p></CardContent></Card>
        </section>
      ) : null}

      {canEdit && control.data && Number(control.data.budget_total_net ?? 0) > 0 ? (
        <section className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Presupuesto base · sin IGV</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(Number(control.data.budget_total_net ?? 0), control.data.currency ?? context.company.currency)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Uso de presupuesto</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{Number(control.data.cost_utilization_pct ?? 0).toFixed(2)} %</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Avance físico</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{Number(control.data.physical_progress_pct ?? 0).toFixed(2)} %</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Valorizado aprobado</p><p className="mt-2 text-3xl font-semibold tabular-nums text-blue-700">{formatMoney(Number(control.data.approved_valuation_net ?? 0), control.data.currency ?? context.company.currency)}</p></CardContent></Card>
        </section>
      ) : null}

      <section className="hidden gap-8 sm:grid xl:grid-cols-[.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Operación del proyecto</CardTitle>
            
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/tasks`}>Gestionar tareas</Link></Button>
            <Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/documents`}>Documentación</Link></Button>
            <Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/sst`}>Seguridad y SST</Link></Button>
            <Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/team`}>Equipo del proyecto</Link></Button>
            {canEdit ? (
              <>
                <Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/control`}><BarChart3 />Control de proyecto</Link></Button>
                <Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/purchases`}><ShoppingCart />Compras</Link></Button>
                <Button asChild variant="secondary"><Link href={`/app/projects/${projectId}/invoices`}><ReceiptText />Facturación</Link></Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos del proyecto</CardTitle>
            
          </CardHeader>
          <CardContent>
            {canEdit ? (
              <ProjectSettingsForm project={project} />
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Código</dt><dd className="mt-1 text-sm text-slate-900">{project.code}</dd></div>
                <div><dt className="text-xs text-slate-500">Estado</dt><dd className="mt-1 text-sm text-slate-900">{project.status}</dd></div>
                <div><dt className="text-xs text-slate-500">Inicio</dt><dd className="mt-1 text-sm text-slate-900">{project.starts_on ?? 'Sin fecha'}</dd></div>
                <div><dt className="text-xs text-slate-500">Fin</dt><dd className="mt-1 text-sm text-slate-900">{project.ends_on ?? 'Sin fecha'}</dd></div>
              </dl>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
