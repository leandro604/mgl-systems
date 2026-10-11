import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireWorkspaceContext } from '@/features/auth/server'
import { createClient } from '@/lib/supabase/server'

const statusLabel: Record<string, string> = { todo: 'Por hacer', in_progress: 'En curso', blocked: 'Bloqueada', done: 'Terminada' }

export default async function TasksPage() {
  const supabase = await createClient()
  const [workspace, result] = await Promise.all([
    requireWorkspaceContext(),
    supabase.from('tasks').select('id,project_id,title,status,priority,progress,due_on,assignee_id').is('deleted_at', null).order('due_on', { ascending: true, nullsFirst: false }).limit(100),
  ])
  const { projects } = workspace
  const { data, error } = result
  if (error) throw error
  const projectMap = new Map(projects.map((project) => [project.id, project]))
  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Operación</p><h1 className="mt-2 text-3xl font-black text-white">Tareas</h1></div><Card><CardHeader><CardTitle>Tareas visibles</CardTitle><CardDescription>{data?.length ?? 0} tarea(s) en tus proyectos.</CardDescription></CardHeader><CardContent><div className="divide-y divide-slate-800">{data?.map((task) => { const project = projectMap.get(task.project_id); return <Link key={task.id} href={`/app/projects/${task.project_id}/tasks`} className="flex items-center gap-4 py-4 hover:text-cyan-200"><span className="grid size-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300"><ClipboardCheck className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{task.title}</p><p className="mt-1 text-xs text-slate-500">{project?.code} · {project?.name}{task.due_on ? ` · vence ${task.due_on}` : ''}</p></div><span className="text-xs font-semibold text-slate-500">{task.progress}%</span><Badge>{statusLabel[task.status] ?? task.status}</Badge></Link> })}{(data?.length ?? 0) === 0 ? <div className="p-8 text-center text-sm text-slate-600">Sin tareas</div> : null}</div></CardContent></Card></div>
}
