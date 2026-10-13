import { FieldToday, type FieldTask, type FieldRequestSummary } from '@/features/field/field-ui'
import { requireWorkspaceContext } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function FieldTodayPage() {
  const { supabase, company, profile, projects } = await requireWorkspaceContext()
  const projectIds=projects.map((p)=>p.id)
  const anySupabase=supabase as any
  const [taskResult,stageResult,requestResult]=projectIds.length?await Promise.all([
    supabase.from('tasks').select('*').in('project_id',projectIds).eq('assignee_id',profile.user_id).is('deleted_at',null).neq('status','done').order('due_on'),
    supabase.from('project_stages').select('id,name').in('project_id',projectIds).is('deleted_at',null),
    anySupabase.from('material_requests').select('id,number,title,workflow_status,status,needed_on,project_id').in('project_id',projectIds).eq('requested_by',profile.user_id).is('deleted_at',null).order('created_at',{ascending:false}).limit(5),
  ]):[{data:[],error:null},{data:[],error:null},{data:[],error:null}]
  if(taskResult.error)throw taskResult.error
  if(stageResult.error)throw stageResult.error
  if(requestResult.error)throw requestResult.error
  const stages=new Map((stageResult.data??[]).map((s)=>[s.id,s.name]))
  const names=new Map(projects.map((p)=>[p.id,p.name]))
  const tasks=(taskResult.data??[]).map((task)=>{const stageName=stages.get(task.stage_id);const projectName=names.get(task.project_id);return {...task,pending_sync:false,sync_error:null,local_updated_at:task.updated_at,...(stageName?{stage_name:stageName}:{}),...(projectName?{project_name:projectName}:{})} as FieldTask})
  const requests=(requestResult.data??[]).map((row:any)=>({...row,workflow_status:row.workflow_status??row.status}) as FieldRequestSummary)
  return <FieldToday companyId={company.id} userId={profile.user_id} fullName={profile.full_name} tasks={tasks} requests={requests}/>
}
