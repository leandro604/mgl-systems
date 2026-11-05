import { describe, expect, it } from 'vitest'
import { aggregateCurves, buildDashboardData, type DashboardProject } from '@/features/dashboard/model'

const project = (overrides: Partial<DashboardProject> = {}): DashboardProject => ({
  id: 'a', code: 'OBRA-01', name: 'Obra A', budget: 100, executed: 120, committed: 80, progress: 25,
  curve: [], criticalItems: [], ...overrides,
})

describe('management dashboard financial and chart data', () => {
  it('shows overspend as a negative budget variance and does not net commitments against execution', () => {
    const result = buildDashboardData([project()])
    expect(result).toMatchObject({ budget: 100, executed: 120, committed: 80, variance: -20 })
  })

  it('aggregates money and budget-weights progress, rather than averaging percentages', () => {
    const result = buildDashboardData([project({ budget: 300, progress: 100 }), project({ id: 'b', budget: 100, progress: 0 })])
    expect(result.budget).toBe(400)
    expect(result.progress).toBe(75)
    expect(result.executed).toBe(240)
  })

  it('keeps empty workspaces and missing baselines empty', () => {
    expect(buildDashboardData([])).toMatchObject({ budget: 0, progress: 0, variance: 0, curve: [], criticalItems: [] })
    expect(buildDashboardData([project()]).curve).toEqual([])
  })

  it('ranks the five largest overspends across projects and excludes savings', () => {
    const items = [5, 30, -10, 10, 50, 20, 40].map((amount, index) => ({
      id: String(index), code: String(index), description: 'Partida', stage_id: 'stage', quoted_total: 100, actual_total: 100 + amount,
      deviation_amount: amount, deviation_pct: amount, cost_status: 'critico' as const, projectId: 'a', projectName: 'Obra A',
    }))
    const result = buildDashboardData([project({ criticalItems: items.slice(0, 3) }), project({ id: 'b', criticalItems: items.slice(3) })])
    expect(result.criticalItems.map((item) => item.deviation_amount)).toEqual([50, 40, 30, 20, 10])
  })

  it('aligns differently sampled plans without extrapolating actual execution', () => {
    const points = aggregateCurves([
      project({ budget: 300, curve: [{ date: '2026-10-01', planned: 0, actual: 0 }, { date: '2026-10-03', planned: 100, actual: null }] }),
      project({ id: 'b', budget: 100, curve: [{ date: '2026-10-01', planned: 0, actual: 0 }, { date: '2026-10-02', planned: 100, actual: 20 }, { date: '2026-10-03', planned: 100, actual: null }] }),
    ])
    expect(points[1]?.planned).toBe(62.5)
    expect(points[0]?.actual).toBe(0)
    expect(points[1]?.actual).toBeNull()
    expect(points.at(-1)?.actual).toBeNull()
  })

  it('does not copy a completed series into another project’s future dates', () => {
    const result = aggregateCurves([
      project({ curve: [{ date: '2026-10-01', planned: 100, actual: 100 }] }),
      project({ id: 'b', curve: [{ date: '2026-10-02', planned: 50, actual: null }] }),
    ])
    expect(result.at(-1)?.actual).toBeNull()
  })
})
