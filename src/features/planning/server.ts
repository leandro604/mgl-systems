import { cache } from 'react'
import { requireWorkspaceContext } from '@/features/auth/server'
import { requireProjectContext } from '@/features/projects/server'
import { createClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { TaskDependencyRow, TaskRow } from '@/types/domain'

type Baseline = Database['public']['Tables']['schedule_baselines']['Row']
type BaselineTask = Database['public']['Tables']['schedule_baseline_tasks']['Row']
type BaselineDependency = Database['public']['Tables']['schedule_baseline_dependencies']['Row']
type ProgressRow = Database['public']['Tables']['task_progress_history']['Row']
export type PlanningBudgetItem = { id: string; code: string; description: string; unit_code: string; quantity: number; unit_price: number; budget_amount: number }
export type PlanningMember = { user_id: string; full_name: string; role: string }

type PlanningRpcPayload = {
  tasks?: TaskRow[]
  dependencies?: TaskDependencyRow[]
  baseline?: Baseline | null
  baseline_tasks?: BaselineTask[]
  baseline_dependencies?: BaselineDependency[]
  progress_history?: ProgressRow[]
  budget_items?: PlanningBudgetItem[]
  members?: PlanningMember[]
}

function asPayload(value: Json | null): PlanningRpcPayload {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as unknown as PlanningRpcPayload : {}
}

export async function getPlanningOverview() {
  const supabase = await createClient()
  const [context, summaryResult] = await Promise.all([
    requireWorkspaceContext(),
    supabase.from('project_schedule_summary').select('*'),
  ])
  if (summaryResult.error) throw summaryResult.error
  return { ...context, summaries: summaryResult.data ?? [] }
}

export const getProjectPlanning = cache(async (projectId: string) => {
  const supabase = await createClient()
  const [context, rpcResult] = await Promise.all([
    requireProjectContext(projectId),
    supabase.rpc('get_project_planning_context', { p_project_id: projectId }),
  ])
  if (rpcResult.error) throw rpcResult.error
  const payload = asPayload(rpcResult.data)
  return {
    ...context,
    tasks: payload.tasks ?? [],
    dependencies: payload.dependencies ?? [],
    baseline: payload.baseline ?? null,
    baselineTasks: payload.baseline_tasks ?? [],
    baselineDependencies: payload.baseline_dependencies ?? [],
    progressHistory: payload.progress_history ?? [],
    budgetItems: payload.budget_items ?? [],
    members: payload.members ?? [],
  }
})
