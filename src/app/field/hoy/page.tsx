import { FieldToday, type FieldTask } from '@/features/field/field-ui'
import { requireWorkspaceContext } from '@/features/auth/server'

export const dynamic = 'force-dynamic'

export default async function FieldTodayPage() {
  const { supabase, company, profile, projects } = await requireWorkspaceContext()
  const projectIds = projects.map((p)=>p.id)
  const [taskResult, stageResult] = projectIds.length ? await Promise.all([
    supabase.from('tasks').select('*').in('project_id', projectIds).eq('assignee_id', profile.user_id).is('deleted_at', null).neq('status','done').order('due_on'),
    supabase.from('project_stages').select('id,name').in('project_id', projectIds).is('deleted_at',null),
  ]) : [{data:[],error:null},{data:[],error:null}]
  if(taskResult.error) throw taskResult.error
  if(stageResult.error) throw stageResult.error
  const stages=new Map((stageResult.data??[]).map((s)=>[s.id,s.name]))
  const names=new Map(projects.map((p)=>[p.id,p.name]))
  const tasks=(taskResult.data??[]).map((task)=>{const stageName=stages.get(task.stage_id);const projectName=names.get(task.project_id);return {...task,pending_sync:false,sync_error:null,local_updated_at:task.updated_at,...(stageName?{stage_name:stageName}:{}),...(projectName?{project_name:projectName}:{})} as FieldTask})
  return <FieldToday companyId={company.id} userId={profile.user_id} tasks={tasks}/>
}
