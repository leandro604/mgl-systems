import Link from 'next/link'
import { AlertTriangle, ArrowRight, Boxes, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  return <div className="mx-auto max-w-7xl space-y-8">
    <div><h1 className="text-2xl font-semibold tracking-tight text-white">Almacén e inventario</h1></div>

    <section className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Valor de stock</p><p className="mt-2 text-3xl font-semibold tabular-nums text-white">{formatMoney(stockValue, data.company.currency)}</p></div><Boxes className="size-5 text-cyan-300" /></div></CardContent></Card>
      <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Requerimientos abiertos</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{openRequests}</p></div><ClipboardList className="size-5 text-amber-300" /></div></CardContent></Card>
      <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">Alertas de stock</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{lowStock}</p></div><AlertTriangle className="size-5 text-red-300" /></div></CardContent></Card>
    </section>

    <Card><CardHeader><CardTitle>Inventario por proyecto</CardTitle></CardHeader><CardContent className="divide-y divide-slate-100">
      {projects.length === 0 ? <p className="text-sm text-slate-500">Sin proyectos</p> : projects.map((project) => {
        const summary = summaries.get(project.id)
        return <Link key={project.id} href={`/app/projects/${project.id}/inventory`} prefetch className="flex flex-col gap-4 py-3 transition hover:bg-slate-50/5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-100">{project.code} · {project.name}</p><p className="mt-1 text-xs text-slate-500">{Number(summary?.warehouse_count ?? 0)} almacenes · {Number(summary?.sku_in_stock ?? 0)} SKU con existencia</p></div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:w-[470px]"><div><p className="text-[11px] text-slate-500">Stock</p><p className="mt-1 text-sm font-semibold text-white">{formatMoney(Number(summary?.stock_value ?? 0), data.company.currency)}</p></div><div><p className="text-[11px] text-slate-500">Req. abiertos</p><p className="mt-1 text-sm font-semibold text-white">{Number(summary?.open_requests ?? 0)}</p></div><div><p className="text-[11px] text-slate-500">Stock bajo</p><p className="mt-1 text-sm font-semibold text-amber-200">{Number(summary?.low_stock_count ?? 0)}</p></div></div>
          <ArrowRight className="hidden size-5 text-slate-600 lg:block" />
        </Link>
      })}
    </CardContent></Card>

  </div>
}
