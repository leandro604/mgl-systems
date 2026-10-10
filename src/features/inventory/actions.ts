'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormActionState } from '@/features/auth/types'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canManageInventory, canManageInventorySetup } from './server'

const uuidOrEmpty = z.string().uuid().or(z.literal(''))
const materialSchema = z.object({
  sku: z.string().trim().min(1).max(60), name: z.string().trim().min(2).max(220), category: z.string().trim().max(120),
  unit_code: z.string().trim().min(1).max(10), min_stock: z.coerce.number().min(0), notes: z.string().trim().max(1000),
})
const warehouseSchema = z.object({
  project_id: z.string().uuid(), code: z.string().trim().min(1).max(40), name: z.string().trim().min(2).max(160),
  location: z.string().trim().max(250), responsible_id: uuidOrEmpty,
})
const requestSchema = z.object({
  project_id: z.string().uuid(), number: z.string().trim().min(1).max(60), needed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  notes: z.string().trim().max(1500),
})
const requestLineSchema = z.object({
  project_id: z.string().uuid(), request_id: z.string().uuid(), material_id: z.string().uuid(), budget_item_id: uuidOrEmpty,
  quantity: z.coerce.number().positive(), notes: z.string().trim().max(1000),
})
const requestTransitionSchema = z.object({ project_id: z.string().uuid(), request_id: z.string().uuid(), target_status: z.enum(['submitted', 'approved', 'rejected', 'cancelled']) })
const manualReceiptSchema = z.object({ project_id: z.string().uuid(), warehouse_id: z.string().uuid(), material_id: z.string().uuid(), quantity: z.coerce.number().positive(), unit_cost: z.coerce.number().min(0), notes: z.string().trim().max(1000) })
const manualIssueSchema = z.object({ project_id: z.string().uuid(), warehouse_id: z.string().uuid(), material_id: z.string().uuid(), quantity: z.coerce.number().positive(), notes: z.string().trim().max(1000) })
const transferSchema = z.object({ project_id: z.string().uuid(), source_warehouse_id: z.string().uuid(), target_warehouse_id: z.string().uuid(), material_id: z.string().uuid(), quantity: z.coerce.number().positive(), notes: z.string().trim().max(1000) }).refine((v) => v.source_warehouse_id !== v.target_warehouse_id, { message: 'Origen y destino deben ser diferentes.', path: ['target_warehouse_id'] })
const issueSchema = z.object({ project_id: z.string().uuid(), source_warehouse_id: z.string().uuid(), request_item_id: z.string().uuid(), quantity: z.coerce.number().positive(), notes: z.string().trim().max(1000) })
const poReceiptSchema = z.object({ project_id: z.string().uuid(), target_warehouse_id: z.string().uuid(), purchase_order_item_id: z.string().uuid(), quantity: z.coerce.number().positive(), notes: z.string().trim().max(1000) })

async function projectContext(projectId: string) {
  const context = await requireWorkspaceContext()
  if (!context.projects.some((project) => project.id === projectId)) throw new Error('No tienes acceso a este proyecto.')
  return context
}
async function managerContext(projectId: string) {
  const context = await projectContext(projectId)
  if (!canManageInventory(context.profile.role)) throw new Error('Tu rol no permite registrar movimientos de almacén.')
  return context
}
function refresh(projectId: string) {
  revalidatePath('/app/inventory')
  revalidatePath(`/app/projects/${projectId}`)
  revalidatePath(`/app/projects/${projectId}/inventory`)
  revalidatePath(`/app/projects/${projectId}/purchases`)
}
function movementNumber(prefix: string) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${prefix}-${stamp}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
}

export async function createMaterialAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = materialSchema.safeParse({ sku: formData.get('sku'), name: formData.get('name'), category: formData.get('category') ?? '', unit_code: formData.get('unit_code') ?? 'NIU', min_stock: formData.get('min_stock') ?? '0', notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa el material.' }
  try {
    const context = await requireWorkspaceContext()
    if (!canManageInventorySetup(context.profile.role)) return { status: 'error', message: 'Solo administración o PM pueden editar el catálogo.' }
    const { error } = await context.supabase.from('materials').insert({ id: crypto.randomUUID(), company_id: context.company.id, sku: parsed.data.sku.toUpperCase(), name: parsed.data.name, category: parsed.data.category, unit_code: parsed.data.unit_code.toUpperCase(), min_stock: parsed.data.min_stock, notes: parsed.data.notes, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() })
    if (error) return { status: 'error', message: error.code === '23505' ? 'Ya existe un material activo con ese SKU.' : error.message }
    revalidatePath('/app/inventory')
    revalidatePath('/app', 'layout')
    return { status: 'success', message: 'Material registrado.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo registrar el material.' } }
}

export async function createWarehouseAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = warehouseSchema.safeParse({ project_id: formData.get('project_id'), code: formData.get('code'), name: formData.get('name'), location: formData.get('location') ?? '', responsible_id: formData.get('responsible_id') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa el almacén.' }
  try {
    const context = await projectContext(parsed.data.project_id)
    if (!canManageInventorySetup(context.profile.role)) return { status: 'error', message: 'Solo administración o PM pueden crear almacenes.' }
    const { error } = await context.supabase.from('warehouses').insert({ id: crypto.randomUUID(), company_id: context.company.id, project_id: parsed.data.project_id, code: parsed.data.code.toUpperCase(), name: parsed.data.name, location: parsed.data.location, responsible_id: parsed.data.responsible_id || null, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() })
    if (error) return { status: 'error', message: error.code === '23505' ? 'Ya existe un almacén activo con ese código.' : error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Almacén creado.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo crear el almacén.' } }
}

export async function createMaterialRequestAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = requestSchema.safeParse({ project_id: formData.get('project_id'), number: formData.get('number'), needed_on: formData.get('needed_on') ?? '', notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa el requerimiento.' }
  const context = await projectContext(parsed.data.project_id)
  const requestId = crypto.randomUUID()
  const { data: stage, error: stageError } = await context.supabase
    .from('project_stages')
    .select('id')
    .eq('project_id', parsed.data.project_id)
    .is('deleted_at', null)
    .eq('is_locked', false)
    .order('sort_order')
    .limit(1)
    .maybeSingle()
  if (stageError) return { status: 'error', message: stageError.message }
  if (!stage) return { status: 'error', message: 'El proyecto no tiene una etapa activa.' }
  const { error } = await context.supabase.from('material_requests').insert({
    id: requestId,
    company_id: context.company.id,
    project_id: parsed.data.project_id,
    number: parsed.data.number,
    title: `Petición ${parsed.data.number}`,
    stage_id: stage.id,
    needed_on: parsed.data.needed_on || null,
    notes: parsed.data.notes,
    requested_by: context.userId,
    updated_at: new Date().toISOString(),
    mutation_id: crypto.randomUUID(),
  })
  if (error) return { status: 'error', message: error.code === '23505' ? 'Ya existe ese número de requerimiento.' : error.message }
  refresh(parsed.data.project_id)
  redirect(`/app/projects/${parsed.data.project_id}/inventory/requests/${requestId}`)
}

export async function addMaterialRequestLineAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = requestLineSchema.safeParse({ project_id: formData.get('project_id'), request_id: formData.get('request_id'), material_id: formData.get('material_id'), budget_item_id: formData.get('budget_item_id') ?? '', quantity: formData.get('quantity'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la línea.' }
  try {
    const context = await projectContext(parsed.data.project_id)
    const { error } = await context.supabase.from('material_request_items').insert({ id: crypto.randomUUID(), company_id: context.company.id, project_id: parsed.data.project_id, request_id: parsed.data.request_id, material_id: parsed.data.material_id, budget_item_id: parsed.data.budget_item_id || null, quantity: parsed.data.quantity, notes: parsed.data.notes, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() })
    if (error) return { status: 'error', message: error.code === '23505' ? 'Ese material ya está incluido con el mismo centro de costo.' : error.message }
    revalidatePath(`/app/projects/${parsed.data.project_id}/inventory/requests/${parsed.data.request_id}`)
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Material agregado al requerimiento.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo agregar el material.' } }
}

export async function transitionMaterialRequestAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = requestTransitionSchema.safeParse({ project_id: formData.get('project_id'), request_id: formData.get('request_id'), target_status: formData.get('target_status') })
  if (!parsed.success) return { status: 'error', message: 'Transición inválida.' }
  try {
    const context = await projectContext(parsed.data.project_id)
    const { error } = await context.supabase.rpc('transition_material_request', { p_request_id: parsed.data.request_id, p_target_status: parsed.data.target_status })
    if (error) return { status: 'error', message: error.message }
    revalidatePath(`/app/projects/${parsed.data.project_id}/inventory/requests/${parsed.data.request_id}`)
    refresh(parsed.data.project_id)
    return { status: 'success', message: parsed.data.target_status === 'submitted' ? 'Requerimiento enviado.' : parsed.data.target_status === 'approved' ? 'Requerimiento aprobado.' : parsed.data.target_status === 'rejected' ? 'Requerimiento rechazado.' : 'Requerimiento cancelado.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo cambiar el estado.' } }
}

async function insertAndPost(
  context: Awaited<ReturnType<typeof managerContext>>,
  projectId: string,
  header: {
    number: string
    movement_type: string
    source_warehouse_id?: string | null
    target_warehouse_id?: string | null
    material_request_id?: string | null
    purchase_order_id?: string | null
    notes?: string
  },
  line: {
    material_id: string
    request_item_id?: string | null
    purchase_order_item_id?: string | null
    budget_item_id?: string | null
    quantity: number
    unit_cost?: number
    notes?: string
  },
) {
  const { error } = await context.supabase.rpc('create_inventory_movement', {
    p_project_id: projectId,
    p_number: header.number,
    p_movement_type: header.movement_type,
    p_source_warehouse_id: header.source_warehouse_id ?? null,
    p_target_warehouse_id: header.target_warehouse_id ?? null,
    p_material_request_id: header.material_request_id ?? null,
    p_purchase_order_id: header.purchase_order_id ?? null,
    p_material_id: line.material_id,
    p_request_item_id: line.request_item_id ?? null,
    p_purchase_order_item_id: line.purchase_order_item_id ?? null,
    p_budget_item_id: line.budget_item_id ?? null,
    p_quantity: line.quantity,
    p_unit_cost: line.unit_cost ?? 0,
    p_notes: line.notes ?? header.notes ?? '',
  })
  return error
}

export async function manualReceiptAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = manualReceiptSchema.safeParse({ project_id: formData.get('project_id'), warehouse_id: formData.get('warehouse_id'), material_id: formData.get('material_id'), quantity: formData.get('quantity'), unit_cost: formData.get('unit_cost'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa el ingreso.' }
  try {
    const context = await managerContext(parsed.data.project_id)
    const error = await insertAndPost(context, parsed.data.project_id, { number: movementNumber('ING'), movement_type: 'adjustment_in', target_warehouse_id: parsed.data.warehouse_id, notes: parsed.data.notes }, { material_id: parsed.data.material_id, quantity: parsed.data.quantity, unit_cost: parsed.data.unit_cost, notes: parsed.data.notes })
    if (error) return { status: 'error', message: error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Ingreso registrado y stock actualizado.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo registrar el ingreso.' } }
}

export async function manualIssueAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = manualIssueSchema.safeParse({ project_id: formData.get('project_id'), warehouse_id: formData.get('warehouse_id'), material_id: formData.get('material_id'), quantity: formData.get('quantity'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la salida por ajuste.' }
  try {
    const context = await managerContext(parsed.data.project_id)
    const error = await insertAndPost(context, parsed.data.project_id, { number: movementNumber('AJS'), movement_type: 'adjustment_out', source_warehouse_id: parsed.data.warehouse_id, notes: parsed.data.notes }, { material_id: parsed.data.material_id, quantity: parsed.data.quantity, unit_cost: 0, notes: parsed.data.notes })
    if (error) return { status: 'error', message: error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Salida por ajuste registrada al costo promedio.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo registrar la salida por ajuste.' } }
}

export async function issueRequestAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = issueSchema.safeParse({ project_id: formData.get('project_id'), source_warehouse_id: formData.get('source_warehouse_id'), request_item_id: formData.get('request_item_id'), quantity: formData.get('quantity'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la salida.' }
  try {
    const context = await managerContext(parsed.data.project_id)
    const { data: ref, error: refError } = await context.supabase.from('material_request_fulfillment').select('request_id,request_item_id,material_id,budget_item_id,status,remaining_quantity').eq('project_id', parsed.data.project_id).eq('request_item_id', parsed.data.request_item_id).maybeSingle()
    if (refError || !ref?.request_id || !ref.material_id) return { status: 'error', message: refError?.message ?? 'Línea de requerimiento no disponible.' }
    if (ref.status !== 'approved') return { status: 'error', message: 'El requerimiento debe estar aprobado.' }
    if (parsed.data.quantity > Number(ref.remaining_quantity ?? 0)) return { status: 'error', message: 'La salida supera la cantidad pendiente del requerimiento.' }
    const error = await insertAndPost(context, parsed.data.project_id, { number: movementNumber('SAL'), movement_type: 'issue', source_warehouse_id: parsed.data.source_warehouse_id, material_request_id: ref.request_id, notes: parsed.data.notes }, { material_id: ref.material_id, request_item_id: ref.request_item_id, budget_item_id: ref.budget_item_id, quantity: parsed.data.quantity, unit_cost: 0, notes: parsed.data.notes })
    if (error) return { status: 'error', message: error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Salida registrada al costo promedio del almacén.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo registrar la salida.' } }
}

export async function transferStockAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = transferSchema.safeParse({ project_id: formData.get('project_id'), source_warehouse_id: formData.get('source_warehouse_id'), target_warehouse_id: formData.get('target_warehouse_id'), material_id: formData.get('material_id'), quantity: formData.get('quantity'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la transferencia.' }
  try {
    const context = await managerContext(parsed.data.project_id)
    const error = await insertAndPost(context, parsed.data.project_id, { number: movementNumber('TRF'), movement_type: 'transfer', source_warehouse_id: parsed.data.source_warehouse_id, target_warehouse_id: parsed.data.target_warehouse_id, notes: parsed.data.notes }, { material_id: parsed.data.material_id, quantity: parsed.data.quantity, unit_cost: 0, notes: parsed.data.notes })
    if (error) return { status: 'error', message: error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Transferencia registrada.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo transferir el stock.' } }
}

export async function receivePurchaseAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = poReceiptSchema.safeParse({ project_id: formData.get('project_id'), target_warehouse_id: formData.get('target_warehouse_id'), purchase_order_item_id: formData.get('purchase_order_item_id'), quantity: formData.get('quantity'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la recepción.' }
  try {
    const context = await managerContext(parsed.data.project_id)
    if (!canManageInventorySetup(context.profile.role)) return { status: 'error', message: 'La recepción vinculada a compras está disponible para administración o PM.' }
    const { data: line, error: lineError } = await context.supabase.from('purchase_order_items').select('id,purchase_order_id,material_id,budget_item_id').eq('project_id', parsed.data.project_id).eq('id', parsed.data.purchase_order_item_id).maybeSingle()
    if (lineError || !line?.material_id) return { status: 'error', message: lineError?.message ?? 'La partida de compra no tiene material de almacén vinculado.' }
    const error = await insertAndPost(context, parsed.data.project_id, { number: movementNumber('REC'), movement_type: 'receipt', target_warehouse_id: parsed.data.target_warehouse_id, purchase_order_id: line.purchase_order_id, notes: parsed.data.notes }, { material_id: line.material_id, purchase_order_item_id: line.id, budget_item_id: line.budget_item_id, quantity: parsed.data.quantity, unit_cost: 0, notes: parsed.data.notes })
    if (error) return { status: 'error', message: error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Recepción de compra registrada al costo neto de la OC.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo registrar la recepción.' } }
}
