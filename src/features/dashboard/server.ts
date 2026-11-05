import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { requireWorkspaceContext } from '@/features/auth/server'
import { canAccessFinancialModules } from '@/features/auth/roles'
import { getProjectPlanning } from '@/features/planning/server'
import { buildSCurve, weightedCurrentProgress } from '@/features/planning/curve'
import { getStageDashboardData } from '@/features/projects/stage-dashboard-data'
import { buildDashboardData, type DashboardProject } from './model'

type Project = { id: string; code: string; name: string }

export const getDashboardProject = cache(async (project: Project) => {
  const context = await requireWorkspaceContext()
  if (!canAccessFinancialModules(context.profile.role) || !context.projects.some((visible) => visible.id === project.id)) {
    throw new Error('Dashboard financiero no autorizado')
  }
  const supabase = await createClient()
  const [stages, planning, financial, control] = await Promise.all([
    getStageDashboardData(project.id),
    getProjectPlanning(project.id),
    supabase.from('project_financial_summary').select('committed_cost').eq('project_id', project.id).maybeSingle(),
    supabase.from('project_control_summary').select('physical_progress_pct,budget_total_net').eq('project_id', project.id).maybeSingle(),
  ])
  if (financial.error) throw financial.error
  if (control.error) throw control.error
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: context.company.timezone || 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const data: DashboardProject = {
    ...project,
    budget: stages.quotedTotal,
    executed: stages.actualTotal,
    committed: Number(financial.data?.committed_cost ?? 0),
    progress: Number(control.data?.budget_total_net ?? 0) > 0
      ? Number(control.data?.physical_progress_pct ?? 0)
      : weightedCurrentProgress(planning.tasks),
    curve: planning.baseline ? buildSCurve(planning.baselineTasks, planning.progressHistory, today) : [],
    criticalItems: stages.topDeviations.map((item) => ({ ...item, projectId: project.id, projectName: project.name })),
  }
  return { data, stages: stages.stages }
})

export async function getPortfolioDashboard(projects: Project[]) {
  const data: DashboardProject[] = []
  // Bound concurrent requests for workspaces with many projects.
  for (let offset = 0; offset < projects.length; offset += 4) {
    const batch = await Promise.all(projects.slice(offset, offset + 4).map(getDashboardProject))
    data.push(...batch.map((item) => item.data))
  }
  return buildDashboardData(data)
}
