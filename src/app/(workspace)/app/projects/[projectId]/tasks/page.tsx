import { ProjectTasksBoard } from '@/features/tasks/project-tasks-board'
import { getProjectPeople, requireProjectContext } from '@/features/projects/server'
import { createClient } from '@/lib/supabase/server'

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ focus?: string | string[] | undefined }>
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams])
  const focusTaskId = typeof query.focus === 'string' ? query.focus : undefined
  const supabase = await createClient()

  const [context, people, taskData, stagesResult] = await Promise.all([
    requireProjectContext(projectId),
    getProjectPeople(projectId),
    Promise.all([
      supabase.from('tasks').select('*').eq('project_id', projectId).is('deleted_at', null).order('position').order('created_at'),
      supabase.from('task_dependencies').select('*').eq('project_id', projectId).is('deleted_at', null).order('created_at'),
    ]),
    supabase
      .from('project_stages')
      .select('id,code,name,sort_order,is_locked')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('sort_order'),
  ])

  const [{ data: tasks, error: tasksError }, { data: dependencies, error: dependenciesError }] = taskData
  if (tasksError) throw tasksError
  if (dependenciesError) throw dependenciesError
  if (stagesResult.error) throw stagesResult.error

  // project_budgets is intentionally restricted to admin/PM by RLS. Supervisors
  // still get the full stage Kanban; the optional budget selector is omitted.
  const canReadBudgetBaseline = context.profile.role === 'admin' || context.profile.role === 'pm'
  let budgetItems: { id: string; code: string; description: string; stage_id: string }[] = []

  if (canReadBudgetBaseline) {
    const budgetsResult = await supabase
      .from('project_budgets')
      .select('id,status')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('version_no', { ascending: false })

    if (budgetsResult.error) throw budgetsResult.error
    const baseline = (budgetsResult.data ?? []).find((budget) => budget.status === 'baseline') ?? null

    if (baseline) {
      const result = await supabase
        .from('budget_items')
        .select('id,code,description,stage_id')
        .eq('project_id', projectId)
        .eq('budget_id', baseline.id)
        .eq('item_type', 'item')
        .is('deleted_at', null)
        .order('code')

      if (result.error) throw result.error
      budgetItems = result.data ?? []
    }
  }

  const memberProfiles = people.memberships.flatMap((membership) => membership.profile ? [membership.profile] : [])

  return (
    <ProjectTasksBoard
      projectId={projectId}
      initialTasks={tasks ?? []}
      initialDependencies={dependencies ?? []}
      members={memberProfiles}
      stages={stagesResult.data ?? []}
      budgetItems={budgetItems}
      {...(focusTaskId ? { focusTaskId } : {})}
    />
  )
}
