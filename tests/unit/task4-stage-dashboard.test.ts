import { describe, expect, it } from 'vitest'

import {
  calculateStageProgress,
  resolveCostStatus,
  type StageTaskLike,
} from '@/features/projects/stage-dashboard-model'

const thresholds = { minorMaxPct: 10, majorMaxPct: 25 }

describe('Task 4 stage dashboard model', () => {
  it('calculates weighted progress without double-counting summary rows', () => {
    const tasks: StageTaskLike[] = [
      { stage_id: 'stage-a', progress: 100, planned_weight: 99, task_type: 'summary' },
      { stage_id: 'stage-a', progress: 50, planned_weight: 2, task_type: 'activity' },
      { stage_id: 'stage-a', progress: 100, planned_weight: 1, task_type: 'activity' },
      { stage_id: 'stage-b', progress: 100, planned_weight: 1, task_type: 'activity' },
    ]

    expect(calculateStageProgress(tasks, 'stage-a')).toEqual({
      taskCount: 2,
      progressPct: 66.67,
    })
  })

  it('returns zero progress when a stage has no operational tasks', () => {
    expect(calculateStageProgress([], 'stage-a')).toEqual({ taskCount: 0, progressPct: 0 })
  })

  it('uses the same thresholds as the cost calculator', () => {
    expect(resolveCostStatus(100, 100, thresholds)).toBe('dentro_presupuesto')
    expect(resolveCostStatus(100, 110, thresholds)).toBe('alerta_menor')
    expect(resolveCostStatus(100, 125, thresholds)).toBe('alerta_mayor')
    expect(resolveCostStatus(100, 126, thresholds)).toBe('critico')
  })

  it('marks actual cost with zero quotation as critical', () => {
    expect(resolveCostStatus(0, 1, thresholds)).toBe('critico')
  })
})
