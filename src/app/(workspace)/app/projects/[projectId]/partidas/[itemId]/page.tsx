import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/features/finance/format'
import { getBudgetItemCommitments } from '@/features/budget/commitments-server'

const labels: Record<string, string> = {
  material_request: 'Petición',
  purchase_order: 'Orden de compra',
  manual_adjustment: 'Ajuste manual',
  committed: 'Comprometido',
  executed: 'Ejecutado',
  cancelled: 'Cancelado',
  closed: 'Cerrado',
}

export default async function BudgetCommitmentsPage({ params }: { params: Promise<{ projectId: string; itemId: string }> }) {
  const { projectId, itemId } = await params
  const data = await getBudgetItemCommitments(projectId, itemId)
  if (!data.allowed || !data.item) return <div className="text-sm text-slate-500">Sin acceso</div>
  const item = data.item
  const currency = data.commitments[0]?.currency ?? data.company.currency
  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div><p className="font-mono text-xs text-blue-700">{item.code}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{item.description}</h1></div>
      <Link href={`/app/projects/${projectId}/partidas`} className="text-sm font-medium text-blue-700">Volver</Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-4">
      <Metric label="Cotizado" value={formatMoney(Number(item.budget_amount ?? 0), currency)} />
      <Metric label="Comprometido" value={formatMoney(Number(item.committed_amount ?? 0), currency)} />
      <Metric label="Ejecutado" value={formatMoney(Number(item.executed_amount ?? 0), currency)} />
      <Metric label="Disponible" value={formatMoney(Number(item.available_amount ?? 0), currency)} danger={Boolean(item.over_budget)} />
    </div>
    <Card><CardHeader><CardTitle>Compromisos</CardTitle></CardHeader><CardContent className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm"><thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500"><tr><th className="py-3">Tipo</th><th>Origen</th><th className="text-right">Monto</th><th>Estado</th><th>Fecha</th></tr></thead><tbody className="divide-y divide-slate-100">
        {data.commitments.map((row) => <tr key={row.id}><td className="py-3">{labels[row.commitment_type] ?? row.commitment_type}</td><td>{row.source_entity}</td><td className="text-right tabular-nums">{formatMoney(Number(row.amount), row.currency)}</td><td><Badge>{labels[row.status] ?? row.status}</Badge></td><td>{new Date(row.committed_at).toLocaleDateString('es-PE')}</td></tr>)}
      </tbody></table>
      {!data.commitments.length ? <div className="py-8 text-center text-sm text-slate-500">Sin datos</div> : null}
    </CardContent></Card>
  </div>
}

function Metric({label,value,danger=false}:{label:string;value:string;danger?:boolean}) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-lg font-semibold ${danger?'text-red-700':'text-slate-950'}`}>{value}</p></div> }
