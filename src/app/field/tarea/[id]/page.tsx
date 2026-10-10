import { notFound } from 'next/navigation'
import { FieldTaskDetail, type FieldTask } from '@/features/field/field-ui'
import { requireWorkspaceContext } from '@/features/auth/server'

export const dynamic='force-dynamic'

export default async function FieldTaskPage({params}:{params:Promise<{id:string}>}){const[{id},{supabase,company,profile,projects}]=await Promise.all([params,requireWorkspaceContext()]);const {data:task,error}=await supabase.from('tasks').select('*').eq('id',id).eq('assignee_id',profile.user_id).is('deleted_at',null).maybeSingle();if(error)throw error;if(!task)notFound();const {data:stage}=await supabase.from('project_stages').select('name').eq('id',task.stage_id).maybeSingle();const stageName=stage?.name;const projectName=projects.find((p)=>p.id===task.project_id)?.name;const row={...task,pending_sync:false,sync_error:null,local_updated_at:task.updated_at,...(stageName?{stage_name:stageName}:{}),...(projectName?{project_name:projectName}:{})} as FieldTask;return <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Tarea</h1><FieldTaskDetail companyId={company.id} userId={profile.user_id} task={row}/></div>}
