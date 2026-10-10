'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormActionState } from '@/features/auth/types'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canManageFinance } from '@/features/purchases/server'

const seriesSchema = z.object({
  document_type: z.enum(['01', '03']),
  series: z.string().trim().toUpperCase(),
  next_number: z.coerce.number().int().positive(),
}).superRefine((value, ctx) => {
  const pattern = value.document_type === '01' ? /^F[A-Z0-9]{3}$/ : /^B[A-Z0-9]{3}$/
  if (!pattern.test(value.series)) ctx.addIssue({ code: 'custom', path: ['series'], message: value.document_type === '01' ? 'La serie de factura debe tener formato F001.' : 'La serie de boleta debe tener formato B001.' })
})


const seriesToggleSchema = z.object({
  id: z.string().uuid(),
  active: z.enum(['true', 'false']),
})

const invoiceSchema = z.object({
  project_id: z.string().uuid(), document_type: z.enum(['01', '03']), issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), currency: z.enum(['PEN', 'USD']),
  customer_document_type: z.enum(['0', '1', '6']), customer_document_number: z.string().trim().min(1).max(20), customer_name: z.string().trim().min(2).max(250), customer_address: z.string().trim().max(500),
}).superRefine((value, ctx) => {
  if (value.document_type === '01' && (value.customer_document_type !== '6' || !/^\d{11}$/.test(value.customer_document_number))) {
    ctx.addIssue({ code: 'custom', path: ['customer_document_number'], message: 'La factura requiere cliente con RUC de 11 dígitos.' })
  }
})

const lineSchema = z.object({
  project_id: z.string().uuid(), invoice_id: z.string().uuid(), description: z.string().trim().min(1).max(500), unit_code: z.string().trim().min(2).max(10),
  quantity: z.coerce.number().positive().max(9_999_999_999), unit_price: z.coerce.number().min(0).max(9_999_999_999),
})

const queueSchema = z.object({ project_id: z.string().uuid(), invoice_id: z.string().uuid(), series: z.string().trim().min(4).max(4) })

async function financeContext(projectId?: string) {
  const context = await requireWorkspaceContext()
  if (!canManageFinance(context.profile.role)) throw new Error('Tu rol no permite administrar facturación.')
  if (projectId && !context.projects.some((project) => project.id === projectId)) throw new Error('No tienes acceso a este proyecto.')
  return context
}

export async function createFiscalSeriesAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = seriesSchema.safeParse({ document_type: formData.get('document_type'), series: formData.get('series'), next_number: formData.get('next_number') })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la serie.' }
  try {
    const context = await requireWorkspaceContext()
    if (context.profile.role !== 'admin') return { status: 'error', message: 'Solo un administrador puede crear series fiscales.' }
    const { error } = await context.supabase.from('fiscal_series').insert({
      id: crypto.randomUUID(), company_id: context.company.id, document_type: parsed.data.document_type,
      series: parsed.data.series, next_number: parsed.data.next_number, active: true,
      updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
    })
    if (error) return { status: 'error', message: error.code === '23505' ? 'La serie ya existe.' : error.message }
    revalidatePath('/app', 'layout')
    revalidatePath('/app/invoices')
    revalidatePath('/app/configuracion/facturacion')
    return { status: 'success', message: 'Serie fiscal configurada.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo crear la serie.' }
  }
}


export async function toggleFiscalSeriesAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = seriesToggleSchema.safeParse({ id: formData.get('id'), active: formData.get('active') })
  if (!parsed.success) return { status: 'error', message: 'No se pudo identificar la serie fiscal.' }

  try {
    const context = await requireWorkspaceContext()
    if (context.profile.role !== 'admin') return { status: 'error', message: 'Solo un administrador puede cambiar el estado de una serie fiscal.' }

    const active = parsed.data.active === 'true'
    const { data, error } = await context.supabase
      .from('fiscal_series')
      .update({ active, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID() })
      .eq('id', parsed.data.id)
      .eq('company_id', context.company.id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) return { status: 'error', message: error.message }
    if (!data) return { status: 'error', message: 'La serie fiscal no existe o no pertenece a tu empresa.' }

    revalidatePath('/app', 'layout')
    revalidatePath('/app/invoices')
    revalidatePath('/app/configuracion/facturacion')
    return { status: 'success', message: active ? 'Serie fiscal activada.' : 'Serie fiscal desactivada.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo actualizar la serie fiscal.' }
  }
}

export async function createInvoiceAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = invoiceSchema.safeParse({
    project_id: formData.get('project_id'), document_type: formData.get('document_type'), issued_on: formData.get('issued_on'), currency: formData.get('currency'),
    customer_document_type: formData.get('customer_document_type'), customer_document_number: formData.get('customer_document_number'), customer_name: formData.get('customer_name'), customer_address: formData.get('customer_address') ?? '',
  })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa el comprobante.' }
  const context = await financeContext(parsed.data.project_id)
  const invoiceId = crypto.randomUUID()
  const { error } = await context.supabase.from('invoices').insert({
    id: invoiceId, company_id: context.company.id, project_id: parsed.data.project_id, document_type: parsed.data.document_type,
    issued_on: parsed.data.issued_on, currency: parsed.data.currency, customer_document_type: parsed.data.customer_document_type,
    customer_document_number: parsed.data.customer_document_number, customer_name: parsed.data.customer_name, customer_address: parsed.data.customer_address,
    created_by: context.userId, updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
  })
  if (error) return { status: 'error', message: error.message }
  revalidatePath('/app/invoices')
  redirect(`/app/projects/${parsed.data.project_id}/invoices/${invoiceId}`)
}

export async function addInvoiceLineAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = lineSchema.safeParse({ project_id: formData.get('project_id'), invoice_id: formData.get('invoice_id'), description: formData.get('description'), unit_code: formData.get('unit_code') ?? 'NIU', quantity: formData.get('quantity'), unit_price: formData.get('unit_price') })
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa la partida.' }
  try {
    const context = await financeContext(parsed.data.project_id)
    const { data: invoice } = await context.supabase.from('invoices').select('id,status').eq('id', parsed.data.invoice_id).eq('project_id', parsed.data.project_id).maybeSingle()
    if (!invoice || invoice.status !== 'draft') return { status: 'error', message: 'Solo puedes editar líneas de un comprobante en borrador.' }
    const { data: lastLine, error: lastError } = await context.supabase.from('invoice_items').select('line_number').eq('invoice_id', parsed.data.invoice_id).order('line_number', { ascending: false }).limit(1).maybeSingle()
    if (lastError) return { status: 'error', message: lastError.message }
    const { error } = await context.supabase.from('invoice_items').insert({
      id: crypto.randomUUID(), company_id: context.company.id, project_id: parsed.data.project_id, invoice_id: parsed.data.invoice_id,
      line_number: (lastLine?.line_number ?? 0) + 1, description: parsed.data.description, unit_code: parsed.data.unit_code.toUpperCase(),
      quantity: parsed.data.quantity, unit_price: parsed.data.unit_price, tax_rate: 18, tax_affectation_code: '10', updated_at: new Date().toISOString(), mutation_id: crypto.randomUUID(),
    })
    if (error) return { status: 'error', message: error.message }
    revalidatePath(`/app/projects/${parsed.data.project_id}/invoices/${parsed.data.invoice_id}`)
    return { status: 'success', message: 'Partida agregada.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo agregar la partida.' }
  }
}

export async function queueInvoiceAction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = queueSchema.safeParse({ project_id: formData.get('project_id'), invoice_id: formData.get('invoice_id'), series: formData.get('series') })
  if (!parsed.success) return { status: 'error', message: 'Selecciona una serie fiscal válida.' }
  try {
    const context = await financeContext(parsed.data.project_id)
    const { error } = await context.supabase.rpc('queue_invoice', { p_invoice_id: parsed.data.invoice_id, p_series: parsed.data.series.toUpperCase() })
    if (error) return { status: 'error', message: error.message }
    revalidatePath('/app', 'layout')
    revalidatePath('/app/invoices')
    revalidatePath(`/app/projects/${parsed.data.project_id}/invoices/${parsed.data.invoice_id}`)
    return { status: 'success', message: 'Comprobante numerado y colocado en cola fiscal.' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo poner el comprobante en cola.' }
  }
}
