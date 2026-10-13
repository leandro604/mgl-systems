import Link from 'next/link'
import { Building2, ShoppingCart } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SupplierForm } from '@/features/purchases/forms'
import { getPurchasesOverview } from '@/features/purchases/server'
import { financialStatusClass, formatMoney, purchaseStatusLabel } from '@/features/finance/format'

export const dynamic = 'force-dynamic'

export default async function PurchasesPage() {
  const data = await getPurchasesOverview()
  if (!data.allowed) return <Card><CardHeader><CardTitle>Compras</CardTitle><CardDescription>Este módulo está disponible para administradores y PM.</CardDescription></CardHeader></Card>

  const projectNames = new Map(data.projects.map((project) => [project.id, project.name]))
  const committed = data.summaries.reduce((sum, row) => sum + Number(row.committed_cost ?? 0), 0)
  const received = data.summaries.reduce((sum, row) => sum + Number(row.received_cost ?? 0), 0)

  return <div className="mx-auto max-w-7xl space-y-8">
    <div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Abastecimiento</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Compras y proveedores</h1></div>

    <section className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent className="p-6"><p className="text-xs text-slate-400">Costo comprometido</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(committed, data.company.currency)}</p></CardContent></Card>
      <Card><CardContent className="p-6"><p className="text-xs text-slate-400">Costo recibido</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{formatMoney(received, data.company.currency)}</p></CardContent></Card>
      <Card><CardContent className="p-6"><p className="text-xs text-slate-400">Proveedores activos</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{data.suppliers.length}</p></CardContent></Card>
    </section>

    <section className="grid gap-8 xl:grid-cols-[.9fr_1.1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-4 text-blue-600"/>Nuevo proveedor</CardTitle></CardHeader><CardContent><SupplierForm/></CardContent></Card>
      <Card><CardHeader><CardTitle>Proveedores</CardTitle></CardHeader><CardContent><div className="divide-y divide-slate-100">{data.suppliers.length === 0 ? <p className="py-6 text-sm text-slate-400">Sin proveedores</p> : data.suppliers.map((supplier) => <div key={supplier.id} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-medium text-slate-900">{supplier.legal_name}</p><p className="mt-0.5 text-xs text-slate-400">{supplier.ruc ?? 'Sin RUC'}{supplier.contact_name ? ` · ${supplier.contact_name}` : ''}</p></div>)}</div></CardContent></Card>
    </section>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="size-4 text-blue-600"/>Órdenes de compra</CardTitle></CardHeader>
      <CardContent className="mgl-table-scroll overflow-x-auto">
        {data.orders.length === 0 ? <p className="text-sm text-slate-400">Sin órdenes</p> : <table className="mgl-table-compact min-w-[760px] w-full">
          <thead><tr><th className="text-left">Código</th><th className="text-left">Proveedor</th><th className="text-right">Monto</th><th className="text-left">Fecha</th><th className="text-right">Estado</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.orders.map((order) => <tr key={order.id} className="hover:bg-slate-50"><td><Link href={`/app/projects/${order.project_id}/purchases/${order.id}`} className="font-medium text-blue-700">{order.number}</Link><p className="mt-0.5 text-xs text-slate-400">{projectNames.get(order.project_id) ?? 'Proyecto'}</p></td><td>{order.supplier_name}</td><td className="text-right tabular-nums">{formatMoney(data.totals.get(order.id), order.currency)}</td><td>{order.ordered_on}</td><td className="text-right"><Badge className={financialStatusClass(order.status)}>{purchaseStatusLabel[order.status] ?? order.status}</Badge></td></tr>)}</tbody>
        </table>}
      </CardContent>
    </Card>

    <div className="flex flex-wrap gap-2">{data.projects.map((project) => <Button key={project.id} asChild variant="secondary" size="sm"><Link href={`/app/projects/${project.id}/purchases`}>{project.code} · Compras</Link></Button>)}</div>
  </div>
}
