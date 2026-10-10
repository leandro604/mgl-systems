import Link from 'next/link'
import { Building2, ShoppingCart } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SupplierForm } from '@/features/purchases/forms'
import { getPurchasesOverview } from '@/features/purchases/server'
import { financialStatusClass, formatMoney, purchaseStatusLabel } from '@/features/finance/format'

export const dynamic = 'force-dynamic'
export default async function PurchasesPage(){
 const data=await getPurchasesOverview()
 if(!data.allowed) return <Card><CardHeader><CardTitle>Compras</CardTitle><CardDescription>Este módulo está disponible para administradores y PM.</CardDescription></CardHeader></Card>
 const projectNames=new Map(data.projects.map(p=>[p.id,p.name]))
 const committed=data.summaries.reduce((s,r)=>s+Number(r.committed_cost??0),0)
 const received=data.summaries.reduce((s,r)=>s+Number(r.received_cost??0),0)
 return <div className="mx-auto max-w-7xl space-y-6">
  <div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Abastecimiento</p><h1 className="mt-2 text-3xl font-black text-white">Compras y proveedores</h1><p className="mt-2 text-sm text-slate-400">Órdenes, proveedores y costo operativo por proyecto.</p></div>
  <section className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="text-xs text-slate-500">Costo comprometido</p><p className="mt-2 text-2xl font-black text-white">{formatMoney(committed,data.company.currency)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-slate-500">Costo recibido</p><p className="mt-2 text-2xl font-black text-white">{formatMoney(received,data.company.currency)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-slate-500">Proveedores activos</p><p className="mt-2 text-2xl font-black text-white">{data.suppliers.length}</p></CardContent></Card></section>
  <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-4 text-cyan-300"/>Nuevo proveedor</CardTitle><CardDescription>Maestro de proveedores de la empresa.</CardDescription></CardHeader><CardContent><SupplierForm/></CardContent></Card><Card><CardHeader><CardTitle>Proveedores</CardTitle><CardDescription>Disponibles para nuevas órdenes.</CardDescription></CardHeader><CardContent className="space-y-2">{data.suppliers.length===0?<p className="text-sm text-slate-500">Aún no hay proveedores.</p>:data.suppliers.map(s=><div key={s.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="font-medium text-slate-200">{s.legal_name}</p><p className="mt-1 text-xs text-slate-500">{s.ruc??'Sin RUC'}{s.contact_name?` · ${s.contact_name}`:''}</p></div>)}</CardContent></Card></section>
  <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle className="flex items-center gap-2"><ShoppingCart className="size-4 text-cyan-300"/>Órdenes de compra</CardTitle><CardDescription>Todos los proyectos visibles.</CardDescription></div></CardHeader><CardContent className="space-y-2">{data.orders.length===0?<p className="text-sm text-slate-500">Aún no hay órdenes. Entra a un proyecto para crear la primera.</p>:data.orders.map(o=><Link key={o.id} href={`/app/projects/${o.project_id}/purchases/${o.id}`} className="flex items-center gap-3 rounded-xl border border-slate-800 p-3 hover:border-cyan-400/30"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{o.number} · {o.supplier_name}</p><p className="mt-1 text-xs text-slate-500">{projectNames.get(o.project_id)??'Proyecto'} · {formatMoney(data.totals.get(o.id),o.currency)}</p></div><Badge className={financialStatusClass(o.status)}>{purchaseStatusLabel[o.status]??o.status}</Badge></Link>)}</CardContent></Card>
  <div className="flex flex-wrap gap-2">{data.projects.map(p=><Button key={p.id} asChild variant="secondary" size="sm"><Link href={`/app/projects/${p.id}/purchases`}>{p.code} · Compras</Link></Button>)}</div>
 </div>
}
