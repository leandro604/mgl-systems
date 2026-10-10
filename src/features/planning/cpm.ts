import type { TaskDependencyRow, TaskRow } from '@/types/domain'

const MS_DAY = 86_400_000

export type CpmTaskMetric = {
  taskId: string
  duration: number
  earlyStart: number
  earlyFinish: number
  lateStart: number
  lateFinish: number
  slack: number
  critical: boolean
}

export type CpmResult = {
  projectDuration: number
  metrics: Map<string, CpmTaskMetric>
  criticalTaskIds: string[]
  cycleDetected: boolean
}

function diffDays(start: string, end: string) {
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  return Math.max(0, Math.round((b - a) / MS_DAY))
}

export function taskDurationDays(task: Pick<TaskRow, 'task_type' | 'starts_on' | 'due_on'>) {
  if (task.task_type === 'milestone') return 0
  if (!task.starts_on || !task.due_on) return 1
  return Math.max(1, diffDays(task.starts_on, task.due_on) + 1)
}

function relationOffset(
  predecessorDuration: number,
  successorDuration: number,
  type: string,
  lag: number,
) {
  switch (type) {
    case 'SS': return lag
    case 'FF': return predecessorDuration + lag - successorDuration
    case 'SF': return lag - successorDuration
    case 'FS':
    default: return predecessorDuration + lag
  }
}

export type CpmTaskInput = Pick<TaskRow, 'id' | 'deleted_at' | 'task_type' | 'starts_on' | 'due_on'>

export function calculateCpm(
  tasks: readonly CpmTaskInput[],
  dependencies: readonly TaskDependencyRow[],
): CpmResult {
  const nodes = tasks.filter((task) => task.deleted_at === null && task.task_type !== 'summary')
  const nodeById = new Map(nodes.map((task) => [task.id, task]))
  const duration = new Map(nodes.map((task) => [task.id, taskDurationDays(task)]))
  const incoming = new Map(nodes.map((task) => [task.id, 0]))
  const outgoing = new Map(nodes.map((task) => [task.id, [] as Array<{ to: string; offset: number }>]))

  for (const dep of dependencies) {
    if (dep.deleted_at !== null) continue
    const predecessor = nodeById.get(dep.depends_on_task_id)
    const successor = nodeById.get(dep.task_id)
    if (!predecessor || !successor) continue
    const offset = relationOffset(
      duration.get(predecessor.id) ?? 0,
      duration.get(successor.id) ?? 0,
      dep.dependency_type,
      dep.lag_days,
    )
    outgoing.get(predecessor.id)?.push({ to: successor.id, offset })
    incoming.set(successor.id, (incoming.get(successor.id) ?? 0) + 1)
  }

  const queue = nodes.filter((task) => (incoming.get(task.id) ?? 0) === 0).map((task) => task.id)
  const order: string[] = []
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i]!
    order.push(id)
    for (const edge of outgoing.get(id) ?? []) {
      const next = (incoming.get(edge.to) ?? 0) - 1
      incoming.set(edge.to, next)
      if (next === 0) queue.push(edge.to)
    }
  }

  if (order.length !== nodes.length) {
    return { projectDuration: 0, metrics: new Map(), criticalTaskIds: [], cycleDetected: true }
  }

  const earlyStart = new Map(nodes.map((task) => [task.id, 0]))
  for (const id of order) {
    const base = earlyStart.get(id) ?? 0
    for (const edge of outgoing.get(id) ?? []) {
      earlyStart.set(edge.to, Math.max(earlyStart.get(edge.to) ?? 0, base + edge.offset, 0))
    }
  }

  let projectDuration = 0
  for (const task of nodes) {
    projectDuration = Math.max(projectDuration, (earlyStart.get(task.id) ?? 0) + (duration.get(task.id) ?? 0))
  }

  const lateStart = new Map(nodes.map((task) => [task.id, projectDuration - (duration.get(task.id) ?? 0)]))
  for (const id of [...order].reverse()) {
    for (const edge of outgoing.get(id) ?? []) {
      const candidate = (lateStart.get(edge.to) ?? 0) - edge.offset
      lateStart.set(id, Math.min(lateStart.get(id) ?? candidate, candidate))
    }
  }

  const metrics = new Map<string, CpmTaskMetric>()
  const criticalTaskIds: string[] = []
  for (const id of order) {
    const d = duration.get(id) ?? 0
    const es = earlyStart.get(id) ?? 0
    const ls = lateStart.get(id) ?? es
    const slack = Math.max(0, ls - es)
    const metric: CpmTaskMetric = {
      taskId: id,
      duration: d,
      earlyStart: es,
      earlyFinish: es + d,
      lateStart: ls,
      lateFinish: ls + d,
      slack,
      critical: slack < 0.000001,
    }
    metrics.set(id, metric)
    if (metric.critical) criticalTaskIds.push(id)
  }
  return { projectDuration, metrics, criticalTaskIds, cycleDetected: false }
}
