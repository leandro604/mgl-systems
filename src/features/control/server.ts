import { cache } from 'react'
import { notFound } from 'next/navigation'
import { requireWorkspaceContext } from '@/features/auth/server'
import { requireProjectContext } from '@/features/projects/server'
import { createClient } from '@/lib/supabase/server'

export function canManageControl(role: string) {
  return role === 'admin' || role === 'pm'
}

export async function getControlOverview() {
  const supabase = await createClient()
  const [context, summaryResult] = await Promise.all([
    requireWorkspaceContext(),
    supabase.from('project_control_summary').select('*'),
  ])

  if (!canManageControl(context.profile.role)) {
    return { ...context, allowed: false as const, summaries: [] }
  }
  if (summaryResult.error) throw summaryResult.error

  return { ...context, allowed: true as const, summaries: summaryResult.data ?? [] }
}

export const getProjectControl = cache(async (projectId: string) => {
  const supabase = await createClient()
  const [context, results] = await Promise.all([
    requireProjectContext(projectId),
    Promise.all([
      supabase
        .from('project_budgets')
        .select('id,project_id,version_no,name,currency,status,notes,baseline_at,created_at')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('version_no', { ascending: false }),
      supabase
        .from('budget_items')
        .select('id,budget_id,parent_id,code,description,item_type,unit_code,quantity,unit_price,budget_amount,sort_order')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('sort_order')
        .order('code'),
      supabase
        .from('budget_item_control')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order')
        .order('code'),
      supabase
        .from('progress_records')
        .select('id,budget_item_id,progress_on,quantity,notes,created_at')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('progress_on', { ascending: false })
        .limit(40),
      supabase
        .from('valuations')
        .select('id,budget_id,number,period_start,period_end,status,notes,submitted_at,approved_at,created_at')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('number', { ascending: false }),
      supabase.from('valuation_totals').select('id,net_amount').eq('project_id', projectId),
      supabase.from('project_control_summary').select('*').eq('project_id', projectId).maybeSingle(),
    ]),
  ])

  if (!canManageControl(context.profile.role)) {
    return {
      ...context,
      allowed: false as const,
      budgets: [], budgetItems: [], controlItems: [], progress: [], valuations: [], valuationTotals: new Map<string, number>(), summary: null,
    }
  }

  const [budgetsResult, budgetItemsResult, controlResult, progressResult, valuationsResult, totalsResult, summaryResult] = results
  for (const result of results) if (result.error) throw result.error

  return {
    ...context,
    allowed: true as const,
    budgets: budgetsResult.data ?? [],
    budgetItems: budgetItemsResult.data ?? [],
    controlItems: controlResult.data ?? [],
    progress: progressResult.data ?? [],
    valuations: valuationsResult.data ?? [],
    valuationTotals: new Map((totalsResult.data ?? []).flatMap((row) => row.id ? [[row.id, Number(row.net_amount ?? 0)] as const] : [])),
    summary: summaryResult.data,
  }
})

export async function getValuationDetail(projectId: string, valuationId: string) {
  const context = await getProjectControl(projectId)
  if (!context.allowed) return { ...context, valuation: null, items: [], total: 0, valuationBudgetItems: [] }
  const valuation = context.valuations.find((item) => item.id === valuationId)
  if (!valuation) notFound()

  const itemsResult = await context.supabase
    .from('valuation_items')
    .select('id,budget_item_id,quantity,unit_price,amount,notes,created_at')
    .eq('valuation_id', valuationId)
    .is('deleted_at', null)
    .order('created_at')
  if (itemsResult.error) throw itemsResult.error

  return {
    ...context,
    valuation,
    items: itemsResult.data ?? [],
    total: context.valuationTotals.get(valuationId) ?? 0,
    valuationBudgetItems: context.budgetItems.filter((item) => item.budget_id === valuation.budget_id && item.item_type === 'item'),
  }
}
