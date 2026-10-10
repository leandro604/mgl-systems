import { CheckCircle2, Package, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getMaterialRequestDetail } from '@/features/inventory/server'
import { inventoryStatusClass, requestStatusLabel } from '@/features/inventory/format'
import { MaterialRequestLineForm, MaterialRequestTransitionForm } from '@/features/inventory/forms'

export default async function MaterialRequestDetailPage({ params }: { params: Promise<{ projectId: string; requestId: string }> }) {
  const { projectId, requestId } = await params
  const data = await getMaterialRequestDetail(projectId, requestId)
  const request = data.request
  const materialById = new Map(data.materials.map((item) => [item.id, item]))
  const budgetById = new Map(data.budgetItems.flatMap((item) => item.budget_item_id ? [[item.budget_item_id, item] as const] : []))
  const profileById = new Map(data.profiles.map((item) => [item.user_id, item]))
  const fulfillmentByItem = new Map(data.requestFulfillment.flatMap((item) => item.request_item_id ? [[item.request_item_id, item] as const] : []))
  const requester = profileById.get(request.requested_by)
  const approver = request.approved_by ? profileById.get(request.approved_by) : null

  return <div className="space-y-5">
    <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{request.number}</CardTitle><CardDescription>{request.needed_on ? `Necesario para ${request.needed_on}` : 'Sin fecha requerida'} · creado {new Date(request.created_at).toLocaleDateString('es-PE')}</CardDescription></div><Badge className={inventoryStatusClass(request.status)}>{requestStatusLabel[request.status] ?? request.status}</Badge></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div className="flex gap-2 text-sm text-slate-400"><UserRound className="size-4 text-cyan-300" />Solicita: <span className="text-slate-200">{requester?.full_name ?? 'Usuario'}</span></div>{approver ? <div className="flex gap-2 text-sm text-slate-400"><CheckCircle2 className="size-4 text-emerald-300" />Aprueba: <span className="text-slate-200">{approver.full_name}</span></div> : null}</div>{request.notes ? <p className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-400">{request.notes}</p> : null}<MaterialRequestTransitionForm projectId={projectId} requestId={requestId} status={request.status} canManage={data.canManage} isRequester={request.requested_by === data.userId} /></CardContent></Card>

    {request.status === 'draft' ? <Card><CardHeader><CardTitle>Agregar material</CardTitle><CardDescription>Puedes asociar la necesidad a una partida de la línea base para mantener trazabilidad de costo.</CardDescription></CardHeader><CardContent><MaterialRequestLineForm projectId={projectId} requestId={requestId} materials={data.materials} budgetItems={data.budgetItems} /></CardContent></Card> : null}

    <Card><CardHeader><CardTitle>Materiales solicitados</CardTitle><CardDescription>La cantidad atendida se calcula exclusivamente desde salidas de almacén contabilizadas.</CardDescription></CardHeader><CardContent className="space-y-3">{data.items.length === 0 ? <p className="text-sm text-slate-500">Agrega al menos un material antes de enviar el requerimiento.</p> : data.items.map((item) => { const material = materialById.get(item.material_id); const budget = item.budget_item_id ? budgetById.get(item.budget_item_id) : null; const fulfillment = fulfillmentByItem.get(item.id); const requested = Number(item.quantity); const fulfilled = Number(fulfillment?.fulfilled_quantity ?? 0); const pct = requested > 0 ? Math.min(fulfilled / requested * 100, 100) : 0; return <div key={item.id} className="rounded-2xl border border-slate-800 p-4"><div className="flex items-start gap-3"><Package className="mt-0.5 size-5 text-cyan-300" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-100">{material?.sku ?? '—'} · {material?.name ?? 'Material'}</p><p className="mt-1 text-xs text-slate-500">Solicitado {requested.toLocaleString('es-PE')} {material?.unit_code ?? ''} · atendido {fulfilled.toLocaleString('es-PE')} · pendiente {Number(fulfillment?.remaining_quantity ?? requested).toLocaleString('es-PE')}</p>{budget ? <p className="mt-1 text-xs text-cyan-300">Centro de costo {budget.code} · {budget.description}</p> : null}{item.notes ? <p className="mt-1 text-xs text-slate-600">{item.notes}</p> : null}<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${pct}%` }} /></div></div></div></div>})}</CardContent></Card>
  </div>
}
