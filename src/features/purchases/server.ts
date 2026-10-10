import { notFound } from 'next/navigation'
import { requireWorkspaceContext } from '@/features/auth/server'
import { requireProjectContext } from '@/features/projects/server'
import { createClient } from '@/lib/supabase/server'

export function canManageFinance(role: string) {
  return role === 'admin' || role === 'pm'
}

export async function getPurchasesOverview() {
  const supabase = await createClient()
  const [context, financeResults] = await Promise.all([
    requireWorkspaceContext(),
    Promise.all([
      supabase
        .from('suppliers')
        .select('id,legal_name,ruc,contact_name,email,phone,address,currency,created_at')
        .is('deleted_at', null)
        .order('legal_name'),
      supabase
        .from('purchase_orders')
        .select('id,project_id,number,supplier_id,supplier_name,supplier_ruc,currency,status,ordered_on,expected_on,received_on,notes,created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('purchase_order_totals').select('id,total_amount'),
      supabase.from('project_financial_summary').select('*'),
    ]),
  ])
  if (!canManageFinance(context.profile.role)) {
    return { ...context, allowed: false as const, suppliers: [], orders: [], totals: new Map<string, number>(), summaries: [] }
  }

  const [suppliersResult, ordersResult, totalsResult, summaryResult] = financeResults

  if (suppliersResult.error) throw suppliersResult.error
  if (ordersResult.error) throw ordersResult.error
  if (totalsResult.error) throw totalsResult.error
  if (summaryResult.error) throw summaryResult.error

  return {
    ...context,
    allowed: true as const,
    suppliers: suppliersResult.data ?? [],
    orders: ordersResult.data ?? [],
    totals: new Map((totalsResult.data ?? []).flatMap((row) => row.id ? [[row.id, Number(row.total_amount ?? 0)] as const] : [])),
    summaries: summaryResult.data ?? [],
  }
}

export async function getProjectPurchases(projectId: string) {
  const supabase = await createClient()
  const [context, financeResults] = await Promise.all([
    requireProjectContext(projectId),
    Promise.all([
      supabase
        .from('suppliers')
        .select('id,legal_name,ruc,currency')
        .is('deleted_at', null)
        .order('legal_name'),
      supabase
        .from('purchase_orders')
        .select('id,project_id,number,supplier_id,supplier_name,supplier_ruc,currency,status,ordered_on,expected_on,received_on,notes,created_at')
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('purchase_order_totals').select('id,total_amount').eq('project_id', projectId),
      supabase.from('project_financial_summary').select('*').eq('project_id', projectId).maybeSingle(),
    ]),
  ])
  if (!canManageFinance(context.profile.role)) {
    return { ...context, allowed: false as const, suppliers: [], orders: [], totals: new Map<string, number>(), summary: null }
  }

  const [suppliersResult, ordersResult, totalsResult, summaryResult] = financeResults

  if (suppliersResult.error) throw suppliersResult.error
  if (ordersResult.error) throw ordersResult.error
  if (totalsResult.error) throw totalsResult.error
  if (summaryResult.error) throw summaryResult.error

  return {
    ...context,
    allowed: true as const,
    suppliers: suppliersResult.data ?? [],
    orders: ordersResult.data ?? [],
    totals: new Map((totalsResult.data ?? []).flatMap((row) => row.id ? [[row.id, Number(row.total_amount ?? 0)] as const] : [])),
    summary: summaryResult.data,
  }
}

export async function getPurchaseOrderDetail(projectId: string, orderId: string) {
  const context = await getProjectPurchases(projectId)
  if (!context.allowed) return { ...context, order: null, items: [], total: null }
  const order = context.orders.find((item) => item.id === orderId)
  if (!order) notFound()

  const [itemsResult, totalResult, budgetItemsResult, materialsResult] = await Promise.all([
    context.supabase
      .from('purchase_order_items')
      .select('id,budget_item_id,material_id,line_number,description,unit_code,quantity,unit_price,tax_rate,net_amount,tax_amount,deleted_at')
      .eq('purchase_order_id', orderId)
      .is('deleted_at', null)
      .order('line_number'),
    context.supabase.from('purchase_order_totals').select('*').eq('id', orderId).maybeSingle(),
    context.supabase
      .from('budget_item_control')
      .select('budget_item_id,code,description,currency')
      .eq('project_id', projectId)
      .eq('budget_status', 'baseline')
      .eq('item_type', 'item')
      .eq('currency', order.currency)
      .order('code'),
    context.supabase
      .from('materials')
      .select('id,sku,name,unit_code')
      .is('deleted_at', null)
      .order('sku'),
  ])
  if (itemsResult.error) throw itemsResult.error
  if (totalResult.error) throw totalResult.error
  if (budgetItemsResult.error) throw budgetItemsResult.error
  if (materialsResult.error) throw materialsResult.error

  return { ...context, order, items: itemsResult.data ?? [], total: totalResult.data, budgetItems: budgetItemsResult.data ?? [], materials: materialsResult.data ?? [] }
}
