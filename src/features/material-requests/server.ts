import { cache } from 'react'
import { notFound } from 'next/navigation'
import { requireWorkspaceContext } from '@/features/auth/server'

export type MaterialOption = { id: string; sku: string; name: string; unit_code: string }
export type StageOption = { id: string; project_id: string; code: string; name: string; sort_order: number }
export type BudgetOption = { id: string; project_id: string; stage_id: string; code: string; description: string; budget_amount: number | null; quantity: number; unit_price: number; committed_amount: number; executed_amount: number; available_amount: number | null }
export type ApproverOption = { user_id: string; full_name: string; role: string }

export type MaterialRequestView = {
  id: string
  project_id: string
  number: string
  title: string
  needed_on: string | null
  status: string
  workflow_status: string
  notes: string
  requested_by: string
  approver_id: string | null
  approved_by: string | null
  approved_at: string | null
  priority: string
  stage_id: string
  budget_item_id: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  server_updated_at: string
  deleted_at: string | null
}

export type MaterialRequestItemView = {
  id: string
  request_id: string
  material_id: string
  budget_item_id: string | null
  quantity: number
  estimated_unit_price: number
  estimated_amount: number | null
  notes: string
  deleted_at: string | null
}

export const getMaterialRequestReferenceData = cache(async () => {
  const workspace = await requireWorkspaceContext()
  const { supabase, company, projects } = workspace
  const projectIds = projects.map((p) => p.id)
  if (!projectIds.length) return { ...workspace, materials: [], stages: [], budgets: [], approversByProject: {} as Record<string, ApproverOption[]> }

  const [materialsResult, stagesResult, budgetResult, membershipsResult, profilesResult] = await Promise.all([
    supabase.from('materials').select('id,sku,name,unit_code').eq('company_id', company.id).is('deleted_at', null).order('name'),
    supabase.from('project_stages').select('id,project_id,code,name,sort_order').in('project_id', projectIds).is('deleted_at', null).order('sort_order'),
    supabase.from('budget_items').select('id,project_id,stage_id,code,description,budget_amount,quantity,unit_price,committed_amount,executed_amount,available_amount').in('project_id', projectIds).eq('item_type', 'item').is('deleted_at', null).order('code'),
    supabase.from('project_members').select('project_id,user_id,deleted_at').in('project_id', projectIds).is('deleted_at', null),
    supabase.from('profiles').select('user_id,full_name,role').eq('company_id', company.id).is('deleted_at', null).order('full_name'),
  ])
  for (const result of [materialsResult, stagesResult, budgetResult, membershipsResult, profilesResult]) {
    if (result.error) throw result.error
  }

  const profileByUser = new Map((profilesResult.data ?? []).map((p) => [p.user_id, p]))
  const approversByProject: Record<string, ApproverOption[]> = {}
  for (const project of projects) approversByProject[project.id] = []
  for (const member of membershipsResult.data ?? []) {
    const profile = profileByUser.get(member.user_id)
    if (!profile || !['admin', 'pm', 'supervisor'].includes(profile.role)) continue
    approversByProject[member.project_id]?.push(profile)
  }

  const budgets: BudgetOption[] = (budgetResult.data ?? []).map((row) => ({
    ...row,
    committed_amount: Number(row.committed_amount ?? 0),
    executed_amount: Number(row.executed_amount ?? 0),
    available_amount: row.available_amount ?? null,
  }))

  return {
    ...workspace,
    materials: (materialsResult.data ?? []) as MaterialOption[],
    stages: (stagesResult.data ?? []) as StageOption[],
    budgets,
    approversByProject,
  }
})

export async function listMaterialRequests() {
  const workspace = await requireWorkspaceContext()
  const { supabase, company, projects } = workspace
  if (!projects.length) return { ...workspace, requests: [] as MaterialRequestView[], items: [] as MaterialRequestItemView[], profiles: [], stages: [] }
  const projectIds = projects.map((p) => p.id)
  const [requestsResult, itemsResult, profilesResult, stagesResult] = await Promise.all([
    supabase.from('material_requests').select('*').in('project_id', projectIds).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('material_request_items').select('*').in('project_id', projectIds).is('deleted_at', null),
    supabase.from('profiles').select('user_id,full_name,role').eq('company_id', company.id).is('deleted_at', null),
    supabase.from('project_stages').select('id,project_id,code,name,sort_order').in('project_id', projectIds).is('deleted_at', null),
  ])
  for (const result of [requestsResult, itemsResult, profilesResult, stagesResult]) if (result.error) throw result.error
  return {
    ...workspace,
    requests: (requestsResult.data ?? []) as unknown as MaterialRequestView[],
    items: (itemsResult.data ?? []) as unknown as MaterialRequestItemView[],
    profiles: profilesResult.data ?? [],
    stages: (stagesResult.data ?? []) as StageOption[],
  }
}

export async function getMaterialRequestDetail(requestId: string) {
  const workspace = await requireWorkspaceContext()
  const { supabase, company, projects } = workspace
  const [requestResult, itemsResult, profilesResult, materialsResult, stagesResult, commitmentsResult] = await Promise.all([
    supabase.from('material_requests').select('*').eq('id', requestId).is('deleted_at', null).maybeSingle(),
    supabase.from('material_request_items').select('*').eq('request_id', requestId).is('deleted_at', null).order('created_at'),
    supabase.from('profiles').select('user_id,full_name,role').eq('company_id', company.id).is('deleted_at', null),
    supabase.from('materials').select('id,sku,name,unit_code').eq('company_id', company.id).is('deleted_at', null),
    supabase.from('project_stages').select('id,project_id,code,name,sort_order').in('project_id', projects.map((p) => p.id)).is('deleted_at', null),
    supabase.from('budget_commitments').select('id,budget_item_id,amount,currency,status,committed_at,executed_at,cancelled_at').eq('source_id', requestId).is('deleted_at', null),
  ])
  if (requestResult.error) throw requestResult.error
  if (!requestResult.data) notFound()
  for (const result of [itemsResult, profilesResult, materialsResult, stagesResult, commitmentsResult]) if (result.error) throw result.error
  return {
    ...workspace,
    request: requestResult.data as unknown as MaterialRequestView,
    items: (itemsResult.data ?? []) as unknown as MaterialRequestItemView[],
    profiles: profilesResult.data ?? [],
    materials: (materialsResult.data ?? []) as MaterialOption[],
    stages: (stagesResult.data ?? []) as StageOption[],
    commitments: (commitmentsResult.data ?? []) as Array<{ id: string; budget_item_id: string; amount: number; currency: string; status: string; committed_at: string; executed_at: string | null; cancelled_at: string | null }>,
  }
}
