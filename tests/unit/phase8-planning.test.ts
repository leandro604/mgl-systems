import { describe, expect, it } from 'vitest'
import { calculateCpm } from '@/features/planning/cpm'
import { buildSCurve, plannedTaskProgress, weightedActualProgressAt, weightedCurrentProgress } from '@/features/planning/curve'
import type { TaskDependencyRow, TaskRow } from '@/types/domain'
import type { Database } from '@/lib/supabase/database.types'

type BaselineTask = Database['public']['Tables']['schedule_baseline_tasks']['Row']
type ProgressRow = Database['public']['Tables']['task_progress_history']['Row']

function task(id: string, starts_on: string, due_on: string, progress = 0): TaskRow {
  return {
    id,
    company_id: 'c',
    project_id: 'p',
    title: id,
    description: '',
    status: progress >= 100 ? 'done' : progress > 0 ? 'in_progress' : 'todo',
    priority: 2,
    assignee_id: null,
    starts_on,
    due_on,
    progress,
    position: 0,
    created_by: 'u',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    server_updated_at: '2026-10-01T00:00:00Z',
    mutation_id: id,
    deleted_at: null,
    wbs_code: id,
    task_type: 'activity',
    parent_task_id: null,
    planned_weight: 1,
    budget_item_id: null,
    stage_id: 'stage-field-execution',
    version: 1,
  }
}

function dep(id: string, successor: string, predecessor: string, type: 'FS' | 'SS' | 'FF' | 'SF' = 'FS', lag = 0): TaskDependencyRow {
  return {
    id,
    company_id: 'c',
    project_id: 'p',
    task_id: successor,
    depends_on_task_id: predecessor,
    dependency_type: type,
    lag_days: lag,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    server_updated_at: '2026-10-01T00:00:00Z',
    mutation_id: id,
    deleted_at: null,
  }
}

describe('Phase 8 planning foundation', () => {
  it('calculates a finish-to-start critical path', () => {
    const tasks = [task('A', '2026-10-01', '2026-10-03'), task('B', '2026-10-04', '2026-10-05')]
    const result = calculateCpm(tasks, [dep('D1', 'B', 'A')])

    expect(result.cycleDetected).toBe(false)
    expect(result.projectDuration).toBe(5)
    expect(result.metrics.get('B')?.earlyStart).toBe(3)
    expect(result.criticalTaskIds).toEqual(['A', 'B'])
  })

  it('calculates slack for a parallel activity and supports typed lag relations', () => {
    const tasks = [
      task('A', '2026-10-01', '2026-10-03'),
      task('B', '2026-10-04', '2026-10-04'),
      task('C', '2026-10-01', '2026-10-01'),
    ]
    const result = calculateCpm(tasks, [dep('D1', 'B', 'A', 'FS', 0)])

    expect(result.projectDuration).toBe(4)
    expect(result.metrics.get('C')?.slack).toBe(3)
    expect(result.metrics.get('A')?.critical).toBe(true)
    expect(result.metrics.get('B')?.critical).toBe(true)
  })

  it('builds planned/actual S-curve points from the baseline and progress history', () => {
    const base = {
      ...task('A', '2026-10-01', '2026-10-03'),
      baseline_id: 'base',
      task_id: 'A',
      progress_at_baseline: 0,
    } as unknown as BaselineTask
    const history = [
      {
        id: 'h1', company_id: 'c', project_id: 'p', task_id: 'A', recorded_at: '2026-10-02T12:00:00Z',
        status: 'in_progress', progress: 50, created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-02T12:00:00Z',
        server_updated_at: '2026-10-02T12:00:00Z', mutation_id: 'm1', deleted_at: null,
      },
    ] as ProgressRow[]

    expect(plannedTaskProgress(base, '2026-10-02')).toBe(50)
    expect(weightedCurrentProgress([task('A', '2026-10-01', '2026-10-03', 40)])).toBe(40)
    expect(weightedActualProgressAt([base], history, '2026-10-02')).toBe(50)
    const curve = buildSCurve([base], history, '2026-10-02', 8)
    expect(curve.at(-1)?.planned).toBe(100)
    expect(curve.some((point) => point.actual === 50)).toBe(true)
    expect(curve.at(-1)?.actual).toBeNull()
  })
})
