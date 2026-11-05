import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ context: vi.fn(), client: vi.fn(), stages: vi.fn(), planning: vi.fn() }))
vi.mock('@/features/auth/server', () => ({ requireWorkspaceContext: mocks.context }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/features/projects/stage-dashboard-data', () => ({ getStageDashboardData: mocks.stages }))
vi.mock('@/features/planning/server', () => ({ getProjectPlanning: mocks.planning }))

import { getDashboardProject } from '@/features/dashboard/server'

describe('dashboard server read scope', () => {
  const project = { id: 'visible-project', code: '01', name: 'Proyecto' }
  const queries: Array<{ table: string; column: string; value: string }> = []
  let controlError: object | null = null
  beforeEach(() => {
    vi.clearAllMocks()
    queries.length = 0
    controlError = null
    mocks.context.mockResolvedValue({ profile: { role: 'admin' }, projects: [project], company: { timezone: 'America/Lima' } })
    mocks.stages.mockResolvedValue({ quotedTotal: 200, actualTotal: 250, stages: [], topDeviations: [] })
    mocks.planning.mockResolvedValue({ baseline: null, baselineTasks: [], progressHistory: [], tasks: [] })
    mocks.client.mockResolvedValue({ from: (table: string) => ({ select: () => ({ eq: (column: string, value: string) => {
      queries.push({ table, column, value })
      return { maybeSingle: async () => table === 'project_financial_summary'
        ? { data: { committed_cost: 120 }, error: null }
        : { data: { budget_total_net: 200, physical_progress_pct: 75 }, error: controlError } }
    } }) }) })
  })

  it('reads both summaries only for the authorized project and preserves source amounts', async () => {
    const result = await getDashboardProject(project)
    expect(queries).toEqual([
      { table: 'project_financial_summary', column: 'project_id', value: project.id },
      { table: 'project_control_summary', column: 'project_id', value: project.id },
    ])
    expect(result.data).toMatchObject({ budget: 200, executed: 250, committed: 120, progress: 75, curve: [] })
    expect(mocks.stages).toHaveBeenCalledWith(project.id)
    expect(mocks.planning).toHaveBeenCalledWith(project.id)
  })

  it('does not request financial data for a supervisor', async () => {
    mocks.context.mockResolvedValue({ profile: { role: 'supervisor' }, projects: [project] })
    await expect(getDashboardProject(project)).rejects.toThrow('no autorizado')
    expect(mocks.client).not.toHaveBeenCalled()
    expect(mocks.stages).not.toHaveBeenCalled()
    expect(mocks.planning).not.toHaveBeenCalled()
  })

  it('does not request data for a project outside the visible workspace', async () => {
    await expect(getDashboardProject({ ...project, id: 'foreign-project' })).rejects.toThrow('no autorizado')
    expect(mocks.client).not.toHaveBeenCalled()
  })

  it('propagates query failures rather than silently displaying false zero costs', async () => {
    controlError = { code: '42501', message: 'permission denied' }
    await expect(getDashboardProject(project)).rejects.toEqual(controlError)
  })
})
