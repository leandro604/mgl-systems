import { z } from 'zod'

import { calculateBudgetItemCost, type CostThresholds } from '@/features/budget/cost-calculator'
import type { MglLocalDb } from '@/lib/db/dexie'
import type { LocalBudgetItem } from '@/lib/db/schema'
import { commitLocalMutation } from '@/lib/sync/local-write'
import { makeMutation, nowIso } from '@/lib/sync/mutation'
import { compactPayload } from '@/lib/sync/payload'
import { budgetItemActualPayloadSchema } from '@/lib/sync/schemas'
import type { BudgetItemRow, VerifiedIdentity } from '@/types/domain'

export type BudgetItemActualPatch = z.infer<typeof budgetItemActualPayloadSchema>

/**
 * Converts a canonical Supabase row into the local Dexie representation.
 * Generated numeric columns are normalized to zero so the UI never receives
 * undefined/null arithmetic values while offline.
 */
export function toLocalBudgetItem(row: BudgetItemRow): LocalBudgetItem {
  return {
    ...row,
    qty_actual: Number(row.qty_actual ?? 0),
    unit_price_actual: Number(row.unit_price_actual ?? 0),
    qty_quoted: Number(row.qty_quoted ?? row.quantity ?? 0),
    unit_price_quoted: Number(row.unit_price_quoted ?? row.unit_price ?? 0),
    actual_amount: Number(row.actual_amount ?? 0),
    deviation_amount: Number(row.deviation_amount ?? 0),
    deviation_pct: row.deviation_pct === null ? null : Number(row.deviation_pct),
    version: Number(row.version ?? 1),
    pending_sync: false,
    sync_error: null,
    local_updated_at: row.updated_at,
  }
}

/** Hydrates server-rendered rows without overwriting a newer optimistic edit. */
export async function hydrateBudgetItemsLocal(db: MglLocalDb, rows: BudgetItemRow[]): Promise<void> {
  await db.transaction('rw', db.budgetItems, async () => {
    for (const row of rows) {
      const current = await db.budgetItems.get(row.id)
      if (current?.pending_sync) continue
      await db.budgetItems.put(toLocalBudgetItem(row))
    }
  })
}

/**
 * Local-first edit for the two fields that represent real execution cost.
 * PostgreSQL remains authoritative; this mirrors its formula immediately so
 * the user sees the new deviation while the mutation waits in the FIFO outbox.
 */
export async function updateBudgetItemActualLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  itemId: string,
  raw: BudgetItemActualPatch,
  thresholds: CostThresholds,
): Promise<LocalBudgetItem> {
  const patch = budgetItemActualPayloadSchema.parse(raw)
  const current = await db.budgetItems.get(itemId)

  if (!current || current.deleted_at) throw new Error('La partida no está disponible localmente.')
  if (current.company_id !== identity.companyId) throw new Error('La partida pertenece a otra empresa.')
  if (current.item_type !== 'item') throw new Error('Solo las partidas ejecutables admiten costo real.')

  if (identity.role === 'field_worker') {
    if (patch.unit_price_actual !== undefined) {
      throw new Error('El personal de campo solo puede actualizar el metrado real.')
    }
    const assigned = await db.tasks
      .where('budget_item_id')
      .equals(itemId)
      .and((task) => task.assignee_id === identity.userId && task.deleted_at === null)
      .count()
    if (!assigned) throw new Error('No tienes una tarea asignada vinculada a esta partida.')
  } else if (!['admin', 'pm', 'supervisor'].includes(identity.role)) {
    throw new Error('Tu rol no permite actualizar costos reales.')
  }

  const qtyActual = patch.qty_actual ?? Number(current.qty_actual ?? 0)
  const unitPriceActual = patch.unit_price_actual ?? Number(current.unit_price_actual ?? 0)
  const calculation = calculateBudgetItemCost(
    {
      quantity: Number(current.quantity ?? 0),
      unit_price: Number(current.unit_price ?? 0),
      qty_actual: qtyActual,
      unit_price_actual: unitPriceActual,
    },
    thresholds,
  )

  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: current.id,
    entity: 'budget_items',
    operation: 'update',
    updatedAt,
    payload: compactPayload(patch),
  })

  const row: LocalBudgetItem = {
    ...current,
    qty_actual: qtyActual,
    unit_price_actual: unitPriceActual,
    actual_amount: calculation.actualTotal,
    deviation_amount: calculation.deviationAmount,
    deviation_pct: calculation.deviationPct,
    cost_status: calculation.status,
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    version: Number(current.version ?? 1) + 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }

  await commitLocalMutation(db, db.budgetItems, row, mutation)
  return row
}
