import type { CostStatus } from '@/lib/db/schema'
import type { Tables } from '@/lib/supabase/database.types'
import type { CostThresholds } from '@/features/budget/cost-calculator'
import { calculateCostDeviation } from '@/features/budget/cost-calculator'

export type StageTaskLike = Pick<Tables<'tasks'>, 'stage_id' | 'progress' | 'planned_weight' | 'task_type'>

export type StageCostSummary = {
  stage_id: string
  stage_code: string
  stage_name: string
  sort_order: number
  quoted_total: number
  actual_total: number
  deviation_amount: number
  deviation_pct: number | null
  critical_items: number
}

export type TopDeviation = {
  id: string
  code: string
  description: string
  stage_id: string
  quoted_total: number
  actual_total: number
  deviation_amount: number
  deviation_pct: number | null
  cost_status: CostStatus
}

export type ProjectCostSummary = {
  project_id: string
  quoted_total: number
  actual_total: number
  deviation_amount: number
  deviation_pct: number | null
  stages: StageCostSummary[]
  top_deviations: TopDeviation[]
}

export type StageDashboardStage = {
  id: string
  code: string
  name: string
  sortOrder: number
  isLocked: boolean
  taskCount: number
  progressPct: number
  quotedTotal: number
  actualTotal: number
  deviationAmount: number
  deviationPct: number | null
  criticalItems: number
  costStatus: CostStatus
  hasCostData: boolean
}

export type RecentActivity = {
  id: string
  title: string
  body: string
  kind: string
  createdAt: string
  readAt: string | null
  actionUrl: string | null
}

export type StageDashboardData = {
  quotedTotal: number
  actualTotal: number
  deviationAmount: number
  deviationPct: number | null
  costStatus: CostStatus
  hasCostData: boolean
  stages: StageDashboardStage[]
  topDeviations: TopDeviation[]
  recentActivity: RecentActivity[]
}

/**
 * Weighted stage progress.
 * Summary/WBS rows are deliberately excluded so a parent task does not count
 * again on top of its children. Weight defaults to 1 when invalid or zero.
 */
export function calculateStageProgress(tasks: StageTaskLike[], stageId: string): { taskCount: number; progressPct: number } {
  const operational = tasks.filter((task) => task.stage_id === stageId && task.task_type !== 'summary')
  if (operational.length === 0) return { taskCount: 0, progressPct: 0 }

  let weightedProgress = 0
  let totalWeight = 0

  for (const task of operational) {
    const rawWeight = Number(task.planned_weight)
    const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1
    const progress = clampPercentage(Number(task.progress))
    weightedProgress += progress * weight
    totalWeight += weight
  }

  return {
    taskCount: operational.length,
    progressPct: totalWeight > 0 ? round2(weightedProgress / totalWeight) : 0,
  }
}

export function resolveCostStatus(
  quotedTotal: number,
  actualTotal: number,
  thresholds: CostThresholds,
): CostStatus {
  return calculateCostDeviation(
    {
      qtyQuoted: Math.max(0, quotedTotal),
      unitPriceQuoted: 1,
      qtyActual: Math.max(0, actualTotal),
      unitPriceActual: 1,
    },
    thresholds,
  ).status
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
