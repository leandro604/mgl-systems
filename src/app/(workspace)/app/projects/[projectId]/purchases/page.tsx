import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FormDrawerTrigger } from '@/components/ui/form-drawer-trigger'
import { PurchaseOrderForm } from '@/features/purchases/forms'
import { getProjectPurchases } from '@/features/purchases/server'
import { formatMoney, purchaseStatusLabel } from '@/features/finance/format'

function statusVariant(status:string){if(status==='received')return 'success' as const;if(status==='issued')return 'info' as const;if(status==='cancelled')return 'danger' as const;return 'neutral' as const}

export default async function Page({params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params
  const d=await getProjectPurchases(projectId)
  if(!d.allowed)return <Card><CardHeader><CardTitle>Compras</CardTitle><CardDescription>Tu rol no tiene acceso financiero.</CardDescription></CardHeader></Card>
  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><h2 className="text-lg font-medium tracking-tight text-slate-950">Compras</h2><FormDrawerTrigger title="Nueva orden de compra" label="Nueva orden de compra"><PurchaseOrderForm projectId={projectId} suppliers={d.suppliers} currency={d.company.currency}/></FormDrawerTrigger></div>
    <section className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="pt-6"><p className="text-xs text-slate-400">Comprometido</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(Number(d.summary?.committed_cost??0),d.company.currency)}</p></CardContent></Card><Card><CardContent className="pt-6"><p className="text-xs text-slate-400">Recibido</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(Number(d.summary?.received_cost??0),d.company.currency)}</p></CardContent></Card><Card><CardContent className="pt-6"><p className="text-xs text-slate-400">Borradores</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{d.summary?.purchase_drafts??0}</p></CardContent></Card></section>
    <Card><CardHeader><CardTitle>Órdenes del proyecto</CardTitle></CardHeader><CardContent className="mgl-table-scroll overflow-x-auto">{d.orders.length===0?<p className="text-sm text-slate-400">Sin órdenes</p>:<table className="mgl-table-compact min-w-full"><thead><tr><th className="text-left">Código</th><th className="text-left">Proveedor</th><th className="text-right">Monto</th><th className="text-left">Fecha</th><th className="text-right">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{d.orders.map(o=><tr key={o.id} className="hover:bg-slate-50"><td><Link href={`/app/projects/${projectId}/purchases/${o.id}`} className="font-medium text-blue-700">{o.number}</Link></td><td>{o.supplier_name}</td><td className="text-right tabular-nums">{formatMoney(d.totals.get(o.id),o.currency)}</td><td>{o.ordered_on}</td><td className="text-right"><Badge variant={statusVariant(o.status)}>{purchaseStatusLabel[o.status]??o.status}</Badge></td></tr>)}</tbody></table>}</CardContent></Card>
  </div>
}
