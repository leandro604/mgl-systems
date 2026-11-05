import type { CurvePoint } from '@/features/planning/curve'
import type { TopDeviation } from '@/features/projects/stage-dashboard-model'

export type CriticalItem = TopDeviation & { projectId: string; projectName: string }
export type DashboardProject = {
  id: string
  code: string
  name: string
  budget: number
  executed: number
  committed: number
  progress: number
  curve: CurvePoint[]
  criticalItems: CriticalItem[]
}
export type DashboardData = {
  budget: number
  executed: number
  committed: number
  progress: number
  variance: number
  curve: CurvePoint[]
  criticalItems: CriticalItem[]
  projects: DashboardProject[]
}

// Aggregate on a common date axis. Missing actual observations stay null;
// future execution is never projected or filled with fabricated progress.
export function aggregateCurves(projects: DashboardProject[]): CurvePoint[] {
  const eligible = projects.filter((project) => project.curve.length > 0)
  const dates = [...new Set(eligible.flatMap((project) => project.curve.map((point) => point.date)))].sort()
  return dates.map((date) => {
    let planned = 0, actual = 0, weight = 0, actualWeight = 0
    for (const project of eligible) {
      const contribution = project.budget > 0 ? project.budget : 1
      const before = project.curve.filter((point) => point.date <= date).at(-1)
      const after = project.curve.find((point) => point.date > date)
      let plan = before?.planned ?? 0
      if (before && after) {
        const fraction = (Date.parse(date) - Date.parse(before.date)) / (Date.parse(after.date) - Date.parse(before.date))
        plan += (after.planned - before.planned) * fraction
      }
      planned += plan * contribution
      weight += contribution
      // Require a known observation for every included project at this date.
      const lastActualDate = project.curve.filter((point) => point.actual != null).at(-1)?.date
      if (before?.actual != null && lastActualDate && date <= lastActualDate) {
        actual += before.actual * contribution
        actualWeight += contribution
      }
    }
    return { date, planned: weight ? planned / weight : 0, actual: actualWeight === weight && weight > 0 ? actual / weight : null }
  })
}

export function buildDashboardData(projects: DashboardProject[]): DashboardData {
  const budget = projects.reduce((sum, project) => sum + project.budget, 0)
  const executed = projects.reduce((sum, project) => sum + project.executed, 0)
  const weights = projects.map((project) => project.budget > 0 ? project.budget : 1)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  return {
    budget,
    executed,
    committed: projects.reduce((sum, project) => sum + project.committed, 0),
    progress: totalWeight ? projects.reduce((sum, project, index) => sum + Math.max(0, Math.min(100, project.progress)) * weights[index]!, 0) / totalWeight : 0,
    variance: budget - executed,
    curve: projects.length === 1 ? projects[0]!.curve : aggregateCurves(projects),
    criticalItems: projects.flatMap((project) => project.criticalItems)
      .filter((item) => item.deviation_amount > 0)
      .sort((a, b) => b.deviation_amount - a.deviation_amount || a.id.localeCompare(b.id)).slice(0, 5),
    projects,
  }
}
