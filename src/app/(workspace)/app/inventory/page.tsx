import Link from 'next/link'
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, PackageSearch, Warehouse } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getInventoryOverview } from '@/features/inventory/server'
import { formatMoney } from '@/features/finance/format'
import type { Database } from '@/lib/supabase/database.types'

export const dynamic = 'force-dynamic'

type Summary = Database['public']['Views']['project_inventory_summary']['Row']
type Project = Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'code' | 'name'>

export default async function InventoryOverviewPage() {
  const data = await getInventoryOverview()
  const summaries = new Map<string, Summary>((data.summaries as Summary[]).flatMap((row) => row.project_id ? [[row.project_id, row] as const] : []))
  const projects = data.projects as Project[]
  const stockValue = projects.reduce((sum, project) => sum + Number(summaries.get(project.id)?.stock_value ?? 0), 0)
  const openRequests = projects.reduce((sum, project) => sum + Number(summaries.get(project.id)?.open_requests ?? 0), 0)
  const lowStock = projects.reduce((sum, project) => sum + Number(summaries.get(project.id)?.low_stock_count ?? 0), 0)

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="mt-2 text-3xl font-black tracking-tight text-white">Almacén e inventario</h1></div><Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">Stock derivado de movimientos contabilizados</Badge></div>

    <section className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Valor de stock</p><p className="mt-2 text-2xl font-black text-white">{formatMoney(stockValue, data.company.currency)}</p></div><Boxes className="size-5 text-cyan-300" /></div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Requerimientos abiertos</p><p className="mt-2 text-3xl font-black text-white">{openRequests}</p></div><ClipboardList className="size-5 text-amber-300" /></div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Alertas de stock</p><p className="mt-2 text-3xl font-black text-white">{lowStock}</p></div><AlertTriangle className="size-5 text-red-300" /></div></CardContent></Card>
    </section>

    <Card><CardHeader><CardTitle>Inventario por proyecto</CardTitle><CardDescription>Los saldos no se editan manualmente: se reconstruyen desde ingresos, salidas y transferencias publicadas.</CardDescription></CardHeader><CardContent className="space-y-3">
      {projects.length === 0 ? <p className="text-sm text-slate-500">Sin proyectos</p> : projects.map((project) => {
        const summary = summaries.get(project.id)
        return <Link key={project.id} href={`/app/projects/${project.id}/inventory`} prefetch className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-4 transition hover:border-cyan-400/30 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-100">{project.code} · {project.name}</p><p className="mt-1 text-xs text-slate-500">{Number(summary?.warehouse_count ?? 0)} almacenes · {Number(summary?.sku_in_stock ?? 0)} SKU con existencia</p></div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:w-[470px]"><div><p className="text-[11px] text-slate-500">Stock</p><p className="mt-1 text-sm font-semibold text-white">{formatMoney(Number(summary?.stock_value ?? 0), data.company.currency)}</p></div><div><p className="text-[11px] text-slate-500">Req. abiertos</p><p className="mt-1 text-sm font-semibold text-white">{Number(summary?.open_requests ?? 0)}</p></div><div><p className="text-[11px] text-slate-500">Stock bajo</p><p className="mt-1 text-sm font-semibold text-amber-200">{Number(summary?.low_stock_count ?? 0)}</p></div></div>
          <ArrowRight className="hidden size-5 text-slate-600 lg:block" />
        </Link>
      })}
    </CardContent></Card>

    <div className="grid gap-4 md:grid-cols-2"><Card><CardContent className="flex items-start gap-3 p-5"><Warehouse className="mt-0.5 size-5 text-cyan-300" /><div><p className="font-semibold text-slate-200">Trazabilidad por almacén</p><p className="mt-1 text-sm text-slate-500">Cada movimiento conserva origen, destino, material, usuario, fecha y costo.</p></div></CardContent></Card><Card><CardContent className="flex items-start gap-3 p-5"><PackageSearch className="mt-0.5 size-5 text-emerald-300" /><div><p className="font-semibold text-slate-200">Costo promedio</p><p className="mt-1 text-sm text-slate-500">Las salidas y transferencias usan el costo promedio vigente del almacén, calculado por el servidor.</p></div></CardContent></Card></div>
  </div>
}
