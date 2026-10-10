'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormActionState } from '@/features/auth/types'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canManageFinance } from './server'

const supplierSchema = z.object({
  legal_name: z.string().trim().min(2).max(200),
  ruc: z.string().trim().regex(/^\d{11}$/).or(z.literal('')),
  contact_name: z.string().trim().max(150),
  email: z.string().trim().email().or(z.literal('')),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  currency: z.enum(['PEN', 'USD']),
})

const purchaseSchema = z.object({
  project_id: z.string().uuid(),
  number: z.string().trim().min(1).max(80),
  supplier_id: z.string().uuid(),
  currency: z.enum(['PEN', 'USD']),
  ordered_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expected_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
  notes: z.string().trim().max(2000),
}).superRefine((value, ctx) => {
  if (value.expected_on && value.expected_on < value.ordered_on) ctx.addIssue({ code: 'custom', path: ['expected_on'], message: 'La fecha prevista no puede ser anterior a la orden.' })
})

const lineSchema = z.object({
  project_id: z.string().uuid(),
  order_id: z.string().uuid(),
  budget_item_id: z.string().uuid().or(z.literal('')),
  material_id: z.string().uuid().or(z.literal('')),
  description: z.string().trim().min(1).max(500),
  unit_code: z.string().trim().min(2).max(10),
  quantity: z.coerce.number().positive().max(9_999_999_999),
  unit_price: z.coerce.number().min(0).max(9_999_999_999),
})

const transitionSchema = z.object({
  project_id: z.string().uuid(),
  order_id: z.string().uuid(),
  target_status: z.enum(['issued', 'received', 'cancelled']),
})

async function financeContext(projectId?: string) {
  const context = await requireWorkspaceContext()
  if (!canManageFinance(context.profile.role)) throw new Error('Tu rol no permite administrar compras.')
  if (projectId && !context.projects.some((project) => project.id === projectId)) throw new Error('No tienes acceso a este proyecto.')
  return context
}

export async function createSupplierAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = supplierSchema.safeParse({
    legal_name: formData.get('legal_name'), ruc: formData.get('ruc') ?? '', contact_name: formData.get('contact_name') ?? '',
    email: formData.get('email') ?? '', phone: formData.get('phone') ?? '', address: formData.get('address') ?? '', currency: formData.get('currency'),
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa los datos del proveedor.' }
  try {
    const { supabase, company, profile } = await requireWorkspaceContext()
    if (!canManageFinance(profile.role)) return { status: 'error', message: 'Tu rol no permite crear proveedores.' }
    const { error } = await supabase.from('suppliers').insert({
      id: crypto.randomUUID(), company_id: company.id, legal_name: parsed.data.legal_name,
      ruc: parsed.data.ruc || null, contact_name: parsed.data.contact_name, email: parsed.data.email,
      phone: parsed.data.phone, address: parsed.data.address, currency: parsed.data.currency,
      updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
    })
    if (error) return { status: 'error', message: error.code === '23505' ? 'Ya existe un proveedor activo con ese RUC.' : error.message }
    revalidatePath('/app/purchases')
    return { status: 'success', message: 'Proveedor registrado.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo crear el proveedor.' }
  }
}

export async function createPurchaseOrderAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = purchaseSchema.safeParse({
    project_id: formData.get('project_id'), number: formData.get('number'), supplier_id: formData.get('supplier_id'),
    currency: formData.get('currency'), ordered_on: formData.get('ordered_on'), expected_on: formData.get('expected_on') ?? '', notes: formData.get('notes') ?? '',
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la orden.' }
  const context = await financeContext(parsed.data.project_id)
  const { data: supplier, error: supplierError } = await context.supabase
    .from('suppliers').select('id,legal_name,ruc').eq('id', parsed.data.supplier_id).is('deleted_at', null).maybeSingle()
  if (supplierError) return { status: 'error', message: supplierError.message }
  if (!supplier) return { status: 'error', message: 'Selecciona un proveedor activo.' }
  const orderId = crypto.randomUUID()
  const { error } = await context.supabase.from('purchase_orders').insert({
    id: orderId, company_id: context.company.id, project_id: parsed.data.project_id, number: parsed.data.number,
    supplier_id: supplier.id, supplier_name: supplier.legal_name, supplier_ruc: supplier.ruc,
    currency: parsed.data.currency, ordered_on: parsed.data.ordered_on, expected_on: parsed.data.expected_on || null,
    notes: parsed.data.notes, created_by: context.userId, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
  })
  if (error) return { status: 'error', message: error.code === '23505' ? 'El número de orden ya existe.' : error.message }
  revalidatePath('/app/purchases')
  redirect(`/app/projects/${parsed.data.project_id}/purchases/${orderId}`)
}

export async function addPurchaseOrderLineAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = lineSchema.safeParse({
    project_id: formData.get('project_id'), order_id: formData.get('order_id'), budget_item_id: formData.get('budget_item_id') ?? '', material_id: formData.get('material_id') ?? '', description: formData.get('description'),
    unit_code: formData.get('unit_code') ?? 'NIU', quantity: formData.get('quantity'), unit_price: formData.get('unit_price'),
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la partida.' }
  try {
    const context = await financeContext(parsed.data.project_id)
    const { data: order } = await context.supabase.from('purchase_orders').select('id,status').eq('id', parsed.data.order_id).eq('project_id', parsed.data.project_id).maybeSingle()
    if (!order || order.status !== 'draft') return { status: 'error', message: 'Solo puedes editar líneas de una orden en borrador.' }
    const { data: lastLine, error: lineError } = await context.supabase.from('purchase_order_items').select('line_number').eq('purchase_order_id', parsed.data.order_id).order('line_number', { ascending: false }).limit(1).maybeSingle()
    if (lineError) return { status: 'error', message: lineError.message }
    const { error } = await context.supabase.from('purchase_order_items').insert({
      id: crypto.randomUUID(), company_id: context.company.id, project_id: parsed.data.project_id, purchase_order_id: parsed.data.order_id,
      budget_item_id: parsed.data.budget_item_id || null, material_id: parsed.data.material_id || null, line_number: (lastLine?.line_number ?? 0) + 1, description: parsed.data.description, unit_code: parsed.data.unit_code.toUpperCase(),
      quantity: parsed.data.quantity, unit_price: parsed.data.unit_price, tax_rate: 18, tax_affectation_code: '10',
      updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
    })
    if (error) return { status: 'error', message: error.message }
    revalidatePath(`/app/projects/${parsed.data.project_id}/purchases/${parsed.data.order_id}`)
    return { status: 'success', message: 'Partida agregada.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo agregar la partida.' }
  }
}

export async function transitionPurchaseOrderAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = transitionSchema.safeParse({ project_id: formData.get('project_id'), order_id: formData.get('order_id'), target_status: formData.get('target_status') })
  if (!parsed.success) return { status: 'error', message: 'Transición inválida.' }
  try {
    const context = await financeContext(parsed.data.project_id)
    const { error } = await context.supabase.rpc('transition_purchase_order', { p_order_id: parsed.data.order_id, p_target_status: parsed.data.target_status })
    if (error) return { status: 'error', message: error.message }
    revalidatePath('/app', 'layout')
    revalidatePath(`/app/projects/${parsed.data.project_id}/purchases/${parsed.data.order_id}`)
    revalidatePath('/app/purchases')
    return { status: 'success', message: parsed.data.target_status === 'issued' ? 'Orden emitida.' : parsed.data.target_status === 'received' ? 'Recepción registrada.' : 'Orden cancelada.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo cambiar el estado.' }
  }
}
