import Link from 'next/link'
import { AlertTriangle, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormDrawerTrigger } from '@/components/ui/form-drawer-trigger'
import { formatMoney } from '@/features/finance/format'
import { getProjectInventory } from '@/features/inventory/server'
import { movementLabel, requestStatusLabel, stockHealth, stockHealthLabel } from '@/features/inventory/format'
import { ManualIssueForm, ManualReceiptForm, MaterialForm, MaterialRequestForm, PurchaseReceiptForm, RequestIssueForm, TransferForm, WarehouseForm } from '@/features/inventory/forms'
import type { Database } from '@/lib/supabase/database.types'

export const dynamic = 'force-dynamic'
type StockRow = Database['public']['Views']['inventory_stock']['Row']
type FulfillmentRow = Database['public']['Views']['material_request_fulfillment']['Row']

function requestVariant(status:string){if(['approved','fulfilled','delivered'].includes(status))return 'success' as const;if(['submitted','pending'].includes(status))return 'info' as const;if(status==='rejected')return 'danger' as const;return 'neutral' as const}
function movementVariant(status:string){return status==='posted'?'success' as const:status==='cancelled'?'danger' as const:'neutral' as const}

export default async function ProjectInventoryPage({params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params
  const data=await getProjectInventory(projectId)
  const materialById=new Map(data.materials.map((item)=>[item.id,item]))
  const warehouseById=new Map(data.warehouses.map((item)=>[item.id,item]))
  const requestById=new Map(data.requests.map((item)=>[item.id,item]))
  const purchaseById=new Map(data.purchaseOrders.map((item)=>[item.id,item]))
  const summary=data.summary
  const currency=data.company.currency
  const stockRows=(data.stock as StockRow[]).filter((row)=>Number(row.quantity??0)!==0)
  const issueOptions=(data.fulfillment as FulfillmentRow[]).flatMap((row)=>{if(!row.request_item_id||!row.material_id||row.status!=='approved'||Number(row.remaining_quantity??0)<=0)return[];const material=materialById.get(row.material_id);return[{request_item_id:row.request_item_id,request_number:row.number??'REQ',material_name:material?.name??'Material',remaining_quantity:Number(row.remaining_quantity??0),unit_code:material?.unit_code??''}]})
  const purchaseOptions=data.purchaseItems.flatMap((line)=>{if(!line.material_id)return[];const order=purchaseById.get(line.purchase_order_id);const material=materialById.get(line.material_id);if(!order||!material)return[];return[{purchase_order_item_id:line.id,order_number:order.number,material_name:material.name,description:line.description,remaining_quantity:Number(line.quantity),unit_code:line.unit_code}]})

  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">{data.project.code}</p><h2 className="mt-2 text-lg font-medium tracking-tight text-slate-950">Almacén y materiales</h2></div><div className="flex items-center gap-3"><span className="text-xs text-slate-400">{data.canManage?'Gestión habilitada':'Consulta + requerimientos'}</span><FormDrawerTrigger title="Nuevo requerimiento" label="Nuevo requerimiento"><MaterialRequestForm projectId={projectId}/></FormDrawerTrigger></div></div>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {[['Valor stock',formatMoney(Number(summary?.stock_value??0),currency)],['SKU con stock',Number(summary?.sku_in_stock??0)],['Almacenes',Number(summary?.warehouse_count??0)],['Req. abiertos',Number(summary?.open_requests??0)],['Stock bajo',Number(summary?.low_stock_count??0)]].map(([label,value])=><Card key={String(label)}><CardContent className="pt-6"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{value}</p></CardContent></Card>)}
    </section>

    {data.canSetup?<section className="grid gap-8 xl:grid-cols-2"><Card><CardHeader><CardTitle>Catálogo de materiales</CardTitle></CardHeader><CardContent><MaterialForm/></CardContent></Card><Card><CardHeader><CardTitle>Nuevo almacén</CardTitle></CardHeader><CardContent><WarehouseForm projectId={projectId} profiles={data.profiles}/></CardContent></Card></section>:null}

    <section className="grid gap-8 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Materiales disponibles</CardTitle></CardHeader><CardContent className="mgl-table-scroll overflow-x-auto">{!data.materials.length?<p className="text-sm text-slate-400">Sin materiales</p>:<table className="mgl-table-compact min-w-full"><thead><tr><th className="text-left">Código</th><th className="text-left">Nombre</th><th className="text-left">Categoría</th><th className="text-left">Unidad</th></tr></thead><tbody className="divide-y divide-slate-100">{data.materials.slice(0,12).map((material)=><tr key={material.id} className="hover:bg-slate-50"><td className="font-mono text-xs text-slate-600">{material.sku}</td><td className="font-medium text-slate-900">{material.name}</td><td>{material.category||'—'}</td><td>{material.unit_code}</td></tr>)}</tbody></table>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Almacenes del proyecto</CardTitle></CardHeader><CardContent><div className="divide-y divide-slate-100">{data.warehouses.map((warehouse)=><div key={warehouse.id} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-medium text-slate-900">{warehouse.code} · {warehouse.name}</p><p className="mt-1 text-xs text-slate-400">{warehouse.location||'—'}</p></div>)}{!data.warehouses.length?<p className="text-sm text-slate-400">Sin almacenes</p>:null}</div></CardContent></Card>
    </section>

    <Card><CardHeader><CardTitle>Requerimientos</CardTitle></CardHeader><CardContent className="mgl-table-scroll overflow-x-auto">{!data.requests.length?<p className="text-sm text-slate-400">Sin requerimientos</p>:<table className="mgl-table-compact min-w-full"><thead><tr><th className="text-left">Código</th><th className="text-left">Descripción</th><th className="text-left">Necesario</th><th className="text-right">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{data.requests.slice(0,12).map((request)=><tr key={request.id} className="hover:bg-slate-50"><td><Link href={`/app/projects/${projectId}/inventory/requests/${request.id}`} prefetch className="font-medium text-blue-700">{request.number}</Link></td><td>{request.title||'Requerimiento'}</td><td>{request.needed_on||'—'}</td><td className="text-right"><Badge variant={requestVariant(request.status)}>{requestStatusLabel[request.status]??request.status}</Badge></td></tr>)}</tbody></table>}</CardContent></Card>

    {data.canManage?<section className="grid gap-8 xl:grid-cols-2"><Card><CardHeader><CardTitle>Ingreso manual</CardTitle></CardHeader><CardContent><ManualReceiptForm projectId={projectId} warehouses={data.warehouses} materials={data.materials}/></CardContent></Card><Card><CardHeader><CardTitle>Salida por requerimiento</CardTitle></CardHeader><CardContent><RequestIssueForm projectId={projectId} warehouses={data.warehouses} options={issueOptions}/></CardContent></Card><Card><CardHeader><CardTitle>Transferencia</CardTitle></CardHeader><CardContent><TransferForm projectId={projectId} warehouses={data.warehouses} materials={data.materials}/></CardContent></Card><Card><CardHeader><CardTitle>Salida por ajuste</CardTitle></CardHeader><CardContent><ManualIssueForm projectId={projectId} warehouses={data.warehouses} materials={data.materials}/></CardContent></Card>{data.canSetup?<Card><CardHeader><CardTitle>Recepción de compra</CardTitle></CardHeader><CardContent><PurchaseReceiptForm projectId={projectId} warehouses={data.warehouses} options={purchaseOptions}/></CardContent></Card>:null}</section>:null}

    <Card><CardHeader><CardTitle>Existencias por almacén</CardTitle></CardHeader><CardContent className="mgl-table-scroll overflow-x-auto">{!stockRows.length?<p className="text-sm text-slate-400">Sin existencias</p>:<table className="mgl-table-compact min-w-[820px] w-full"><thead><tr><th className="text-left">Almacén</th><th className="text-left">SKU</th><th className="text-left">Material</th><th className="text-right">Existencia</th><th className="text-right">Costo prom.</th><th className="text-right">Valor</th><th className="text-right">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{stockRows.map((row)=>{const material=row.material_id?materialById.get(row.material_id):null;const warehouse=row.warehouse_id?warehouseById.get(row.warehouse_id):null;const qty=Number(row.quantity??0);const min=Number(material?.min_stock??0);const state=stockHealth(qty,min);return <tr key={`${row.warehouse_id}-${row.material_id}`} className="hover:bg-slate-50"><td className="font-medium text-slate-900">{warehouse?.code??'—'} · {warehouse?.name??'Almacén'}</td><td className="font-mono text-xs">{material?.sku??'—'}</td><td>{material?.name??'Material'}</td><td className="text-right tabular-nums">{qty.toLocaleString('es-PE')} {material?.unit_code??''}</td><td className="text-right tabular-nums">{formatMoney(Number(row.average_unit_cost??0),currency)}</td><td className="text-right tabular-nums">{formatMoney(Number(row.stock_value??0),currency)}</td><td className="text-right"><Badge variant={state==='ok'?'success':state==='low'?'warning':'danger'}>{stockHealthLabel(qty,min)}</Badge></td></tr>})}</tbody></table>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Últimos movimientos</CardTitle></CardHeader><CardContent><div className="divide-y divide-slate-100">{data.transactions.map((tx)=>{const source=tx.source_warehouse_id?warehouseById.get(tx.source_warehouse_id):null;const target=tx.target_warehouse_id?warehouseById.get(tx.target_warehouse_id):null;const request=tx.material_request_id?requestById.get(tx.material_request_id):null;return <div key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><History className="size-4 shrink-0 text-slate-400"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{tx.number} · {movementLabel[tx.movement_type]??tx.movement_type}</p><p className="mt-1 text-xs text-slate-400">{new Date(tx.occurred_at).toLocaleString('es-PE')} {source?`· ${source.code}`:''}{source&&target?' → ':''}{target?target.code:''}{request?` · ${request.number}`:''}</p></div><Badge variant={movementVariant(tx.status)}>{tx.status==='posted'?'Contabilizado':tx.status}</Badge></div>})}{!data.transactions.length?<p className="text-sm text-slate-400">Sin movimientos</p>:null}</div></CardContent></Card>

    {Number(summary?.low_stock_count??0)>0?<div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 size-5 shrink-0"/><span>Hay materiales bajo el mínimo configurado.</span></div>:null}
  </div>
}
