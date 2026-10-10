import { describe, expect, it } from 'vitest'

import { budgetItemsForStage, filterTasksByStage, stageLabel } from '@/features/tasks/task6-kanban'
import { taskCreatePayloadSchema } from '@/lib/sync/schemas'
import type { LocalTask } from '@/lib/db/schema'

const stageEngineering = '60000000-0000-4000-8000-000000000001'
const stageField = '60000000-0000-4000-8000-000000000002'

function task(id: string, stageId: string): LocalTask {
  return {
    id,
    company_id: '60000000-0000-4000-8000-000000000010',
    project_id: '60000000-0000-4000-8000-000000000011',
    title: `Tarea ${id}`,
    description: '',
    status: 'todo',
    priority: 2,
    assignee_id: null,
    created_by: '60000000-0000-4000-8000-000000000012',
    starts_on: null,
    due_on: null,
    progress: 0,
    position: 0,
    wbs_code: '',
    task_type: 'activity',
    parent_task_id: null,
    planned_weight: 1,
    budget_item_id: null,
    stage_id: stageId,
    version: 1,
    created_at: '2026-09-26T10:00:00.000Z',
    updated_at: '2026-09-26T10:00:00.000Z',
    server_updated_at: '2026-09-26T10:00:00.000Z',
    mutation_id: '60000000-0000-4000-8000-000000000013',
    deleted_at: null,
    pending_sync: false,
    sync_error: null,
    local_updated_at: '2026-09-26T10:00:00.000Z',
  }
}

describe('task 6 stage kanban', () => {
  it('requires a stage when creating a task', () => {
    const result = taskCreatePayloadSchema.safeParse({ title: 'Instalar cámaras' })
    expect(result.success).toBe(false)
  })

  it('filters the board by stage while preserving all mode', () => {
    const rows = [task('60000000-0000-4000-8000-000000000021', stageEngineering), task('60000000-0000-4000-8000-000000000022', stageField)]
    expect(filterTasksByStage(rows, 'all')).toHaveLength(2)
    expect(filterTasksByStage(rows, stageField).map((row) => row.id)).toEqual(['60000000-0000-4000-8000-000000000022'])
  })

  it('offers only budget items belonging to the selected stage', () => {
    const items = [
      { id: '1', code: '01.01', description: 'Ingeniería', stage_id: stageEngineering },
      { id: '2', code: '04.01', description: 'Campo', stage_id: stageField },
    ]
    expect(budgetItemsForStage(items, stageField).map((item) => item.code)).toEqual(['04.01'])
  })

  it('formats the stage label with code and readable name', () => {
    expect(stageLabel({ id: stageField, code: '04', name: '04_Ejecución en Campo', sort_order: 40, is_locked: false })).toBe('04 · Ejecución en Campo')
  })
})
