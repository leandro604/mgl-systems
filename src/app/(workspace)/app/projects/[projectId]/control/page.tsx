import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDollarSign, Gauge, Layers3, PackageCheck, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ActivateBudgetForm, BudgetCreateForm, BudgetItemForm, ProgressForm, ValuationForm } from '@/features/control/forms'
import { budgetStatusLabel, controlStatusClass, pct, valuationStatusLabel } from '@/features/control/format'
import { getProjectControl } from '@/features/control/server'
import { formatMoney } from '@/features/finance/format'
import type { Database } from '@/lib/supabase/database.types'

type BudgetRow = Database['public']['Tables']['project_budgets']['Row']
type BudgetItemRow = Database['public']['Tables']['budget_items']['Row']
type ControlItemRow = Database['public']['Views']['budget_item_control']['Row']
type ProgressRow = Database['public']['Tables']['progress_records']['Row']
type ValuationRow = Database['public']['Tables']['valuations']['Row']

export default async function ProjectControlPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const data = await getProjectControl(projectId)
  if (!data.allowed) return <Card><CardHeader><CardTitle>Control económico</CardTitle><CardDescription>Tu rol no tiene acceso al presupuesto y valorizaciones.</CardDescription></CardHeader></Card>

  const budgets = data.budgets as BudgetRow[]
  const budgetItems = data.budgetItems as BudgetItemRow[]
  const controlItems = data.controlItems as ControlItemRow[]
  const progress = data.progress as ProgressRow[]
  const valuations = data.valuations as ValuationRow[]
  const baseline = budgets.find((budget: BudgetRow) => budget.status === 'baseline') ?? null
  const draft = budgets.find((budget: BudgetRow) => budget.status === 'draft') ?? null
  const selectedBudget = draft ?? baseline ?? budgets[0] ?? null
  const selectedItems = selectedBudget ? budgetItems.filter((item: BudgetItemRow) => item.budget_id === selectedBudget.id) : []
  const groups = selectedItems.filter((item: BudgetItemRow) => item.item_type === 'group').map((item: BudgetItemRow) => ({ id: item.id, code: item.code, description: item.description }))
  const baselineControl = controlItems.filter((item: ControlItemRow) => item.budget_status === 'baseline' && item.item_type === 'item')
  const summary = data.summary
  const currency = summary?.currency ?? baseline?.currency ?? selectedBudget?.currency ?? data.company.currency
  const nextValuation = Math.max(0, ...valuations.map((item: ValuationRow) => item.number)) + 1
  const today = new Date().toISOString().slice(0, 10)
  const itemById = new Map<string, BudgetItemRow>(budgetItems.map((item: BudgetItemRow) => [item.id, item]))

  const cards = [
    { label: 'Presupuesto base', value: formatMoney(Number(summary?.budget_total_net ?? 0), currency), icon: WalletCards },
    { label: 'Comprometido', value: formatMoney(Number(summary?.committed_cost_net ?? 0), currency), icon: PackageCheck },
    { label: 'Recibido', value: formatMoney(Number(summary?.received_cost_net ?? 0), currency), icon: CheckCircle2 },
    { label: 'Saldo disponible', value: formatMoney(Number(summary?.budget_balance_net ?? 0), currency), icon: CircleDollarSign },
    { label: 'Avance físico', value: pct(Number(summary?.physical_progress_pct ?? 0)), icon: Gauge },
    { label: 'Valorizado aprobado', value: formatMoney(Number(summary?.approved_valuation_net ?? 0), currency), icon: Layers3 },
  ]

  return <div className="space-y-8">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-start justify-between p-6"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums text-white">{value}</p></div><span className="grid size-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon className="size-5" /></span></CardContent></Card>)}</section>

    {Number(summary?.unassigned_committed_net ?? 0) > 0 ? <div className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Hay costos comprometidos sin centro de costo</p><p className="mt-1 text-amber-200/70">{formatMoney(Number(summary?.unassigned_committed_net ?? 0), currency)} de órdenes emitidas/recibidas no están asociados a una partida. Asígnalos desde el detalle de una orden en borrador para mantener trazabilidad.</p></div></div> : null}

    <section className="grid gap-8 xl:grid-cols-[.8fr_1.2fr]">
      <Card><CardHeader><CardTitle>Versiones de presupuesto</CardTitle></CardHeader><CardContent className="space-y-3">
        {budgets.length === 0 ? <p className="rounded-xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">Todavía no existe presupuesto.</p> : budgets.map((budget: BudgetRow) => <div key={budget.id} className="rounded-xl border border-slate-800 p-3"><div className="flex items-start gap-3"><div className="flex-1"><p className="text-sm font-semibold text-slate-200">V{budget.version_no} · {budget.name}</p><p className="mt-1 text-xs text-slate-500">{budget.currency}{budget.baseline_at ? ` · línea base ${new Date(budget.baseline_at).toLocaleDateString('es-PE')}` : ''}</p></div>{budget.status === 'baseline' ? <span className="text-xs font-medium text-slate-400">Línea base</span> : <Badge className={controlStatusClass(budget.status)}>{budgetStatusLabel[budget.status] ?? budget.status}</Badge>}</div></div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Nueva versión</CardTitle></CardHeader><CardContent><BudgetCreateForm projectId={projectId} currency={data.company.currency} /></CardContent></Card>
    </section>

    {selectedBudget ? <Card><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>{selectedBudget.status === 'draft' ? 'Editar presupuesto en borrador' : 'Presupuesto de referencia'} · V{selectedBudget.version_no}</CardTitle><p className="mt-1 text-xs text-slate-400">{selectedBudget.name}</p></div>{selectedBudget.status === 'baseline' ? <span className="text-xs font-medium text-slate-400">Línea base</span> : <Badge className={controlStatusClass(selectedBudget.status)}>{budgetStatusLabel[selectedBudget.status] ?? selectedBudget.status}</Badge>}</CardHeader><CardContent className="space-y-8">
      {selectedBudget.status === 'draft' ? <><BudgetItemForm projectId={projectId} budgetId={selectedBudget.id} groups={groups} /><div className="border-t border-slate-800 pt-5"><ActivateBudgetForm projectId={projectId} budgetId={selectedBudget.id} /></div></> : null}
      <div className="mgl-table-scroll overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="pb-3">Código</th><th>Partida</th><th>Tipo</th><th>Und.</th><th className="text-right">Metrado</th><th className="text-right">P.U.</th><th className="text-right">Presupuesto</th></tr></thead><tbody className="divide-y divide-slate-800">{selectedItems.length === 0 ? <tr><td colSpan={7} className="py-6 text-center text-slate-500">Agrega el primer capítulo o partida.</td></tr> : selectedItems.map((item: BudgetItemRow) => <tr key={item.id} className={item.item_type === 'group' ? 'bg-slate-900/40 font-semibold text-slate-200' : ''}><td className="py-3 font-mono text-xs text-cyan-200">{item.code}</td><td>{item.description}</td><td>{item.item_type === 'group' ? 'Grupo' : 'Partida'}</td><td>{item.item_type === 'group' ? '—' : item.unit_code}</td><td className="text-right">{item.item_type === 'group' ? '—' : Number(item.quantity).toLocaleString('es-PE')}</td><td className="text-right">{item.item_type === 'group' ? '—' : formatMoney(Number(item.unit_price), selectedBudget.currency)}</td><td className="text-right font-semibold">{item.item_type === 'group' ? '—' : formatMoney(Number(item.budget_amount ?? 0), selectedBudget.currency)}</td></tr>)}</tbody></table></div>
    </CardContent></Card> : null}

    {baseline ? <>
      <Card><CardHeader><CardTitle>Control por partida</CardTitle></CardHeader><CardContent className="mgl-table-scroll overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="pb-3">Código</th><th>Partida</th><th>Presupuesto</th><th>Comprometido</th><th>Recibido</th><th>Saldo</th><th>Metrado</th><th>Ejecutado</th><th>Avance</th><th>Valorizado</th></tr></thead><tbody className="divide-y divide-slate-800">{baselineControl.map((item: ControlItemRow) => <tr key={item.budget_item_id}><td className="py-3 font-mono text-xs text-cyan-200">{item.code}</td><td className="max-w-[260px]"><p className="truncate font-medium text-slate-200">{item.description}</p><p className="mt-1 text-[11px] text-slate-600">{item.unit_code}</p></td><td>{formatMoney(Number(item.budget_amount ?? 0), currency)}</td><td>{formatMoney(Number(item.committed_net ?? 0), currency)}</td><td>{formatMoney(Number(item.received_net ?? 0), currency)}</td><td className={Number(item.budget_balance_net ?? 0) < 0 ? 'font-semibold text-red-300' : 'text-emerald-300'}>{formatMoney(Number(item.budget_balance_net ?? 0), currency)}</td><td>{Number(item.quantity ?? 0).toLocaleString('es-PE')}</td><td>{Number(item.executed_quantity ?? 0).toLocaleString('es-PE')}</td><td><div className="w-24"><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-cyan-400" style={{width:`${Math.min(Math.max(Number(item.physical_progress_pct ?? 0),0),100)}%`}} /></div><p className="mt-1 text-[11px] text-slate-500">{pct(Number(item.physical_progress_pct ?? 0))}</p></div></td><td>{formatMoney(Number(item.approved_valuation_net ?? 0), currency)}</td></tr>)}</tbody></table></CardContent></Card>

      <section className="grid gap-8 xl:grid-cols-2"><Card><CardHeader><CardTitle>Registrar avance físico</CardTitle></CardHeader><CardContent><ProgressForm projectId={projectId} items={baselineControl} today={today} /></CardContent></Card><Card><CardHeader><CardTitle>Últimos avances</CardTitle></CardHeader><CardContent className="space-y-2">{progress.length === 0 ? <p className="text-sm text-slate-500">Aún no hay avance físico registrado.</p> : progress.slice(0, 10).map((record: ProgressRow) => { const item = itemById.get(record.budget_item_id); return <div key={record.id} className="flex gap-3 border-b border-slate-800 py-3 last:border-b-0"><div className="flex-1"><p className="text-sm font-semibold text-slate-200">{item?.code ?? '—'} · {item?.description ?? 'Partida'}</p><p className="mt-1 text-xs text-slate-500">{record.progress_on} · +{Number(record.quantity).toLocaleString('es-PE')} {item?.unit_code ?? ''}</p>{record.notes ? <p className="mt-1 text-xs text-slate-600">{record.notes}</p> : null}</div></div>})}</CardContent></Card></section>

      <section className="grid gap-8 xl:grid-cols-[.9fr_1.1fr]"><Card><CardHeader><CardTitle>Nueva valorización</CardTitle></CardHeader><CardContent><ValuationForm projectId={projectId} budgetId={baseline.id} nextNumber={nextValuation} /></CardContent></Card><Card><CardHeader><CardTitle>Valorizaciones</CardTitle></CardHeader><CardContent className="space-y-2">{valuations.length === 0 ? <p className="text-sm text-slate-500">Sin valorizaciones todavía.</p> : valuations.map((valuation: ValuationRow) => <Link key={valuation.id} href={`/app/projects/${projectId}/control/valuations/${valuation.id}`} prefetch className="flex items-center gap-3 border-b border-slate-800 py-3 transition hover:bg-slate-50/5 last:border-b-0"><div className="flex-1"><p className="text-sm font-semibold text-slate-200">Valorización N.º {valuation.number}</p><p className="mt-1 text-xs text-slate-500">{valuation.period_start} → {valuation.period_end} · {formatMoney(data.valuationTotals.get(valuation.id) ?? 0, currency)}</p></div><Badge className={controlStatusClass(valuation.status)}>{valuationStatusLabel[valuation.status] ?? valuation.status}</Badge><ArrowRight className="size-4 text-slate-600" /></Link>)}</CardContent></Card></section>
    </> : <Card><CardContent className="p-6 text-sm text-slate-500">Activa una versión como <strong className="text-slate-300">línea base</strong> para habilitar avance físico, centros de costo y valorizaciones.</CardContent></Card>}
  </div>
}
