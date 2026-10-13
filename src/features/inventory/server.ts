import { cache } from 'react'
import { notFound } from 'next/navigation'
import { requireWorkspaceContext } from '@/features/auth/server'
import { requireProjectContext } from '@/features/projects/server'
import { createClient } from '@/lib/supabase/server'

export function canManageInventory(role: string) {
  return role === 'admin' || role === 'pm' || role === 'supervisor'
}

export function canManageInventorySetup(role: string) {
  return role === 'admin' || role === 'pm'
}

export async function getInventoryOverview() {
  const supabase = await createClient()
  const [context, summaryResult] = await Promise.all([
    requireWorkspaceContext(),
    supabase.from('project_inventory_summary').select('*'),
  ])
  if (summaryResult.error) throw summaryResult.error
  return { ...context, summaries: summaryResult.data ?? [] }
}

export const getProjectInventory = cache(async (projectId: string) => {
  const supabase = await createClient()
  const [context, results] = await Promise.all([
    requireProjectContext(projectId),
    Promise.all([
      supabase.from('materials').select('id,sku,name,category,unit_code,min_stock,notes').is('deleted_at', null).order('sku'),
      supabase.from('warehouses').select('id,code,name,location,responsible_id').eq('project_id', projectId).is('deleted_at', null).order('code'),
      supabase.from('inventory_stock').select('*').eq('project_id', projectId),
      supabase.from('material_requests').select('id,number,title,needed_on,status,notes,requested_by,approved_by,approved_at,created_at').eq('project_id', projectId).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('material_request_fulfillment').select('*').eq('project_id', projectId),
      supabase.from('inventory_transactions').select('id,number,movement_type,status,source_warehouse_id,target_warehouse_id,material_request_id,purchase_order_id,occurred_at,notes,posted_at,created_by').eq('project_id', projectId).is('deleted_at', null).order('occurred_at', { ascending: false }).limit(40),
      supabase.from('project_inventory_summary').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('budget_item_control').select('budget_item_id,code,description,unit_code').eq('project_id', projectId).eq('budget_status', 'baseline').eq('item_type', 'item').order('code'),
      supabase.from('purchase_orders').select('id,number,status,supplier_name').eq('project_id', projectId).in('status', ['issued', 'received']).is('deleted_at', null).order('ordered_on', { ascending: false }),
      supabase.from('purchase_order_items').select('id,purchase_order_id,material_id,budget_item_id,line_number,description,unit_code,quantity,unit_price').eq('project_id', projectId).not('material_id', 'is', null).is('deleted_at', null).order('line_number'),
      supabase.from('profiles').select('user_id,full_name,role').is('deleted_at', null).order('full_name'),
    ]),
  ])

  for (const result of results) if (result.error) throw result.error
  const [materials, warehouses, stock, requests, fulfillment, transactions, summary, budgetItems, purchaseOrders, purchaseItems, profiles] = results
  return {
    ...context,
    materials: materials.data ?? [],
    warehouses: warehouses.data ?? [],
    stock: stock.data ?? [],
    requests: requests.data ?? [],
    fulfillment: fulfillment.data ?? [],
    transactions: transactions.data ?? [],
    summary: summary.data,
    budgetItems: budgetItems.data ?? [],
    purchaseOrders: purchaseOrders.data ?? [],
    purchaseItems: purchaseItems.data ?? [],
    profiles: profiles.data ?? [],
    canManage: canManageInventory(context.profile.role),
    canSetup: canManageInventorySetup(context.profile.role),
  }
})

export async function getMaterialRequestDetail(projectId: string, requestId: string) {
  const context = await getProjectInventory(projectId)
  const request = context.requests.find((item) => item.id === requestId)
  if (!request) notFound()

  const itemsResult = await context.supabase
    .from('material_request_items')
    .select('id,request_id,material_id,budget_item_id,quantity,notes,created_at')
    .eq('project_id', projectId)
    .eq('request_id', requestId)
    .is('deleted_at', null)
    .order('created_at')
  if (itemsResult.error) throw itemsResult.error

  return {
    ...context,
    request,
    items: itemsResult.data ?? [],
    requestFulfillment: context.fulfillment.filter((item) => item.request_id === requestId),
  }
}
