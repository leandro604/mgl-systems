import { notFound } from 'next/navigation'
import { requireProjectContext } from '@/features/projects/server'
import { canViewBudgetItems } from './server'

export async function getBudgetItemCommitments(projectId: string, budgetItemId: string) {
  const context = await requireProjectContext(projectId)
  if (!canViewBudgetItems(context.profile.role)) {
    return { ...context, allowed: false as const, item: null, commitments: [] }
  }

  const [itemResult, commitmentsResult] = await Promise.all([
    context.supabase
      .from('budget_items')
      .select('id,code,description,unit_code,quantity,unit_price,budget_amount,committed_amount,executed_amount,available_amount,over_budget')
      .eq('project_id', projectId)
      .eq('id', budgetItemId)
      .is('deleted_at', null)
      .maybeSingle(),
    context.supabase
      .from('budget_commitments')
      .select('id,commitment_type,source_entity,source_id,amount,currency,status,committed_at,executed_at,cancelled_at,metadata,created_at')
      .eq('project_id', projectId)
      .eq('budget_item_id', budgetItemId)
      .is('deleted_at', null)
      .order('committed_at', { ascending: false }),
  ])

  if (itemResult.error) throw itemResult.error
  if (commitmentsResult.error) throw commitmentsResult.error
  if (!itemResult.data) notFound()

  return {
    ...context,
    allowed: true as const,
    item: itemResult.data,
    commitments: commitmentsResult.data ?? [],
  }
}
