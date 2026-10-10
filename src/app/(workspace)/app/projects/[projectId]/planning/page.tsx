import { getProjectPlanning } from '@/features/planning/server'
import { PlanningWorkspace } from '@/features/planning/planning-workspace'

export const dynamic = 'force-dynamic'

export default async function ProjectPlanningPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const data = await getProjectPlanning(projectId)
  return <PlanningWorkspace
    projectId={projectId}
    role={data.profile.role}
    initialTasks={data.tasks}
    initialDependencies={data.dependencies}
    baseline={data.baseline}
    baselineTasks={data.baselineTasks}
    baselineDependencies={data.baselineDependencies}
    progressHistory={data.progressHistory}
    budgetItems={data.budgetItems}
    members={data.members}
  />
}
