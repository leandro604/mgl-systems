import Link from 'next/link'
import { AlertTriangle, ClipboardCheck, GraduationCap, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireWorkspaceContext } from '@/features/auth/server'
import { createClient } from '@/lib/supabase/server'

const meta={inspection:{label:'Inspección',icon:ClipboardCheck},incident:{label:'Incidente',icon:AlertTriangle},training:{label:'Capacitación',icon:GraduationCap},permit:{label:'Permiso',icon:ShieldCheck}}

export default async function SstPage(){
  const supabase=await createClient()
  const[workspace,result]=await Promise.all([requireWorkspaceContext(),supabase.from('sst_records').select('id,project_id,record_type,title,occurred_at,details').is('deleted_at',null).order('occurred_at',{ascending:false}).limit(100)])
  const{projects}=workspace;const{data,error}=result;if(error)throw error
  const projectMap=new Map(projects.map((project)=>[project.id,project]))
  return <div className="mx-auto max-w-6xl space-y-8"><header><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Seguridad</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">SST</h1></header><Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>Actividad SST</CardTitle><span className="text-xs text-slate-400">{data?.length??0}</span></div></CardHeader><CardContent><div className="divide-y divide-slate-100">{data?.map((record)=>{const current=meta[record.record_type as keyof typeof meta]??meta.inspection;const Icon=current.icon;const project=projectMap.get(record.project_id);return <Link key={record.id} href={`/app/projects/${record.project_id}/sst`} className="flex items-center gap-3 py-3 hover:bg-slate-50"><Icon className="size-5 shrink-0 text-slate-400"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{record.title}</p><p className="mt-0.5 text-xs text-slate-400">{project?.code} · {new Date(record.occurred_at).toLocaleString()}</p></div><Badge variant="neutral">{current.label}</Badge></Link>})}{(data?.length??0)===0?<div className="py-10 text-center text-sm text-slate-400">Sin registros SST</div>:null}</div></CardContent></Card></div>
}
