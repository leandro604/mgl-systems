'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarDays, Flag, CalendarRange, Link2, LoaderCircle, Route, Save, Trash2, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolveOperationalRuntime } from '@/features/operations-local-runtime'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import type { LocalTask, LocalTaskDependency } from '@/lib/db/schema'
import type { TaskDependencyRow, TaskRow } from '@/types/domain'
import { useSyncStore } from '@/stores/sync-store'
import { createDependencyLocal, setDependencyDeletedLocal, updateDependencyLocal, updateTaskLocal } from '@/features/tasks/repository'
import { buildSCurve, weightedActualProgressAt, weightedCurrentProgress, weightedPlannedProgress } from './curve'
import { calculateCpm, taskDurationDays } from './cpm'
import { dependencyLabel, planningHealth, taskTypeLabel } from './format'
import { SCurveChart } from '@/features/dashboard/charts'
import styles from './schedule.module.css'
import { ScheduleInsights } from './schedule-insights'
import type { PlanningBudgetItem, PlanningMember } from './server'

type Baseline = Database['public']['Tables']['schedule_baselines']['Row']
type BaselineTask = Database['public']['Tables']['schedule_baseline_tasks']['Row']
type BaselineDependency = Database['public']['Tables']['schedule_baseline_dependencies']['Row']
type ProgressRow = Database['public']['Tables']['task_progress_history']['Row']

type Props = {
  projectId: string
  role: string
  initialTasks: TaskRow[]
  initialDependencies: TaskDependencyRow[]
  baseline: Baseline | null
  baselineTasks: BaselineTask[]
  baselineDependencies: BaselineDependency[]
  progressHistory: ProgressRow[]
  budgetItems: PlanningBudgetItem[]
  members: PlanningMember[]
}

const MS_DAY = 86_400_000
const selectClass = 'mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-600'

function toLocalTask(row: TaskRow): LocalTask {
  return {
    ...row,
    pending_sync: false,
    sync_error: null,
    local_updated_at: row.updated_at,
  } as LocalTask
}
function toLocalDependency(row: TaskDependencyRow): LocalTaskDependency {
  return { ...row, pending_sync: false, sync_error: null, local_updated_at: row.updated_at }
}
function day(value: string) { return Date.parse(`${value}T00:00:00Z`) }
function pct(value: number) { return `${Math.max(0, Math.min(100, value)).toFixed(1)}%` }
function localIsoDate() {
  const value = new Date()
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function PlanningWorkspace({ projectId, role, initialTasks, initialDependencies, baseline, baselineTasks, baselineDependencies, progressHistory, budgetItems, members }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState<LocalTask[]>(() => initialTasks.map(toLocalTask))
  const [dependencies, setDependencies] = useState<LocalTaskDependency[]>(() => initialDependencies.map(toLocalDependency))
  const [selectedTaskId, setSelectedTaskId] = useState(initialTasks[0]?.id ?? '')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [taskFilter, setTaskFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(true)
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
  const canPlan = role === 'admin' || role === 'pm' || role === 'supervisor'
  const canBaseline = role === 'admin' || role === 'pm'

  const refreshLocal = useCallback(async () => {
    const { db } = await resolveOperationalRuntime()
    const [localTasks, localDependencies] = await Promise.all([
      db.tasks.where('project_id').equals(projectId).toArray(),
      db.taskDependencies.where('project_id').equals(projectId).toArray(),
    ])
    if (localTasks.length > 0 || initialTasks.length === 0) setTasks(localTasks.filter((task) => task.deleted_at === null))
    if (localDependencies.length > 0 || initialDependencies.length === 0) setDependencies(localDependencies.filter((dep) => dep.deleted_at === null))
  }, [projectId, initialDependencies.length, initialTasks.length])

  useEffect(() => {
    const handler = () => setOnline(navigator.onLine)
    handler(); window.addEventListener('online', handler); window.addEventListener('offline', handler); void refreshLocal()
    return () => { window.removeEventListener('online', handler); window.removeEventListener('offline', handler) }
  }, [refreshLocal])
  useEffect(() => { void refreshLocal() }, [lastSyncedAt, refreshLocal])

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null
  useEffect(() => { if (!selectedTaskId && tasks[0]) setSelectedTaskId(tasks[0].id) }, [selectedTaskId, tasks])

  const orderedTasks = useMemo(() => [...tasks].sort((a, b) => (a.wbs_code || '999999').localeCompare(b.wbs_code || '999999', undefined, { numeric: true }) || a.position - b.position || a.title.localeCompare(b.title)), [tasks])
  const taskName = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks])
  const memberName = useMemo(() => new Map(members.map((member) => [member.user_id, member.full_name])), [members])
  const baselineByTask = useMemo(() => new Map(baselineTasks.map((task) => [task.task_id, task])), [baselineTasks])
  const cpm = useMemo(() => calculateCpm(tasks, dependencies), [tasks, dependencies])
  const today = localIsoDate()
  const plannedToday = baseline ? weightedPlannedProgress(baselineTasks, today) : 0
  const actualToday = baseline ? (weightedActualProgressAt(baselineTasks, progressHistory, today) ?? weightedCurrentProgress(tasks)) : weightedCurrentProgress(tasks)
  const health = baseline ? planningHealth(plannedToday, actualToday) : { label: 'Sin línea base', className: 'border-slate-200 bg-slate-900 text-slate-600' }
  const curve = useMemo(() => buildSCurve(baselineTasks, progressHistory, today), [baselineTasks, progressHistory, today])
  const overdue = tasks.filter((task) => task.task_type !== 'summary' && task.due_on && task.due_on < today && task.progress < 100).length
  const scheduled = tasks.filter((task) => task.task_type !== 'summary' && task.starts_on && task.due_on)
  const scheduleDates = [...scheduled, ...baselineTasks.filter((task) => task.starts_on && task.due_on)].flatMap((task) => [task.starts_on!, task.due_on!])
  const ganttMin = scheduleDates.length ? Math.min(...scheduleDates.map(day)) : day(today)
  const ganttMax = scheduleDates.length ? Math.max(...scheduleDates.map(day)) : ganttMin + MS_DAY
  const ganttSpan = Math.max(MS_DAY, ganttMax - ganttMin + MS_DAY)

  async function saveTaskSchedule(formData: FormData) {
    if (!selectedTask || !canPlan) return
    setBusy(true); setMessage('')
    try {
      const starts = String(formData.get('starts_on') ?? '') || null
      const due = String(formData.get('due_on') ?? '') || null
      const taskType = String(formData.get('task_type') ?? 'activity') as 'activity' | 'milestone' | 'summary'
      if (taskType === 'milestone' && (!starts || due !== starts)) throw new Error('Un hito debe tener la misma fecha de inicio y fin.')
      const { db, identity } = await resolveOperationalRuntime()
      await updateTaskLocal(db, identity, selectedTask.id, {
        wbs_code: String(formData.get('wbs_code') ?? '').trim(),
        task_type: taskType,
        parent_task_id: String(formData.get('parent_task_id') ?? '') || null,
        starts_on: starts,
        due_on: due,
        planned_weight: Number(formData.get('planned_weight') ?? 1),
        budget_item_id: String(formData.get('budget_item_id') ?? '') || null,
      })
      setMessage(online ? 'Planificación guardada' : 'Guardado sin conexión')
      await refreshLocal()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la planificación.') }
    finally { setBusy(false) }
  }

  async function addDependency(formData: FormData) {
    if (!canPlan) return
    setBusy(true); setMessage('')
    try {
      const { db, identity } = await resolveOperationalRuntime()
      await createDependencyLocal(db, identity, projectId, {
        task_id: String(formData.get('task_id') ?? ''),
        depends_on_task_id: String(formData.get('depends_on_task_id') ?? ''),
        dependency_type: String(formData.get('dependency_type') ?? 'FS') as 'FS' | 'SS' | 'FF' | 'SF',
        lag_days: Number(formData.get('lag_days') ?? 0),
      })
      await refreshLocal(); setMessage('Dependencia añadida')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo crear la dependencia.') }
    finally { setBusy(false) }
  }

  async function editDependency(dep: LocalTaskDependency, formData: FormData) {
    setBusy(true); setMessage('')
    try {
      const { db, identity } = await resolveOperationalRuntime()
      await updateDependencyLocal(db, identity, dep.id, {
        dependency_type: String(formData.get('dependency_type') ?? dep.dependency_type) as 'FS' | 'SS' | 'FF' | 'SF',
        lag_days: Number(formData.get('lag_days') ?? dep.lag_days),
      })
      await refreshLocal(); setMessage('Relación actualizada')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la dependencia.') }
    finally { setBusy(false) }
  }

  async function removeDependency(id: string) {
    setBusy(true); setMessage('')
    try { const { db, identity } = await resolveOperationalRuntime(); await setDependencyDeletedLocal(db, identity, id, true); await refreshLocal() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo retirar la dependencia.') }
    finally { setBusy(false) }
  }

  async function createBaseline(formData: FormData) {
    if (!canBaseline) return
    setBusy(true); setMessage('')
    try {
      const name = String(formData.get('baseline_name') ?? '').trim()
      if (name.length < 2) throw new Error('Indica un nombre para la línea base.')
      const { db } = await resolveOperationalRuntime()
      const pending = await db.outbox.where('projectId').equals(projectId).and((item) => item.entity === 'tasks' || item.entity === 'task_dependencies').count()
      if (pending > 0) throw new Error('Primero espera a que las tareas y dependencias pendientes terminen de sincronizarse.')
      const supabase = createClient()
      const { error } = await supabase.rpc('create_schedule_baseline', { p_project_id: projectId, p_name: name })
      if (error) throw error
      setMessage('Línea base creada')
      router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo crear la línea base.') }
    finally { setBusy(false) }
  }


  const visibleTasks = orderedTasks.filter((task) => {
    const matches = `${task.wbs_code} ${task.title}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    return matches && (taskFilter === 'all' || (taskFilter === 'critical' && cpm.metrics.get(task.id)?.critical) || (taskFilter === 'overdue' && task.task_type !== 'summary' && task.due_on && task.due_on < today && task.progress < 100))
  })
  const pageCount = Math.max(1, Math.ceil(visibleTasks.length / 10))
  const currentPage = Math.min(page, pageCount)
  const pageTasks = visibleTasks.slice((currentPage - 1) * 10, currentPage * 10)
  return <div className={styles.workspace}>
    <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">CONTROL DE PLAZOS</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Cronograma maestro</h2></div>{baseline ? <span className="text-xs text-slate-600">Línea base V{baseline.version_no} · {baseline.name}</span> : <span className="text-xs text-slate-600">Sin línea base</span>}</div>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Programadas</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{scheduled.length}/{tasks.filter((t) => t.task_type !== 'summary').length}</p></CardContent></Card>
      <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Ruta crítica</p><p className="mt-2 text-3xl font-semibold tabular-nums text-red-700">{cpm.cycleDetected ? '—' : cpm.criticalTaskIds.length}</p></CardContent></Card>
      <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Duración CPM</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{cpm.cycleDetected ? 'No disponible' : `${cpm.projectDuration} días`}</p></CardContent></Card>
      <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Atrasadas</p><p className="mt-2 text-3xl font-semibold tabular-nums text-amber-700">{overdue}</p></CardContent></Card>
      <Card><CardContent className="p-6"><p className="text-xs text-slate-500">Plan / real</p><p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{baseline ? pct(plannedToday) : '—'} / {pct(actualToday)}</p><Badge className={`mt-2 ${baseline && actualToday - plannedToday < -10 ? styles.danger : baseline && actualToday - plannedToday >= -2 ? styles.success : styles.neutral}`}>{health.label}</Badge></CardContent></Card>
    </section>

    {cpm.cycleDetected ? <p role="alert" className={styles.danger}>Hay dependencias cíclicas. Revisa el detalle CPM antes de interpretar la ruta crítica.</p> : null}
    <ScheduleInsights tasks={tasks} today={today} cpm={cpm} planned={baseline ? plannedToday : null} actual={actualToday} onInspect={(filter) => { setTaskFilter(filter); setPage(1); setQuery(''); document.getElementById('schedule-wbs')?.scrollIntoView({ behavior: 'smooth' }) }}>
      <SCurveChart points={baseline ? curve : []} />
    </ScheduleInsights>

    {message ? <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{busy ? <LoaderCircle className="size-4 animate-spin" /> : !online ? <WifiOff className="size-4 text-amber-700" /> : null}{message}</div> : null}

<details className={styles.disclosure}><summary>Diagrama de Gantt <span>Fechas, duración y ruta crítica</span></summary><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarRange className="size-5 text-blue-700" />Diagrama de Gantt</CardTitle></CardHeader><CardContent><div className={styles.legend}><span><i style={{background:'#2563eb'}} />Actividad</span><span><i style={{background:'#dc2626'}} />Ruta crítica · sin holgura</span><span><i style={{background:'#64748b'}} />Línea base</span><span>Relleno oscuro = avance · ◆ Hito</span></div><div className={styles.scroll}>
      {scheduled.length === 0 ? <p className="text-sm text-slate-500">Sin actividades programadas.</p> : <div className="min-w-[900px] space-y-2"><div className="grid grid-cols-[280px_1fr] gap-3 text-[11px] text-slate-500"><span>Actividad</span><div className="flex justify-between"><span>{new Date(ganttMin).toISOString().slice(0,10)}</span><span>{new Date(ganttMax).toISOString().slice(0,10)}</span></div></div>{orderedTasks.filter((task) => task.task_type !== 'summary' && task.starts_on && task.due_on).map((task) => { const start = day(task.starts_on!); const finish = day(task.due_on!); const left = (start-ganttMin)/ganttSpan*100; const width = Math.max(task.task_type === 'milestone' ? 0 : 0.8, (finish-start+MS_DAY)/ganttSpan*100); const base=baselineByTask.get(task.id); const metric=cpm.metrics.get(task.id); return <div key={task.id} className="grid grid-cols-[280px_1fr] items-center gap-3 rounded-xl border border-slate-900 px-3 py-2"><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{task.wbs_code ? `${task.wbs_code} · ` : ''}{task.title}</p><p className="mt-1 text-[10px] text-slate-600">{taskTypeLabel[task.task_type] ?? task.task_type} · {taskDurationDays(task)} d · {pct(task.progress)} · {task.assignee_id ? memberName.get(task.assignee_id) ?? 'Responsable' : 'Sin responsable'}</p></div><div className="relative h-8 rounded-lg bg-slate-50">{base?.starts_on && base.due_on ? <div className={styles.baselineBar} style={{left:`${(day(base.starts_on)-ganttMin)/ganttSpan*100}%`,width:`${Math.max(.6,(day(base.due_on)-day(base.starts_on)+MS_DAY)/ganttSpan*100)}%`}} /> : null}{task.task_type==='milestone' ? <div className={`absolute top-2.5 size-3 rotate-45 ${metric?.critical ? 'bg-red-600' : 'bg-blue-600'}`} style={{left:`${left}%`}} /> : <div className={`absolute top-3 h-2 rounded-full ${metric?.critical ? 'bg-red-600' : 'bg-blue-600'}`} style={{left:`${left}%`,width:`${width}%`}} />}<div className="absolute top-3 h-2 rounded-full bg-slate-950/40" style={{left:`${left}%`,width:`${width * Math.min(100,task.progress)/100}%`}} /></div></div>})}</div>}
    </div></CardContent></Card></details>

    <Card id="schedule-wbs"><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-blue-700" />EDT / WBS consolidada</CardTitle><p className={styles.muted}>Actividades, fechas y avance en una sola vista.</p></CardHeader><CardContent>
      <div className={styles.toolbar}><Input aria-label="Buscar actividad o código WBS" placeholder="Buscar actividad o código WBS…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} /><select aria-label="Filtrar actividades" value={taskFilter} onChange={(e) => { setTaskFilter(e.target.value); setPage(1) }} className={selectClass}><option value="all">Todas las actividades</option><option value="overdue">Solo atrasadas</option><option value="critical">Ruta crítica</option></select><span>{visibleTasks.length} de {tasks.length}</span></div>
      <div className={styles.scroll}><table className={styles.table}><thead><tr><th>WBS / Actividad</th><th>Estado</th><th>Inicio / Fin</th><th>Responsable</th><th>Avance</th></tr></thead><tbody>{pageTasks.map((task) => {
        const late = task.task_type !== 'summary' && task.due_on && task.due_on < today && task.progress < 100
        const critical = cpm.metrics.get(task.id)?.critical
        const state = task.task_type === 'summary' ? 'Resumen EDT' : task.progress >= 100 ? 'Completada' : late ? 'Atrasada' : !task.starts_on || !task.due_on ? 'Sin programar' : 'Programada'
        return <tr key={task.id}><td><span className={styles.code}>{task.wbs_code || 'Sin código'}</span><strong>{task.title}</strong><small>{taskTypeLabel[task.task_type]} · Peso {Number(task.planned_weight).toLocaleString('es-PE')}</small>{canPlan ? <button type="button" className={styles.editLink} onClick={() => { setSelectedTaskId(task.id); const editor = document.getElementById('schedule-editor') as HTMLDetailsElement | null; if (editor) { editor.open = true; editor.scrollIntoView({behavior:'smooth'}) } }}>Editar planificación</button> : null}</td><td><span className={late ? styles.danger : state === 'Completada' ? styles.success : styles.neutral}>{state}</span>{critical ? <small className={styles.critical}>Ruta crítica</small> : null}</td><td>{task.starts_on || '—'}<small>{task.due_on || '—'}</small></td><td>{task.assignee_id ? memberName.get(task.assignee_id) || 'Responsable' : 'Sin asignar'}</td><td><strong>{pct(task.progress)}</strong><div className={styles.progress}><i style={{width:pct(task.progress)}} /></div></td></tr>
      })}</tbody></table>{visibleTasks.length === 0 ? <p className={styles.empty}>No hay actividades para este filtro.</p> : null}</div>
      <div className={styles.pagination}><span>Página {currentPage} de {pageCount} · Desliza la tabla para ver más columnas.</span><div><Button type="button" variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><Button type="button" variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></div></div>
    </CardContent></Card>
    <details className={styles.disclosure}><summary>Detalle técnico CPM <span>Ruta crítica y holguras</span></summary><p className={styles.muted}>ES / EF: inicio / fin temprano. LS / LF: inicio / fin tardío. Valores en días desde el inicio del cálculo. Holgura 0 indica ruta crítica.</p>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Route className="size-5 text-red-700" />Ruta crítica y holguras</CardTitle></CardHeader><CardContent className="mgl-table-scroll overflow-x-auto">{cpm.cycleDetected ? <p className="flex items-center gap-2 text-sm text-red-700"><AlertTriangle className="size-4" />Se detectó un ciclo. El servidor también bloquea dependencias cíclicas.</p> : <table className="w-full min-w-[640px] text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="pb-3">WBS</th><th>Actividad</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>Holgura</th></tr></thead><tbody className="divide-y divide-slate-100">{orderedTasks.filter((task) => cpm.metrics.has(task.id)).map((task) => { const m=cpm.metrics.get(task.id)!; return <tr key={task.id} className={m.critical ? 'text-red-700' : 'text-slate-800'}><td className="py-2 font-mono text-xs">{task.wbs_code || '—'}</td><td>{task.title}</td><td>{m.earlyStart}</td><td>{m.earlyFinish}</td><td>{m.lateStart}</td><td>{m.lateFinish}</td><td><Badge className={m.critical ? 'border-red-400/20 bg-red-400/10 text-red-700' : ''}>{m.slack} d</Badge></td></tr>})}</tbody></table>}</CardContent></Card>
    </details>
    {canPlan ? <details id="schedule-editor" className={styles.disclosure}><summary>Editar planificación <span>Tareas, dependencias y línea base</span></summary>
    {canPlan ? <section className="grid gap-8 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>EDT / WBS de la tarea</CardTitle></CardHeader><CardContent>
        {tasks.length === 0 ? <p className="text-sm text-slate-500">Primero crea tareas en el módulo Tareas.</p> : <>
          <label className="text-xs font-semibold text-slate-600">Tarea<select value={selectedTask?.id ?? ''} onChange={(event) => setSelectedTaskId(event.target.value)} className={selectClass}>{orderedTasks.map((task) => <option key={task.id} value={task.id}>{task.wbs_code ? `${task.wbs_code} · ` : ''}{task.title}</option>)}</select></label>
          {selectedTask ? <form key={selectedTask.id} action={saveTaskSchedule} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Código WBS</Label><Input name="wbs_code" defaultValue={selectedTask.wbs_code} placeholder="01.02.03" /></div><label className="text-xs font-semibold text-slate-600">Tipo<select name="task_type" defaultValue={selectedTask.task_type} className={selectClass}><option value="activity">Actividad</option><option value="milestone">Hito</option><option value="summary">Resumen EDT</option></select></label></div>
            <label className="text-xs font-semibold text-slate-600">Padre EDT<select name="parent_task_id" defaultValue={selectedTask.parent_task_id ?? ''} className={selectClass}><option value="">Sin padre</option>{tasks.filter((task) => task.task_type === 'summary' && task.id !== selectedTask.id).map((task) => <option key={task.id} value={task.id}>{task.wbs_code || '—'} · {task.title}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Inicio planificado</Label><Input name="starts_on" type="date" defaultValue={selectedTask.starts_on ?? ''} /></div><div><Label>Fin planificado</Label><Input name="due_on" type="date" defaultValue={selectedTask.due_on ?? ''} /></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Peso de planificación</Label><Input name="planned_weight" type="number" min="0" step="0.01" defaultValue={selectedTask.planned_weight} /></div><label className="text-xs font-semibold text-slate-600">Partida presupuestal<select name="budget_item_id" defaultValue={selectedTask.budget_item_id ?? ''} className={selectClass}><option value="">Sin vínculo</option>{budgetItems.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.description}</option>)}</select></label></div>
            <Button type="submit" disabled={busy}><Save />Guardar planificación</Button>
          </form> : null}
        </>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Dependencias CPM</CardTitle></CardHeader><CardContent>
        <form action={addDependency} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Sucesora<select name="task_id" required className={selectClass}><option value="">Seleccionar…</option>{tasks.filter((t) => t.task_type !== 'summary').map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Predecesora<select name="depends_on_task_id" required className={selectClass}><option value="">Seleccionar…</option>{tasks.filter((t) => t.task_type !== 'summary').map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Relación<select name="dependency_type" defaultValue="FS" className={selectClass}>{Object.entries(dependencyLabel).map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</select></label>
          <div><Label>Lag (días)</Label><Input name="lag_days" type="number" min="-3650" max="3650" defaultValue="0" /></div>
          <Button type="submit" disabled={busy || tasks.length < 2}><Link2 />Añadir dependencia</Button>
        </form>
        <div className="mt-5 max-h-72 space-y-2 overflow-y-auto">{dependencies.length === 0 ? <p className="text-sm text-slate-500">Sin dependencias activas.</p> : dependencies.map((dep) => <form key={dep.id} action={(fd) => editDependency(dep, fd)} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_120px_90px_auto] sm:items-center"><p className="min-w-0 text-xs text-slate-800"><strong>{taskName.get(dep.depends_on_task_id) ?? 'Tarea'}</strong> → {taskName.get(dep.task_id) ?? 'Tarea'}</p><select name="dependency_type" defaultValue={dep.dependency_type} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900">{Object.keys(dependencyLabel).map((key) => <option key={key}>{key}</option>)}</select><Input name="lag_days" type="number" defaultValue={dep.lag_days} className="h-9" /><div className="flex"><Button type="submit" variant="ghost" size="icon" title="Guardar"><Save /></Button><Button type="button" variant="ghost" size="icon" title="Retirar" onClick={() => void removeDependency(dep.id)}><Trash2 /></Button></div></form>)}</div>
      </CardContent></Card>
    </section> : null}

    {canBaseline ? <Card><CardHeader><CardTitle>Línea base del cronograma</CardTitle></CardHeader><CardContent><form action={createBaseline} className="flex flex-col gap-3 sm:flex-row"><Input name="baseline_name" placeholder={`LB ${new Date().getFullYear()}`} required /><Button type="submit" disabled={busy}><Flag />Crear nueva línea base</Button></form></CardContent></Card> : null}

    </details> : null}
  </div>
}
