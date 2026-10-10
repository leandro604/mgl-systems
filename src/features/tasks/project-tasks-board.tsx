'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CirclePlus,
  Layers3,
  Link2,
  LoaderCircle,
  RefreshCw,
  Trash2,
  WifiOff,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolveOperationalRuntime, syncOperationalRuntimeNow, type OperationalRuntime } from '@/features/operations-local-runtime'
import type { LocalTask, LocalTaskDependency } from '@/lib/db/schema'
import { useSyncStore } from '@/stores/sync-store'
import type { TaskDependencyRow, TaskRow } from '@/types/domain'
import { cn } from '@/lib/utils'
import {
  ALL_STAGES,
  budgetItemsForStage,
  filterTasksByStage,
  stageLabel,
  type TaskBudgetItemOption,
  type TaskStageOption,
} from './task6-kanban'
import {
  createDependencyLocal,
  createTaskLocal,
  setDependencyDeletedLocal,
  setTaskDeletedLocal,
  updateTaskLocal,
} from './repository'

type Member = { user_id: string; full_name: string; role: string }

type Props = {
  projectId: string
  initialTasks: TaskRow[]
  initialDependencies: TaskDependencyRow[]
  members: Member[]
  stages: TaskStageOption[]
  budgetItems: TaskBudgetItemOption[]
  focusTaskId?: string
}

const columns = [
  { key: 'todo', label: 'Por hacer' },
  { key: 'in_progress', label: 'En curso' },
  { key: 'blocked', label: 'Bloqueadas' },
  { key: 'done', label: 'Terminadas' },
] as const

const priorityLabel: Record<number, string> = {
  1: 'Baja',
  2: 'Media',
  3: 'Alta',
  4: 'Crítica',
}

function localTask(row: TaskRow): LocalTask {
  return {
    ...row,
    pending_sync: false,
    sync_error: null,
    local_updated_at: row.updated_at,
  }
}

function localDependency(row: TaskDependencyRow): LocalTaskDependency {
  return {
    ...row,
    pending_sync: false,
    sync_error: null,
    local_updated_at: row.updated_at,
  }
}

export function ProjectTasksBoard({
  projectId,
  initialTasks,
  initialDependencies,
  members,
  stages,
  budgetItems,
  focusTaskId,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [tasks, setTasks] = useState<LocalTask[]>(() => initialTasks.map(localTask))
  const [dependencies, setDependencies] = useState<LocalTaskDependency[]>(() =>
    initialDependencies.map(localDependency),
  )
  const [stageFilter, setStageFilter] = useState<string>(ALL_STAGES)
  const [newTaskStageId, setNewTaskStageId] = useState<string>(stages[0]?.id ?? '')
  const [newTaskBudgetItemId, setNewTaskBudgetItemId] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(focusTaskId ?? null)
  const focusedTaskAvailable = focusTaskId ? tasks.some((task) => task.id === focusTaskId && !task.deleted_at) : false
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)

  const refresh = useCallback(async () => {
    const { db } = await resolveOperationalRuntime()
    const [localTasks, localDeps] = await Promise.all([
      db.tasks.where('project_id').equals(projectId).toArray(),
      db.taskDependencies.where('project_id').equals(projectId).toArray(),
    ])

    if (localTasks.length > 0 || initialTasks.length === 0) {
      setTasks(localTasks.filter((task) => task.deleted_at === null))
    }

    if (localDeps.length > 0 || initialDependencies.length === 0) {
      setDependencies(localDeps.filter((dep) => dep.deleted_at === null))
    }
  }, [projectId, initialDependencies.length, initialTasks.length])

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    void refresh()

    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [lastSyncedAt, refresh])

  useEffect(() => {
    if (!focusTaskId || !focusedTaskAvailable) return
    setFocusedTaskId(focusTaskId)
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`task-${focusTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    const timer = window.setTimeout(() => setFocusedTaskId(null), 4000)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [focusTaskId, focusedTaskAvailable])

  const memberName = useMemo(
    () => new Map(members.map((member) => [member.user_id, member.full_name])),
    [members],
  )
  const taskName = useMemo(
    () => new Map(tasks.map((task) => [task.id, task.title])),
    [tasks],
  )
  const stageById = useMemo(
    () => new Map(stages.map((stage) => [stage.id, stage])),
    [stages],
  )
  const budgetItemById = useMemo(
    () => new Map(budgetItems.map((item) => [item.id, item])),
    [budgetItems],
  )
  const filteredTasks = useMemo(
    () => filterTasksByStage(tasks, stageFilter),
    [tasks, stageFilter],
  )
  const availableBudgetItems = useMemo(
    () => budgetItemsForStage(budgetItems, newTaskStageId),
    [budgetItems, newTaskStageId],
  )

  function chooseFilter(stageId: string) {
    setStageFilter(stageId)
    if (stageId !== ALL_STAGES) {
      setNewTaskStageId(stageId)
      setNewTaskBudgetItemId('')
    }
  }

  async function syncAfterWrite(runtime: OperationalRuntime, successMessage?: string) {
    if (!navigator.onLine) {
      setMessage('Cambio guardado sin conexión. Quedó pendiente para sincronizar.')
      return
    }

    try {
      await syncOperationalRuntimeNow(runtime)
      if (successMessage) setMessage(successMessage)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'No se pudo completar la sincronización.'
      setMessage(`Cambio guardado localmente, pero no llegó a Supabase: ${detail}`)
    }
  }

  async function retryTaskSync(taskId: string) {
    setBusyTaskId(taskId)
    setMessage('')
    try {
      const runtime = await resolveOperationalRuntime()
      await syncOperationalRuntimeNow(runtime)
      const current = await runtime.db.tasks.get(taskId)
      await refresh()
      if (!current) {
        setMessage('La tarea ya no está disponible localmente.')
      } else if (current.sync_error) {
        setMessage(`La tarea sigue bloqueada: ${current.sync_error}`)
      } else if (current.pending_sync) {
        setMessage('La tarea sigue pendiente. Revisa el estado de sincronización en la barra superior.')
      } else {
        setMessage('Tarea sincronizada con Supabase correctamente.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo reintentar la sincronización.')
      await refresh()
    } finally {
      setBusyTaskId(null)
    }
  }

  async function createTask(formData: FormData) {
    setBusy(true)
    setMessage('')

    try {
      const stageId = String(formData.get('stage_id') ?? '')
      if (!stageId) throw new Error('Selecciona una etapa para la tarea.')

      const runtime = await resolveOperationalRuntime()
      const created = await createTaskLocal(runtime.db, runtime.identity, projectId, {
        title: String(formData.get('title') ?? ''),
        description: String(formData.get('description') ?? ''),
        priority: Number(formData.get('priority') ?? 2),
        assignee_id: String(formData.get('assignee_id') ?? '') || null,
        starts_on: String(formData.get('starts_on') ?? '') || null,
        due_on: String(formData.get('due_on') ?? '') || null,
        stage_id: stageId,
        budget_item_id: String(formData.get('budget_item_id') ?? '') || null,
        status: 'todo',
        progress: 0,
      })

      formRef.current?.reset()
      setNewTaskBudgetItemId('')
      await syncAfterWrite(runtime, 'Tarea creada y sincronizada con Supabase.')
      const current = await runtime.db.tasks.get(created.id)
      await refresh()
      if (current?.sync_error) setMessage(`Tarea guardada, pero bloqueada: ${current.sync_error}`)
      else if (current?.pending_sync && navigator.onLine) setMessage('Tarea guardada, pero sigue pendiente. Usa Reintentar para forzar el envío.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la tarea.')
    } finally {
      setBusy(false)
    }
  }

  async function moveTask(
    task: LocalTask,
    status: 'todo' | 'in_progress' | 'blocked' | 'done',
  ) {
    setBusyTaskId(task.id)
    setMessage('')

    const progress = status === 'done' ? 100 : Math.min(task.progress, 99)
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status, progress, pending_sync: true } : item,
      ),
    )

    try {
      const runtime = await resolveOperationalRuntime()
      await updateTaskLocal(runtime.db, runtime.identity, task.id, { status, progress })
      await syncAfterWrite(runtime)
      await refresh()
    } catch (error) {
      await refresh()
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la tarea.')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function updateProgress(task: LocalTask, value: number) {
    setBusyTaskId(task.id)
    setMessage('')

    const progress = Math.max(0, Math.min(100, value))
    const status = progress === 100 ? 'done' : task.status === 'done' ? 'in_progress' : task.status
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, progress, status, pending_sync: true } : item,
      ),
    )

    try {
      const runtime = await resolveOperationalRuntime()
      await updateTaskLocal(runtime.db, runtime.identity, task.id, { progress, status })
      await syncAfterWrite(runtime)
      await refresh()
    } catch (error) {
      await refresh()
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el progreso.')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function removeTask(taskId: string) {
    setBusyTaskId(taskId)
    setMessage('')

    try {
      const runtime = await resolveOperationalRuntime()
      await setTaskDeletedLocal(runtime.db, runtime.identity, taskId, true)
      await syncAfterWrite(runtime)
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo archivar la tarea.')
    } finally {
      setBusyTaskId(null)
    }
  }

  async function addDependency(formData: FormData) {
    setBusy(true)
    setMessage('')

    try {
      const task_id = String(formData.get('task_id') ?? '')
      const depends_on_task_id = String(formData.get('depends_on_task_id') ?? '')
      const runtime = await resolveOperationalRuntime()
      await createDependencyLocal(runtime.db, runtime.identity, projectId, { task_id, depends_on_task_id })
      await syncAfterWrite(runtime)
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la dependencia.')
    } finally {
      setBusy(false)
    }
  }

  async function removeDependency(dependencyId: string) {
    setBusy(true)
    setMessage('')

    try {
      const runtime = await resolveOperationalRuntime()
      await setDependencyDeletedLocal(runtime.db, runtime.identity, dependencyId, true)
      await syncAfterWrite(runtime)
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo retirar la dependencia.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2">
              <Layers3 className="size-4 text-blue-600" strokeWidth={1.5} />
              <h2 className="text-lg font-medium text-slate-950">Kanban por etapa</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Filtra el tablero sin perder el estado local-first de las tareas.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {!online ? <WifiOff className="size-4 text-amber-500" /> : null}
            <span>{filteredTasks.length} tarea(s) visibles</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <Chip selected={stageFilter === ALL_STAGES} onClick={() => chooseFilter(ALL_STAGES)}>
            Todas · {tasks.length}
          </Chip>
          {stages.map((stage) => {
            const count = tasks.filter((task) => task.stage_id === stage.id).length
            return (
              <Chip
                key={stage.id}
                selected={stageFilter === stage.id}
                onClick={() => chooseFilter(stage.id)}
              >
                {stageLabel(stage)} · {count}
              </Chip>
            )
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <form
          ref={formRef}
          action={createTask}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <h2 className="text-lg font-medium text-slate-950">Nueva tarea</h2>
            <p className="mt-1 text-sm text-slate-500">
              La etapa es obligatoria. La partida es opcional y debe pertenecer a la misma etapa.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              name="title"
              required
              maxLength={250}
              placeholder="Ej. Certificar puntos de red del piso 2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Descripción</Label>
            <textarea
              id="task-description"
              name="description"
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              placeholder="Alcance, criterio de aceptación, observaciones…"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-xs font-semibold text-slate-700">
              Etapa *
              <select
                name="stage_id"
                required
                value={newTaskStageId}
                onChange={(event) => {
                  setNewTaskStageId(event.target.value)
                  setNewTaskBudgetItemId('')
                }}
                className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="" disabled>Seleccionar etapa…</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stageLabel(stage)}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-xs font-semibold text-slate-700">
              Partida opcional
              <select
                name="budget_item_id"
                value={newTaskBudgetItemId}
                onChange={(event) => setNewTaskBudgetItemId(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">Sin partida vinculada</option>
                {availableBudgetItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.description}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-xs font-semibold text-slate-700">
              Prioridad
              <select
                name="priority"
                defaultValue="2"
                className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="1">Baja</option>
                <option value="2">Media</option>
                <option value="3">Alta</option>
                <option value="4">Crítica</option>
              </select>
            </label>

            <label className="space-y-2 text-xs font-semibold text-slate-700">
              Responsable
              <select
                name="assignee_id"
                className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">Sin asignar</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>{member.full_name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Inicio</Label>
              <Input name="starts_on" type="date" />
            </div>
            <div className="space-y-2">
              <Label>Vencimiento</Label>
              <Input name="due_on" type="date" />
            </div>
          </div>

          <Button type="submit" disabled={busy || !newTaskStageId}>
            <CirclePlus />
            {busy ? 'Guardando…' : 'Crear tarea'}
          </Button>
        </form>

        <div className="mgl-dependencies-panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-slate-950">Dependencias</h2>
              <p className="mt-1 text-sm text-slate-500">
                Define qué tarea debe terminar antes que otra.
              </p>
            </div>
            <Link2 className="size-4 text-blue-600" strokeWidth={1.5} />
          </div>

          <form action={addDependency} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
            <label className="text-xs font-semibold text-slate-700">
              Tarea
              <select name="task_id" required className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
                <option value="">Seleccionar…</option>
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </label>
            <span className="hidden pb-2 text-xs text-slate-500 md:block">depende de</span>
            <label className="text-xs font-semibold text-slate-700">
              Predecesora
              <select name="depends_on_task_id" required className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
                <option value="">Seleccionar…</option>
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </label>
            <Button type="submit" variant="secondary" size="sm" disabled={busy || tasks.length < 2}>
              Vincular
            </Button>
          </form>

          <div className="mt-5 space-y-2">
            {dependencies.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                No hay dependencias activas.
              </p>
            ) : dependencies.map((dep) => (
              <div key={dep.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  <strong className="font-semibold text-slate-900">{taskName.get(dep.task_id) ?? 'Tarea'}</strong>
                  {' '}depende de {taskName.get(dep.depends_on_task_id) ?? 'otra tarea'}
                </span>
                {dep.pending_sync ? <Badge variant="warning">Pendiente</Badge> : null}
                <Button type="button" size="icon" variant="ghost" onClick={() => void removeDependency(dep.id)} disabled={busy}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {message ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {busy ? <LoaderCircle className="size-4 animate-spin text-blue-600" /> : !online ? <WifiOff className="size-4 text-amber-500" /> : null}
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const items = filteredTasks.filter((task) => task.status === column.key && task.deleted_at === null)

          return (
            <div key={column.key} className="min-h-64 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-700">{column.label}</h3>
                <Badge>{items.length}</Badge>
              </div>

              <div className="space-y-3">
                {items.map((task) => {
                  const stage = task.stage_id ? stageById.get(task.stage_id) : undefined
                  const budgetItem = task.budget_item_id ? budgetItemById.get(task.budget_item_id) : undefined
                  const taskBusy = busyTaskId === task.id

                  return (
                    <article id={`task-${task.id}`} key={task.id} className={cn('rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow', focusedTaskId === task.id && 'border-blue-300 ring-2 ring-blue-200 ring-offset-2') }>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900">{task.title}</h4>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                            {task.description || 'Sin descripción'}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {task.sync_error ? (
                            <Badge variant="danger" title={task.sync_error}>Error sync</Badge>
                          ) : task.pending_sync ? (
                            <Badge variant="warning" className="gap-1">
                              <RefreshCw className="size-3 animate-spin" />
                              Pendiente
                            </Badge>
                          ) : (
                            <Badge variant="success">Sync</Badge>
                          )}
                          {(task.pending_sync || task.sync_error) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              disabled={taskBusy || !online}
                              onClick={() => void retryTaskSync(task.id)}
                              title={task.sync_error ?? 'Forzar sincronización ahora'}
                            >
                              <RefreshCw className={cn('size-3', taskBusy && 'animate-spin')} />
                              Reintentar
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {stage ? <Badge variant="info">{stage.code} · {stage.name.replace(/^\s*[^_]+_/, '')}</Badge> : <Badge variant="danger">Sin etapa</Badge>}
                        {budgetItem ? <Badge>{budgetItem.code}</Badge> : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span>{priorityLabel[task.priority]}</span>
                        {task.assignee_id ? <span>· {memberName.get(task.assignee_id) ?? 'Responsable'}</span> : null}
                        {task.due_on ? <span>· vence {task.due_on}</span> : null}
                      </div>

                      <div className="mt-4">
                        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                          <span>Progreso</span>
                          <span>{task.progress}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="10"
                          value={task.progress}
                          onChange={(event) => void updateProgress(task, Number(event.target.value))}
                          disabled={taskBusy}
                          className="w-full accent-blue-600"
                        />
                      </div>

                      <div className="mt-4 flex gap-2">
                        <select
                          value={task.status}
                          onChange={(event) => void moveTask(task, event.target.value as typeof task.status)}
                          disabled={taskBusy}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
                        >
                          <option value="todo">Por hacer</option>
                          <option value="in_progress">En curso</option>
                          <option value="blocked">Bloqueada</option>
                          <option value="done">Terminada</option>
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={taskBusy}
                          onClick={() => void removeTask(task.id)}
                          title="Archivar"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </article>
                  )
                })}

                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
                    Sin tareas en esta columna
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
