'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormActionState } from '@/features/auth/types'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canManageControl } from './server'

const budgetSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  currency: z.enum(['PEN', 'USD']),
  notes: z.string().trim().max(2000),
})

const itemSchema = z.object({
  project_id: z.string().uuid(),
  budget_id: z.string().uuid(),
  parent_id: z.string().uuid().or(z.literal('')),
  code: z.string().trim().min(1).max(50),
  description: z.string().trim().min(2).max(300),
  item_type: z.enum(['group', 'item']),
  unit_code: z.string().trim().min(1).max(10),
  quantity: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  sort_order: z.coerce.number().int().min(0).max(1_000_000),
}).superRefine((value, ctx) => {
  if (value.item_type === 'item' && value.quantity <= 0) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Una partida ejecutable necesita cantidad mayor a cero.' })
})

const activationSchema = z.object({ project_id: z.string().uuid(), budget_id: z.string().uuid() })
const progressSchema = z.object({
  project_id: z.string().uuid(),
  budget_item_id: z.string().uuid(),
  progress_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.coerce.number().positive(),
  notes: z.string().trim().max(1000),
})
const valuationSchema = z.object({
  project_id: z.string().uuid(), budget_id: z.string().uuid(), number: z.coerce.number().int().positive(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), notes: z.string().trim().max(2000),
}).superRefine((value, ctx) => {
  if (value.period_end < value.period_start) ctx.addIssue({ code: 'custom', path: ['period_end'], message: 'El fin del periodo no puede ser anterior al inicio.' })
})
const valuationLineSchema = z.object({
  project_id: z.string().uuid(), valuation_id: z.string().uuid(), budget_item_id: z.string().uuid(), quantity: z.coerce.number().positive(), notes: z.string().trim().max(1000),
})
const transitionSchema = z.object({ project_id: z.string().uuid(), valuation_id: z.string().uuid(), target_status: z.enum(['submitted', 'approved', 'observed']) })

async function controlContext(projectId: string) {
  const context = await requireWorkspaceContext()
  if (!canManageControl(context.profile.role)) throw new Error('Tu rol no permite administrar el control económico.')
  if (!context.projects.some((project) => project.id === projectId)) throw new Error('No tienes acceso a este proyecto.')
  return context
}

function refresh(projectId: string) {
  revalidatePath('/app/control')
  revalidatePath(`/app/projects/${projectId}`)
  revalidatePath(`/app/projects/${projectId}/control`)
  revalidatePath(`/app/projects/${projectId}/purchases`)
}

export async function createBudgetAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = budgetSchema.safeParse({ project_id: formData.get('project_id'), name: formData.get('name'), currency: formData.get('currency'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa el presupuesto.' }
  try {
    const context = await controlContext(parsed.data.project_id)
    const { data: last, error: lastError } = await context.supabase
      .from('project_budgets').select('version_no').eq('project_id', parsed.data.project_id).order('version_no', { ascending: false }).limit(1).maybeSingle()
    if (lastError) return { status: 'error', message: lastError.message }
    const { error } = await context.supabase.from('project_budgets').insert({
      id: crypto.randomUUID(), company_id: context.company.id, project_id: parsed.data.project_id,
      version_no: (last?.version_no ?? 0) + 1, name: parsed.data.name, currency: parsed.data.currency, notes: parsed.data.notes,
      created_by: context.userId, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
    })
    if (error) return { status: 'error', message: error.code === '23505' ? 'Se creó otra versión al mismo tiempo. Intenta nuevamente.' : error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Versión de presupuesto creada en borrador.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo crear el presupuesto.' }
  }
}

export async function addBudgetItemAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = itemSchema.safeParse({
    project_id: formData.get('project_id'), budget_id: formData.get('budget_id'), parent_id: formData.get('parent_id') ?? '', code: formData.get('code'),
    description: formData.get('description'), item_type: formData.get('item_type'), unit_code: formData.get('unit_code') ?? 'NIU', quantity: formData.get('quantity') ?? '0',
    unit_price: formData.get('unit_price') ?? '0', sort_order: formData.get('sort_order') ?? '0',
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la partida.' }
  try {
    const context = await controlContext(parsed.data.project_id)
    const isGroup = parsed.data.item_type === 'group'
    const { error } = await context.supabase.from('budget_items').insert({
      id: crypto.randomUUID(), company_id: context.company.id, project_id: parsed.data.project_id, budget_id: parsed.data.budget_id,
      parent_id: parsed.data.parent_id || null, code: parsed.data.code, description: parsed.data.description, item_type: parsed.data.item_type,
      unit_code: isGroup ? 'NIU' : parsed.data.unit_code.toUpperCase(), quantity: isGroup ? 0 : parsed.data.quantity, unit_price: isGroup ? 0 : parsed.data.unit_price,
      sort_order: parsed.data.sort_order, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
    })
    if (error) return { status: 'error', message: error.code === '23505' ? 'Ese código ya existe en esta versión.' : error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: isGroup ? 'Grupo agregado.' : 'Partida presupuestal agregada.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo agregar la partida.' }
  }
}

export async function activateBudgetAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = activationSchema.safeParse({ project_id: formData.get('project_id'), budget_id: formData.get('budget_id') })
  if (!parsed.success) return { status: 'error', message: 'Presupuesto inválido.' }
  try {
    const context = await controlContext(parsed.data.project_id)
    const { error } = await context.supabase.rpc('activate_project_budget', { p_budget_id: parsed.data.budget_id })
    if (error) return { status: 'error', message: error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Presupuesto establecido como línea base. Sus partidas quedaron congeladas.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo activar la línea base.' }
  }
}

export async function recordProgressAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = progressSchema.safeParse({ project_id: formData.get('project_id'), budget_item_id: formData.get('budget_item_id'), progress_on: formData.get('progress_on'), quantity: formData.get('quantity'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa el avance.' }
  try {
    const context = await controlContext(parsed.data.project_id)
    const { error } = await context.supabase.from('progress_records').insert({
      id: crypto.randomUUID(), company_id: context.company.id, project_id: parsed.data.project_id, budget_item_id: parsed.data.budget_item_id,
      progress_on: parsed.data.progress_on, quantity: parsed.data.quantity, notes: parsed.data.notes, created_by: context.userId,
      updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
    })
    if (error) return { status: 'error', message: error.message }
    refresh(parsed.data.project_id)
    return { status: 'success', message: 'Avance físico registrado.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo registrar el avance.' }
  }
}

export async function createValuationAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = valuationSchema.safeParse({ project_id: formData.get('project_id'), budget_id: formData.get('budget_id'), number: formData.get('number'), period_start: formData.get('period_start'), period_end: formData.get('period_end'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la valorización.' }
  const valuationId = crypto.randomUUID()
  try {
    const context = await controlContext(parsed.data.project_id)
    const { error } = await context.supabase.from('valuations').insert({
      id: valuationId, company_id: context.company.id, project_id: parsed.data.project_id, budget_id: parsed.data.budget_id,
      number: parsed.data.number, period_start: parsed.data.period_start, period_end: parsed.data.period_end, notes: parsed.data.notes,
      created_by: context.userId, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
    })
    if (error) return { status: 'error', message: error.code === '23505' ? 'Ese número de valorización ya existe para la línea base.' : error.message }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo crear la valorización.' }
  }
  refresh(parsed.data.project_id)
  redirect(`/app/projects/${parsed.data.project_id}/control/valuations/${valuationId}`)
}

export async function addValuationLineAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = valuationLineSchema.safeParse({ project_id: formData.get('project_id'), valuation_id: formData.get('valuation_id'), budget_item_id: formData.get('budget_item_id'), quantity: formData.get('quantity'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa el metrado.' }
  try {
    const context = await controlContext(parsed.data.project_id)
    const { error } = await context.supabase.from('valuation_items').insert({
      id: crypto.randomUUID(), company_id: context.company.id, project_id: parsed.data.project_id, valuation_id: parsed.data.valuation_id,
      budget_item_id: parsed.data.budget_item_id, quantity: parsed.data.quantity, notes: parsed.data.notes,
      updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
    })
    if (error) return { status: 'error', message: error.code === '23505' ? 'La partida ya está incluida en esta valorización.' : error.message }
    revalidatePath(`/app/projects/${parsed.data.project_id}/control`)
    revalidatePath(`/app/projects/${parsed.data.project_id}/control/valuations/${parsed.data.valuation_id}`)
    return { status: 'success', message: 'Partida valorizada agregada.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo agregar la partida.' }
  }
}

export async function transitionValuationAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = transitionSchema.safeParse({ project_id: formData.get('project_id'), valuation_id: formData.get('valuation_id'), target_status: formData.get('target_status') })
  if (!parsed.success) return { status: 'error', message: 'Transición inválida.' }
  try {
    const context = await controlContext(parsed.data.project_id)
    const { error } = await context.supabase.rpc('transition_valuation', { p_valuation_id: parsed.data.valuation_id, p_target_status: parsed.data.target_status })
    if (error) return { status: 'error', message: error.message }
    refresh(parsed.data.project_id)
    revalidatePath(`/app/projects/${parsed.data.project_id}/control/valuations/${parsed.data.valuation_id}`)
    const label = parsed.data.target_status === 'submitted' ? 'Valorización presentada.' : parsed.data.target_status === 'approved' ? 'Valorización aprobada.' : 'Valorización marcada como observada.'
    return { status: 'success', message: label }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo cambiar el estado.' }
  }
}
