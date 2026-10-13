import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireWorkspaceContext } from '@/features/auth/server'
import { createClient } from '@/lib/supabase/server'

const statusLabel:Record<string,string>={todo:'Por hacer',in_progress:'En curso',blocked:'Bloqueada',done:'Terminada'}
const statusVariant=(status:string)=>status==='done'?'success' as const:status==='in_progress'?'info' as const:status==='blocked'?'danger' as const:'neutral' as const

export default async function TasksPage(){
  const supabase=await createClient()
  const[workspace,result]=await Promise.all([requireWorkspaceContext(),supabase.from('tasks').select('id,project_id,title,status,priority,progress,due_on,assignee_id').is('deleted_at',null).order('due_on',{ascending:true,nullsFirst:false}).limit(100)])
  const{projects}=workspace;const{data,error}=result;if(error)throw error
  const projectMap=new Map(projects.map((project)=>[project.id,project]))
  return <div className="mx-auto max-w-6xl space-y-8"><header><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Operación</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Tareas</h1></header><Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle>Tareas visibles</CardTitle><span className="text-xs text-slate-400">{data?.length??0}</span></div></CardHeader><CardContent><div className="divide-y divide-slate-100">{data?.map((task)=>{const project=projectMap.get(task.project_id);return <Link key={task.id} href={`/app/projects/${task.project_id}/tasks`} className="flex items-center gap-3 py-3 hover:bg-slate-50"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{task.title}</p><p className="mt-0.5 truncate text-xs text-slate-400">{project?.code} · {project?.name}{task.due_on?` · ${task.due_on}`:''}</p></div><span className="text-xs font-medium tabular-nums text-slate-500">{task.progress}%</span><Badge variant={statusVariant(task.status)}>{statusLabel[task.status]??task.status}</Badge></Link>})}{(data?.length??0)===0?<div className="py-10 text-center text-sm text-slate-400">Sin tareas</div>:null}</div></CardContent></Card></div>
}
