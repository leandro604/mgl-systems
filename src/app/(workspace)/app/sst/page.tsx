import Link from 'next/link'
import { AlertTriangle, ClipboardCheck, GraduationCap, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireWorkspaceContext } from '@/features/auth/server'
import { createClient } from '@/lib/supabase/server'

const meta = { inspection: { label: 'Inspección', icon: ClipboardCheck }, incident: { label: 'Incidente', icon: AlertTriangle }, training: { label: 'Capacitación', icon: GraduationCap }, permit: { label: 'Permiso', icon: ShieldCheck } }

export default async function SstPage() {
  const supabase = await createClient()
  const [workspace, result] = await Promise.all([
    requireWorkspaceContext(),
    supabase.from('sst_records').select('id,project_id,record_type,title,occurred_at,details').is('deleted_at', null).order('occurred_at', { ascending: false }).limit(100),
  ])
  const { projects } = workspace
  const { data, error } = result
  if (error) throw error
  const projectMap = new Map(projects.map((project) => [project.id, project]))
  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Seguridad</p><h1 className="mt-2 text-3xl font-black text-white">SST</h1></div><Card><CardHeader><CardTitle>Actividad SST</CardTitle><CardDescription>{data?.length ?? 0} registro(s) visible(s).</CardDescription></CardHeader><CardContent><div className="space-y-3">{data?.map((record) => { const current = meta[record.record_type as keyof typeof meta] ?? meta.inspection; const Icon = current.icon; const project = projectMap.get(record.project_id); return <Link key={record.id} href={`/app/projects/${record.project_id}/sst`} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 hover:border-cyan-400/20"><span className="grid size-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{record.title}</p><p className="mt-1 text-xs text-slate-500">{project?.code} · {new Date(record.occurred_at).toLocaleString()}</p></div><Badge>{current.label}</Badge></Link> })}{(data?.length ?? 0) === 0 ? <div className="p-8 text-center text-sm text-slate-600">Sin registros SST</div> : null}</div></CardContent></Card></div>
}
