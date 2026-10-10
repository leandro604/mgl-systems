import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ValuationLineForm, ValuationTransitionForm } from '@/features/control/forms'
import { controlStatusClass, valuationStatusLabel } from '@/features/control/format'
import { getValuationDetail } from '@/features/control/server'
import { formatMoney } from '@/features/finance/format'
import type { Database } from '@/lib/supabase/database.types'

type BudgetRow = Database['public']['Tables']['project_budgets']['Row']
type BudgetItemRow = Database['public']['Tables']['budget_items']['Row']
type ValuationItemRow = Database['public']['Tables']['valuation_items']['Row']

export default async function ValuationDetailPage({ params }: { params: Promise<{ projectId: string; valuationId: string }> }) {
  const { projectId, valuationId } = await params
  const data = await getValuationDetail(projectId, valuationId)
  if (!data.allowed || !data.valuation) return <Card><CardHeader><CardTitle>Valorización</CardTitle><CardDescription>Sin acceso.</CardDescription></CardHeader></Card>
  const valuation = data.valuation
  const budgets = data.budgets as BudgetRow[]
  const valuationBudgetItems = data.valuationBudgetItems as BudgetItemRow[]
  const lines = data.items as ValuationItemRow[]
  const budget = budgets.find((item: BudgetRow) => item.id === valuation.budget_id)
  const currency = budget?.currency ?? data.company.currency
  const byId = new Map<string, BudgetItemRow>(valuationBudgetItems.map((item: BudgetItemRow) => [item.id, item]))
  const availableItems = valuationBudgetItems.filter((item: BudgetItemRow) => !lines.some((line: ValuationItemRow) => line.budget_item_id === item.id))

  return <div className="space-y-5"><Button asChild variant="ghost" size="sm"><Link href={`/app/projects/${projectId}/control`}><ArrowLeft />Volver a control</Link></Button>
    <Card><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Valorización N.º {valuation.number}</CardTitle><CardDescription>{valuation.period_start} → {valuation.period_end} · {budget?.name ?? 'Línea base'}</CardDescription></div><Badge className={controlStatusClass(valuation.status)}>{valuationStatusLabel[valuation.status] ?? valuation.status}</Badge></CardHeader><CardContent className="space-y-4"><div><p className="text-xs text-slate-500">Monto neto</p><p className="mt-1 text-3xl font-black text-cyan-200">{formatMoney(data.total, currency)}</p></div>{valuation.notes ? <p className="text-sm text-slate-400">{valuation.notes}</p> : null}<ValuationTransitionForm projectId={projectId} valuationId={valuationId} status={valuation.status} /></CardContent></Card>

    {valuation.status === 'draft' ? <Card><CardHeader><CardTitle>Agregar partida</CardTitle><CardDescription>La base de datos toma el precio unitario de la línea base; solo ingresas el metrado del periodo.</CardDescription></CardHeader><CardContent><ValuationLineForm projectId={projectId} valuationId={valuationId} items={availableItems.map((item: BudgetItemRow) => ({ id: item.id, code: item.code, description: item.description, unit_code: item.unit_code, unit_price: Number(item.unit_price) }))} /></CardContent></Card> : null}

    <Card><CardHeader><CardTitle>Detalle valorizado</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="pb-3">Código</th><th>Partida</th><th>Unidad</th><th>Metrado</th><th>P.U.</th><th>Parcial</th></tr></thead><tbody className="divide-y divide-slate-800">{lines.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-slate-500">Agrega las partidas valorizadas del periodo.</td></tr> : lines.map((line: ValuationItemRow) => { const item = byId.get(line.budget_item_id); return <tr key={line.id}><td className="py-3 font-mono text-xs text-cyan-200">{item?.code ?? '—'}</td><td>{item?.description ?? 'Partida'}</td><td>{item?.unit_code ?? '—'}</td><td>{Number(line.quantity).toLocaleString('es-PE')}</td><td>{formatMoney(Number(line.unit_price), currency)}</td><td className="font-semibold text-white">{formatMoney(Number(line.amount ?? 0), currency)}</td></tr>})}</tbody></table></CardContent></Card>
  </div>
}
