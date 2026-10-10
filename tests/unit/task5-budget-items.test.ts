import { describe, expect, it } from 'vitest'

import { parseLocalizedNumber, normalizeBudgetHeader } from '@/features/budget/excel-import'
import { filterBudgetItems } from '@/features/budget/budget-items-table'
import { toLocalBudgetItem } from '@/features/budget/repository'
import { pendingMutationSchema } from '@/lib/sync/schemas'
import type { BudgetItemRow } from '@/types/domain'

function row(overrides: Partial<BudgetItemRow> = {}): BudgetItemRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    created_at: '2026-09-25T00:00:00.000Z',
    updated_at: '2026-09-25T00:00:00.000Z',
    server_updated_at: '2026-09-25T00:00:00.000Z',
    mutation_id: '00000000-0000-4000-8000-000000000002',
    deleted_at: null,
    company_id: '00000000-0000-4000-8000-000000000003',
    project_id: '00000000-0000-4000-8000-000000000004',
    budget_id: '00000000-0000-4000-8000-000000000005',
    parent_id: null,
    code: '14.04',
    description: 'Sistema de videovigilancia',
    item_type: 'item',
    unit_code: 'GLB',
    quantity: 1,
    unit_price: 16000,
    budget_amount: 16000,
    sort_order: 1,
    stage_id: '00000000-0000-4000-8000-000000000006',
    qty_actual: 1,
    unit_price_actual: 80000,
    qty_quoted: 1,
    unit_price_quoted: 16000,
    actual_amount: 80000,
    deviation_amount: 64000,
    deviation_pct: 400,
    cost_status: 'critico',
    version: 2,
    committed_amount: 0,
    executed_amount: 0,
    available_amount: 16000,
    over_budget: false,
    ...overrides,
  }
}

describe('Task 5 budget item module', () => {
  it('parses common Peruvian/Excel number formats', () => {
    expect(parseLocalizedNumber('16.000,50')).toBe(16000.5)
    expect(parseLocalizedNumber('16000.50')).toBe(16000.5)
    expect(parseLocalizedNumber('S/ 80,000.25')).toBe(80000.25)
  })

  it('normalizes accented spreadsheet headers', () => {
    expect(normalizeBudgetHeader('  Precio Unitário ')).toBe('precio unitario')
    expect(normalizeBudgetHeader('Código Partida')).toBe('codigo partida')
  })

  it('normalizes a canonical row into local-first metadata', () => {
    const local = toLocalBudgetItem(row())
    expect(local.pending_sync).toBe(false)
    expect(local.actual_amount).toBe(80000)
    expect(local.cost_status).toBe('critico')
  })

  it('filters by query, stage and cost status', () => {
    const local = toLocalBudgetItem(row())
    expect(filterBudgetItems([local], 'video', 'all', 'critico')).toHaveLength(1)
    expect(filterBudgetItems([local], 'cable', 'all', 'critico')).toHaveLength(0)
    expect(filterBudgetItems([local], '', local.stage_id, 'critico')).toHaveLength(1)
  })


  it('accepts budget_items in the FIFO synchronization contract', () => {
    const parsed = pendingMutationSchema.parse({
      mutationId: '00000000-0000-4000-8000-000000000010',
      entityId: '00000000-0000-4000-8000-000000000001',
      companyId: '00000000-0000-4000-8000-000000000003',
      projectId: '00000000-0000-4000-8000-000000000004',
      actorId: '00000000-0000-4000-8000-000000000011',
      entity: 'budget_items',
      operation: 'update',
      updatedAt: '2026-09-25T22:00:00.000Z',
      payload: { qty_actual: 10, unit_price_actual: 140 },
      dependsOnMutationIds: [],
    })
    expect(parsed.entity).toBe('budget_items')
  })
})
