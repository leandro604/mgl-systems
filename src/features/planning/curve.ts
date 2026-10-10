import type { Database } from '@/lib/supabase/database.types'
import type { TaskRow } from '@/types/domain'

const MS_DAY = 86_400_000

type BaselineTask = Database['public']['Tables']['schedule_baseline_tasks']['Row']
type ProgressRow = Database['public']['Tables']['task_progress_history']['Row']

function dayStamp(value: string) {
  return Date.parse(`${value.slice(0, 10)}T00:00:00Z`)
}
function isoDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}
function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

export function plannedTaskProgress(task: Pick<BaselineTask, 'task_type' | 'starts_on' | 'due_on'>, date: string) {
  if (!task.starts_on || !task.due_on) return 0
  const current = dayStamp(date)
  const start = dayStamp(task.starts_on)
  const finish = dayStamp(task.due_on)
  if (task.task_type === 'milestone') return current >= start ? 100 : 0
  if (current <= start) return current < start ? 0 : 0
  if (current >= finish) return 100
  const total = Math.max(1, (finish - start) / MS_DAY)
  return clamp(((current - start) / MS_DAY) / total * 100)
}

export function weightedCurrentProgress(tasks: Array<Pick<TaskRow, 'task_type' | 'planned_weight' | 'progress' | 'deleted_at'>>) {
  const eligible = tasks.filter((task) => task.deleted_at === null && task.task_type !== 'summary' && task.planned_weight > 0)
  const weight = eligible.reduce((sum, task) => sum + Number(task.planned_weight), 0)
  if (weight <= 0) return 0
  return eligible.reduce((sum, task) => sum + Number(task.planned_weight) * Number(task.progress), 0) / weight
}

export function weightedPlannedProgress(tasks: BaselineTask[], date: string) {
  const eligible = tasks.filter((task) => task.deleted_at === null && task.task_type !== 'summary' && task.planned_weight > 0)
  const weight = eligible.reduce((sum, task) => sum + Number(task.planned_weight), 0)
  if (weight <= 0) return 0
  return eligible.reduce((sum, task) => sum + Number(task.planned_weight) * plannedTaskProgress(task, date), 0) / weight
}

function actualAt(tasks: BaselineTask[], history: ProgressRow[], stamp: number): number | null {
  const rows = new Map<string, ProgressRow[]>()
  for (const entry of history) {
    const list = rows.get(entry.task_id) ?? []
    list.push(entry)
    rows.set(entry.task_id, list)
  }
  let totalWeight = 0
  let weighted = 0
  let known = 0
  for (const task of tasks) {
    if (task.deleted_at !== null || task.task_type === 'summary' || task.planned_weight <= 0) continue
    const list = (rows.get(task.task_id) ?? []).filter((entry) => Date.parse(entry.recorded_at) <= stamp).sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))
    const latest = list[0]
    if (!latest) continue
    const weight = Number(task.planned_weight)
    totalWeight += weight
    weighted += weight * Number(latest.progress)
    known += 1
  }
  return known === 0 || totalWeight <= 0 ? null : weighted / totalWeight
}

export function weightedActualProgressAt(tasks: BaselineTask[], history: ProgressRow[], date: string) {
  return actualAt(tasks, history, dayStamp(date) + MS_DAY - 1)
}

export type CurvePoint = { date: string; planned: number; actual: number | null }

export function buildSCurve(baselineTasks: BaselineTask[], history: ProgressRow[], asOf = new Date().toISOString().slice(0, 10), maxPoints = 28): CurvePoint[] {
  const scheduled = baselineTasks.filter((task) => task.deleted_at === null && task.task_type !== 'summary' && task.starts_on && task.due_on)
  if (scheduled.length === 0) return []
  const min = Math.min(...scheduled.map((task) => dayStamp(task.starts_on!)))
  const asOfStamp = dayStamp(asOf)
  const max = Math.max(asOfStamp, ...scheduled.map((task) => dayStamp(task.due_on!)))
  const days = Math.max(1, Math.round((max - min) / MS_DAY))
  const step = Math.max(1, Math.ceil(days / Math.max(1, maxPoints - 1)))
  const points: CurvePoint[] = []
  for (let stamp = min; stamp <= max; stamp += step * MS_DAY) {
    const date = isoDay(stamp)
    points.push({ date, planned: weightedPlannedProgress(baselineTasks, date), actual: stamp <= asOfStamp ? actualAt(baselineTasks, history, stamp + MS_DAY - 1) : null })
  }
  if (points.at(-1)?.date !== isoDay(max)) {
    points.push({ date: isoDay(max), planned: weightedPlannedProgress(baselineTasks, isoDay(max)), actual: max <= asOfStamp ? actualAt(baselineTasks, history, max + MS_DAY - 1) : null })
  }
  return points
}
