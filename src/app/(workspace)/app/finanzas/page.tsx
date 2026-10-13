import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canAccessFinancialModules } from '@/features/auth/roles'

export default async function FinanceEsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, ctx] = await Promise.all([searchParams, requireWorkspaceContext()])
  if (!canAccessFinancialModules(ctx.profile.role)) redirect('/app')

  const active = typeof tab === 'string' ? tab : 'facturas'
  const ids = ctx.projects.map((project) => project.id)
  const { data, error } = ids.length
    ? await ctx.supabase.from('invoices').select('*').in('project_id', ids).is('deleted_at', null).order('created_at', { ascending: false })
    : { data: [], error: null }
  if (error) throw error

  const docs = active === 'facturas'
    ? (data ?? []).filter((invoice) => invoice.document_type === '01')
    : active === 'boletas'
      ? (data ?? []).filter((invoice) => invoice.document_type === '03')
      : []
  const names = new Map(ctx.projects.map((project) => [project.id, project.name]))
  const tabs = [['facturas', 'Facturas'], ['boletas', 'Boletas'], ['notas', 'Notas de crédito'], ['guias', 'Guías']]

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
      <div className="mgl-hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
        {tabs.map(([key, label]) => <Link key={key} href={`/app/finanzas?tab=${key}`} className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium ${active === key ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>{label}</Link>)}
      </div>

      <div className="space-y-3 md:hidden">
        {docs.map((invoice) => (
          <Link key={invoice.id} href={`/app/projects/${invoice.project_id}/invoices/${invoice.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-700">{invoice.series && invoice.number ? `${invoice.series}-${String(invoice.number).padStart(8, '0')}` : 'Borrador'}</p>
                <p className="mt-1 line-clamp-2 font-medium text-slate-950">{invoice.customer_name}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{names.get(invoice.project_id) ?? 'Proyecto'}</p>
              </div>
              <Badge className="shrink-0">{invoice.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
              <div><p className="text-slate-500">Moneda</p><p className="mt-1 font-medium text-slate-800">{invoice.currency}</p></div>
              <div><p className="text-slate-500">Fecha</p><p className="mt-1 font-medium text-slate-800">{invoice.issued_on}</p></div>
            </div>
          </Link>
        ))}
        {!docs.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Sin datos</div> : null}
      </div>

      <div className="mgl-table-scroll hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Proyecto</th><th className="px-4 py-3">Moneda</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Fecha</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{docs.map((invoice) => <tr key={invoice.id}><td className="px-4 py-3"><Link className="font-medium text-blue-700" href={`/app/projects/${invoice.project_id}/invoices/${invoice.id}`}>{invoice.series && invoice.number ? `${invoice.series}-${String(invoice.number).padStart(8, '0')}` : 'Borrador'}</Link></td><td className="px-4 py-3">{invoice.customer_name}</td><td className="px-4 py-3">{names.get(invoice.project_id) ?? '—'}</td><td className="px-4 py-3">{invoice.currency}</td><td className="px-4 py-3"><Badge>{invoice.status}</Badge></td><td className="px-4 py-3">{invoice.issued_on}</td></tr>)}</tbody>
        </table>
        {!docs.length ? <div className="p-8 text-center text-sm text-slate-500">Sin datos</div> : null}
      </div>
    </div>
  )
}
