import { cache } from 'react'

import { requireProjectContext } from '@/features/projects/server'

export function canViewBudgetItems(role: string): boolean {
  return role === 'admin' || role === 'pm' || role === 'supervisor'
}

export function canImportBudgetItems(role: string): boolean {
  return role === 'admin' || role === 'pm'
}

export const getBudgetItemsModule = cache(async (projectId: string) => {
  const context = await requireProjectContext(projectId)

  if (!canViewBudgetItems(context.profile.role)) {
    return {
      ...context,
      allowed: false as const,
      items: [],
      stages: [],
      budgets: [],
      baseline: null,
      draftBudgets: [],
      thresholds: { minorMaxPct: 10, majorMaxPct: 25 },
    }
  }

  const [budgetsResult, stagesResult, itemsResult, projectResult] = await Promise.all([
    context.supabase
      .from('project_budgets')
      .select('id,version_no,name,currency,status,created_at')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('version_no', { ascending: false }),
    context.supabase
      .from('project_stages')
      .select('id,code,name,stage_type,sort_order,is_locked')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('sort_order'),
    context.supabase
      .from('budget_items')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('sort_order')
      .order('code'),
    context.supabase
      .from('projects')
      .select('cost_alert_minor_max_pct,cost_alert_major_max_pct')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single(),
  ])

  for (const result of [budgetsResult, stagesResult, itemsResult, projectResult]) {
    if (result.error) throw result.error
  }

  const project = projectResult.data
  if (!project) throw new Error('No se pudo cargar la configuración de costos del proyecto.')

  const budgets = budgetsResult.data ?? []
  const baseline = budgets.find((budget) => budget.status === 'baseline') ?? null
  const items = baseline
    ? (itemsResult.data ?? []).filter((item) => item.budget_id === baseline.id)
    : []

  return {
    ...context,
    allowed: true as const,
    items,
    stages: stagesResult.data ?? [],
    budgets,
    baseline,
    draftBudgets: budgets.filter((budget) => budget.status === 'draft'),
    thresholds: {
      minorMaxPct: Number(project.cost_alert_minor_max_pct ?? 10),
      majorMaxPct: Number(project.cost_alert_major_max_pct ?? 25),
    },
    canImport: canImportBudgetItems(context.profile.role),
  }
})
