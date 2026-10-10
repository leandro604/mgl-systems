import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PurchaseOrderLineForm, PurchaseOrderTransitionForm } from '@/features/purchases/forms'
import { getPurchaseOrderDetail } from '@/features/purchases/server'
import { financialStatusClass, formatMoney, purchaseStatusLabel } from '@/features/finance/format'

export default async function Page({ params }: { params: Promise<{ projectId: string; orderId: string }> }) {
  const { projectId, orderId } = await params
  const data = await getPurchaseOrderDetail(projectId, orderId)
  if (!data.allowed || !data.order) return <Card><CardHeader><CardTitle>Orden de compra</CardTitle><CardDescription>Sin acceso.</CardDescription></CardHeader></Card>
  const order = data.order
  const budgetById = new Map(data.budgetItems.flatMap((item) => item.budget_item_id ? [[item.budget_item_id, item] as const] : []))
  const materialById = new Map(data.materials.map((item) => [item.id, item]))
  const stockCurrencyCompatible = order.currency === data.company.currency

  return <div className="space-y-5">
    <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{order.number} · {order.supplier_name}</CardTitle><CardDescription>{order.supplier_ruc ?? 'Sin RUC'} · {order.ordered_on}{order.expected_on ? ` · entrega ${order.expected_on}` : ''}</CardDescription></div><Badge className={financialStatusClass(order.status)}>{purchaseStatusLabel[order.status] ?? order.status}</Badge></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Neto</p><p className="mt-1 font-semibold text-white">{formatMoney(Number(data.total?.net_amount ?? 0), order.currency)}</p></div><div><p className="text-xs text-slate-500">IGV</p><p className="mt-1 font-semibold text-white">{formatMoney(Number(data.total?.tax_amount ?? 0), order.currency)}</p></div><div><p className="text-xs text-slate-500">Total</p><p className="mt-1 text-xl font-black text-cyan-200">{formatMoney(Number(data.total?.total_amount ?? 0), order.currency)}</p></div></div><PurchaseOrderTransitionForm projectId={projectId} orderId={orderId} status={order.status} /></CardContent></Card>

    {order.status === 'draft' ? <Card><CardHeader><CardTitle>Agregar partida</CardTitle><CardDescription>MVP financiero: operaciones gravadas con IGV 18 %. Puedes vincular cada línea a un centro de costo de la línea base.</CardDescription></CardHeader><CardContent className="space-y-4">{!stockCurrencyCompatible ? <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">Esta OC está en {order.currency}. El control de almacén de Fase 7 valoriza en {data.company.currency}; por eso sus partidas no pueden vincularse a stock sin una futura capa de tipo de cambio.</p> : null}<PurchaseOrderLineForm projectId={projectId} orderId={orderId} budgetItems={data.budgetItems} materials={stockCurrencyCompatible ? data.materials : []} /></CardContent></Card> : null}

    <Card><CardHeader><CardTitle>Partidas</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="pb-3">#</th><th>Centro de costo</th><th>Material almacén</th><th>Descripción</th><th>Unidad</th><th>Cant.</th><th>P. unit.</th><th>Neto</th><th>IGV</th></tr></thead><tbody className="divide-y divide-slate-800">{data.items.map((item) => { const budget = item.budget_item_id ? budgetById.get(item.budget_item_id) : null; const material = item.material_id ? materialById.get(item.material_id) : null; return <tr key={item.id}><td className="py-3">{item.line_number}</td><td className="font-mono text-xs text-cyan-200">{budget?.code ?? 'Sin asignar'}</td><td>{material ? `${material.sku} · ${material.name}` : 'No aplica'}</td><td>{item.description}</td><td>{item.unit_code}</td><td>{item.quantity}</td><td>{formatMoney(item.unit_price, order.currency)}</td><td>{formatMoney(item.net_amount, order.currency)}</td><td>{formatMoney(item.tax_amount, order.currency)}</td></tr> })}</tbody></table></CardContent></Card>
  </div>
}
