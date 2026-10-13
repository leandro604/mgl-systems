import { z } from 'zod'

import { DEFAULT_COST_THRESHOLDS, validateCostThresholds } from '@/features/budget/cost-calculator'
import { createClient } from '@/lib/supabase/server'
import type { CostStatus } from '@/lib/db/schema'
import {
  calculateStageProgress,
  resolveCostStatus,
  type ProjectCostSummary,
  type StageDashboardData,
  type StageCostSummary,
  type TopDeviation,
} from './stage-dashboard-model'

const costStatusSchema = z.enum(['dentro_presupuesto', 'alerta_menor', 'alerta_mayor', 'critico'])

const stageCostSchema = z.object({
  stage_id: z.string().uuid(),
  stage_code: z.string(),
  stage_name: z.string(),
  sort_order: z.coerce.number(),
  quoted_total: z.coerce.number(),
  actual_total: z.coerce.number(),
  deviation_amount: z.coerce.number(),
  deviation_pct: z.coerce.number().nullable(),
  critical_items: z.coerce.number(),
})

const topDeviationSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  description: z.string(),
  stage_id: z.string().uuid(),
  quoted_total: z.coerce.number(),
  actual_total: z.coerce.number(),
  deviation_amount: z.coerce.number(),
  deviation_pct: z.coerce.number().nullable(),
  cost_status: costStatusSchema,
})

const projectCostSummarySchema = z.object({
  project_id: z.string().uuid(),
  quoted_total: z.coerce.number(),
  actual_total: z.coerce.number(),
  deviation_amount: z.coerce.number(),
  deviation_pct: z.coerce.number().nullable(),
  stages: z.array(stageCostSchema).default([]),
  top_deviations: z.array(topDeviationSchema).default([]),
})

const emptyCostSummary = (projectId: string): ProjectCostSummary => ({
  project_id: projectId,
  quoted_total: 0,
  actual_total: 0,
  deviation_amount: 0,
  deviation_pct: null,
  stages: [],
  top_deviations: [],
})

/**
 * Fetches all read-only inputs for the managerial stage dashboard in parallel.
 * No mutation is performed here; RLS remains the source of visibility rules.
 */
export async function getStageDashboardData(projectId: string): Promise<StageDashboardData> {
  const supabase = await createClient()

  const [summaryResult, stagesResult, tasksResult, notificationsResult, projectResult] = await Promise.all([
    supabase.rpc('project_cost_summary', { p_project_id: projectId }),
    supabase
      .from('project_stages')
      .select('id,code,name,sort_order,is_locked')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('sort_order'),
    supabase
      .from('tasks')
      .select('id,title,status,stage_id,progress,planned_weight,task_type')
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase
      .from('notifications')
      .select('id,title,body,kind,created_at,read_at,action_url')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('projects')
      .select('cost_alert_minor_max_pct,cost_alert_major_max_pct')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single(),
  ])

  if (summaryResult.error) throw summaryResult.error
  if (stagesResult.error) throw stagesResult.error
  if (tasksResult.error) throw tasksResult.error
  if (notificationsResult.error) throw notificationsResult.error
  if (projectResult.error) throw projectResult.error

  const parsedSummary = summaryResult.data
    ? projectCostSummarySchema.safeParse(summaryResult.data)
    : null

  if (parsedSummary && !parsedSummary.success) {
    throw new Error(`Respuesta inválida de project_cost_summary: ${parsedSummary.error.message}`)
  }

  const summary: ProjectCostSummary = parsedSummary?.success
    ? parsedSummary.data
    : emptyCostSummary(projectId)

  const thresholds = validateCostThresholds({
    minorMaxPct: Number(projectResult.data.cost_alert_minor_max_pct ?? DEFAULT_COST_THRESHOLDS.minorMaxPct),
    majorMaxPct: Number(projectResult.data.cost_alert_major_max_pct ?? DEFAULT_COST_THRESHOLDS.majorMaxPct),
  })

  const costByStage = new Map<string, StageCostSummary>(
    summary.stages.map((stage) => [stage.stage_id, stage]),
  )

  const tasks = tasksResult.data ?? []

  const stages = (stagesResult.data ?? []).map((stage) => {
    const taskProgress = calculateStageProgress(tasks, stage.id)
    const cost = costByStage.get(stage.id)
    const quotedTotal = cost?.quoted_total ?? 0
    const actualTotal = cost?.actual_total ?? 0

    return {
      id: stage.id,
      code: stage.code,
      name: stage.name,
      sortOrder: stage.sort_order,
      isLocked: stage.is_locked,
      taskCount: taskProgress.taskCount,
      progressPct: taskProgress.progressPct,
      quotedTotal,
      actualTotal,
      deviationAmount: cost?.deviation_amount ?? 0,
      deviationPct: cost?.deviation_pct ?? null,
      criticalItems: cost?.critical_items ?? 0,
      costStatus: resolveCostStatus(quotedTotal, actualTotal, thresholds),
      hasCostData: quotedTotal !== 0 || actualTotal !== 0,
      tasks: tasks.filter((task) => task.stage_id === stage.id && task.task_type !== 'summary').map((task) => ({ id: task.id, title: task.title, status: task.status, progress: Number(task.progress) })),
    }
  })

  const recentActivity = (notificationsResult.data ?? []).map((notification) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    kind: notification.kind,
    createdAt: notification.created_at,
    readAt: notification.read_at,
    actionUrl: notification.action_url,
  }))

  const globalCostStatus: CostStatus = resolveCostStatus(
    summary.quoted_total,
    summary.actual_total,
    thresholds,
  )

  return {
    quotedTotal: summary.quoted_total,
    actualTotal: summary.actual_total,
    deviationAmount: summary.deviation_amount,
    deviationPct: summary.deviation_pct,
    costStatus: globalCostStatus,
    hasCostData: summary.quoted_total !== 0 || summary.actual_total !== 0,
    stages,
    topDeviations: summary.top_deviations as TopDeviation[],
    recentActivity,
  }
}
