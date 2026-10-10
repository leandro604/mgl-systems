'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireProjectContext } from '@/features/projects/server'
import { canImportBudgetItems } from './server'

const importedRowSchema = z.object({
  code: z.string().trim().min(1).max(50),
  description: z.string().trim().min(2).max(300),
  unit_code: z.string().trim().min(1).max(10),
  quantity: z.number().finite().min(0),
  unit_price: z.number().finite().min(0),
  stage_code: z.string().trim().max(160).nullable(),
  item_type: z.enum(['group', 'item']),
  source_row: z.number().int().positive(),
}).superRefine((row, ctx) => {
  if (row.item_type === 'item' && row.quantity <= 0) {
    ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Una partida ejecutable necesita metrado mayor a cero.' })
  }
})

const importSchema = z.object({
  projectId: z.string().uuid(),
  budgetId: z.string().uuid(),
  rows: z.array(importedRowSchema).min(1).max(2000),
})

export type ImportBudgetItemsResult = {
  status: 'success' | 'error'
  message: string
  inserted?: number
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** Imports quoted rows only into a DRAFT budget. Baselines remain immutable. */
export async function importBudgetItemsAction(raw: unknown): Promise<ImportBudgetItemsResult> {
  const parsed = importSchema.safeParse(raw)
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Revisa las filas del Excel.' }
  }

  try {
    const context = await requireProjectContext(parsed.data.projectId)
    if (!canImportBudgetItems(context.profile.role)) {
      return { status: 'error', message: 'Solo admin o PM pueden importar la cotización.' }
    }

    const [budgetResult, stagesResult, existingResult] = await Promise.all([
      context.supabase
        .from('project_budgets')
        .select('id,status')
        .eq('id', parsed.data.budgetId)
        .eq('project_id', parsed.data.projectId)
        .is('deleted_at', null)
        .maybeSingle(),
      context.supabase
        .from('project_stages')
        .select('id,code,name,stage_type')
        .eq('project_id', parsed.data.projectId)
        .is('deleted_at', null),
      context.supabase
        .from('budget_items')
        .select('code')
        .eq('budget_id', parsed.data.budgetId)
        .is('deleted_at', null),
    ])

    if (budgetResult.error) return { status: 'error', message: budgetResult.error.message }
    if (stagesResult.error) return { status: 'error', message: stagesResult.error.message }
    if (existingResult.error) return { status: 'error', message: existingResult.error.message }
    if (!budgetResult.data || budgetResult.data.status !== 'draft') {
      return { status: 'error', message: 'La importación solo está permitida sobre una versión de presupuesto en borrador.' }
    }

    const stages = stagesResult.data ?? []
    const defaultStage = stages.find((stage) => stage.stage_type === 'field_execution')
    if (!defaultStage) return { status: 'error', message: 'El proyecto no tiene la etapa 04_Ejecución en Campo.' }

    const stageByKey = new Map<string, string>()
    for (const stage of stages) {
      stageByKey.set(normalize(stage.code), stage.id)
      stageByKey.set(normalize(stage.name), stage.id)
      stageByKey.set(normalize(`${stage.code}${stage.name}`), stage.id)
    }

    const seen = new Set((existingResult.data ?? []).map((row) => normalize(row.code)))
    for (const row of parsed.data.rows) {
      const key = normalize(row.code)
      if (seen.has(key)) return { status: 'error', message: `Código duplicado: ${row.code}.` }
      seen.add(key)
    }

    const now = new Date().toISOString()
    const inserts = parsed.data.rows.map((row, index) => {
      const requestedStage = row.stage_code ? stageByKey.get(normalize(row.stage_code)) : undefined
      if (row.stage_code && !requestedStage) {
        throw new Error(`Fila ${row.source_row}: etapa "${row.stage_code}" no existe en el proyecto.`)
      }

      return {
        id: crypto.randomUUID(),
        company_id: context.company.id,
        project_id: parsed.data.projectId,
        budget_id: parsed.data.budgetId,
        parent_id: null,
        code: row.code,
        description: row.description,
        item_type: row.item_type,
        unit_code: row.item_type === 'group' ? 'NIU' : row.unit_code,
        quantity: row.item_type === 'group' ? 0 : row.quantity,
        unit_price: row.item_type === 'group' ? 0 : row.unit_price,
        sort_order: index + 1,
        stage_id: requestedStage ?? defaultStage.id,
        updated_at: now,
        mutation_id: crypto.randomUUID(),
      }
    })

    const { error } = await context.supabase.from('budget_items').insert(inserts)
    if (error) return { status: 'error', message: error.message }

    revalidatePath(`/app/projects/${parsed.data.projectId}`)
    revalidatePath(`/app/projects/${parsed.data.projectId}/control`)
    revalidatePath(`/app/projects/${parsed.data.projectId}/partidas`)

    return { status: 'success', message: `${inserts.length} filas importadas al presupuesto borrador.`, inserted: inserts.length }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'No se pudo importar el Excel.' }
  }
}
