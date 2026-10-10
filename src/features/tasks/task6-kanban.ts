import type { LocalTask } from '@/lib/db/schema'

export type TaskStageOption = {
  id: string
  code: string
  name: string
  sort_order: number
  is_locked: boolean
}

export type TaskBudgetItemOption = {
  id: string
  code: string
  description: string
  stage_id: string
}

export const ALL_STAGES = 'all'

export function filterTasksByStage(tasks: LocalTask[], stageId: string): LocalTask[] {
  if (stageId === ALL_STAGES) return tasks
  return tasks.filter((task) => task.stage_id === stageId)
}

export function budgetItemsForStage(items: TaskBudgetItemOption[], stageId: string): TaskBudgetItemOption[] {
  if (!stageId) return []
  return items.filter((item) => item.stage_id === stageId)
}

export function stageLabel(stage: TaskStageOption): string {
  const cleanName = stage.name.replace(/^\s*[^_]+_/, '')
  return `${stage.code} · ${cleanName || stage.name}`
}
